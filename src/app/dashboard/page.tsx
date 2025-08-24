'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../providers'
import DashboardStats from '@/components/dashboard/DashboardStats'
import RecentActivity from '@/components/dashboard/RecentActivity'
import QuickActions from '@/components/dashboard/QuickActions'

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalMatches: 0,
    pendingReviews: 0,
    approvalRate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!user || !profile || authLoading) return

      try {

        // Fetch all stats in parallel
        const [documentsResult, matchesResult, pendingResult] = await Promise.all([
          supabase
            .from('documents')
            .select('id', { count: 'exact' })
            .eq('organization_id', profile.organization_id),
          supabase
            .from('matches')
            .select('id, status', { count: 'exact' })
            .eq('organization_id', profile.organization_id),
          supabase
            .from('matches')
            .select('id', { count: 'exact' })
            .eq('organization_id', profile.organization_id)
            .eq('status', 'pending'),
        ])

        const totalDocuments = documentsResult.count || 0
        const totalMatches = matchesResult.count || 0
        const pendingReviews = pendingResult.count || 0

        // Calculate approval rate
        let approvalRate = 0
        if (matchesResult.data && matchesResult.data.length > 0) {
          const approvedCount = matchesResult.data.filter(
            match => match.status === 'approved' || match.status === 'auto_matched'
          ).length
          approvalRate = (approvedCount / matchesResult.data.length) * 100
        }

        setStats({
          totalDocuments,
          totalMatches,
          pendingReviews,
          approvalRate,
        })
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user, profile, authLoading, supabase])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back! Here's what's happening with your document matching.
        </p>
      </div>

      <DashboardStats stats={stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActions />
        <RecentActivity />
      </div>
    </div>
  )
}