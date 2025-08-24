'use client'

import { useAuth } from './providers'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import AuthForm from '@/components/auth/AuthForm'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PathoptMatch</h1>
          <p className="text-lg text-gray-600 mb-8">
            AI-Powered Document Matching
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 text-center">
              Welcome Back
            </h2>
            <p className="text-sm text-gray-600 text-center mt-2">
              Sign in to access your document matching workspace
            </p>
          </div>
          
          <AuthForm />
        </div>
        
        <div className="mt-8 text-center">
          <div className="text-sm text-gray-600">
            <h3 className="font-semibold mb-2">Key Features:</h3>
            <ul className="space-y-1">
              <li>✓ AI-powered PDF parsing with LlamaParse</li>
              <li>✓ Hybrid matching algorithm (95%+ accuracy)</li>
              <li>✓ Progressive learning system</li>
              <li>✓ Multi-tenant support with RLS</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}