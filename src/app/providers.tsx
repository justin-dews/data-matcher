'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextType {
  user: User | null
  profile: Profile | null
  organization: { name: string; slug: string } | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organization: null,
  loading: true,
  signOut: async () => {},
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<{ name: string; slug: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 Fetching profile for user:', userId)
      
      // Add timeout to prevent hanging - increased to 10 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      )
      
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any

      if (error) {
        console.error('❌ Error fetching profile:', error)
        console.error('Error details:', { code: error.code, message: error.message, details: error.details })
        
        // If profile doesn't exist, create a default organization and profile
        if (error.code === 'PGRST116') {
          console.log('Profile not found - creating default organization and profile')
          
          const { data: userData } = await supabase.auth.getUser()
          if (userData.user) {
            // Create default organization for the admin user
            const organizationId = crypto.randomUUID()
            const organizationName = 'PathOpt Solutions'
            
            const { data: createdOrg, error: orgError } = await supabase
              .from('organizations')
              .insert({
                id: organizationId,
                name: organizationName,
                slug: 'pathopt-solutions',
                settings: {}
              })
              .select()
              .single()
              
            if (orgError) {
              console.error('Error creating organization:', orgError)
              return
            }
            
            console.log('Default organization created:', createdOrg)
            
            // Create profile
            const newProfile = {
              id: userId,
              organization_id: organizationId,
              email: userData.user.email,
              full_name: userData.user.email === 'justin@pathopt.com' ? 'Justin Dews' : userData.user.email?.split('@')[0] || 'User',
              role: 'admin'
            }
            
            const { data: createdProfile, error: createError } = await supabase
              .from('profiles')
              .insert(newProfile)
              .select()
              .single()
              
            if (createError) {
              console.error('Error creating profile:', createError)
              return
            }
            
            console.log('Profile created:', createdProfile)
            setProfile(createdProfile)
            
            // Also set the organization data
            setOrganization({ name: organizationName, slug: 'pathopt-solutions' })
          }
        }
        return
      }

      console.log('Profile loaded:', data)
      
      // Organization data will be fetched separately below
      
      // Fetch organization data
      if (data?.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, slug')
          .eq('id', data.organization_id)
          .single()
        
        if (orgData) {
          setOrganization(orgData)
        }
      }
      
      setProfile(data)
    } catch (error) {
      console.error('❌ Critical error in fetchProfile:', error)
      
      // If it's a timeout, skip profile creation and continue with null profile
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn('⚠️ Profile fetch timed out - continuing without profile (you may need to refresh)')
        setProfile(null)
        return
      }
      
      setProfile(null)
    }
  }

  useEffect(() => {
    let isMounted = true
    
    // Get initial session with timeout
    const getSession = async () => {
      try {
        console.log('🔄 Initializing auth session...')
        
        // Try to get session without timeout first to see if it works
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ Auth session error:', error)
          throw error
        }
        
        console.log('🔐 Auth session loaded:', session ? 'User authenticated' : 'No session')
        if (session?.user) {
          console.log('👤 User ID:', session.user.id)
          console.log('📧 User email:', session.user.email)
        }
        
        if (!isMounted) return
        
        const user = session?.user ?? null
        setUser(user)
        
        if (user) {
          await fetchProfile(user.id)
        } else {
          setProfile(null)
        }
        
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        
        // Try alternative auth check - get current user directly
        try {
          console.log('🔄 Trying alternative auth method...')
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            console.error('❌ Alternative auth also failed:', userError)
          } else if (user) {
            console.log('✅ Found user via alternative method:', user.email)
            if (isMounted) {
              setUser(user)
              await fetchProfile(user.id)
            }
            return
          }
        } catch (altError) {
          console.error('❌ Alternative auth method failed:', altError)
        }
        
        // On error, assume no user and continue
        if (isMounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!isMounted) return
      
      const user = session?.user ?? null
      setUser(user)
      
      try {
        if (user) {
          await fetchProfile(user.id)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('Profile fetch error during auth change:', error)
      }
      
      if (isMounted) {
        setLoading(false)
      }
    })

    // Cleanup function
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, organization, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within a Providers component')
  }
  return context
}