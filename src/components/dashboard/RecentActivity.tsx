'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { formatDistance } from 'date-fns'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface ActivityItem {
  id: string
  action: string
  resource_type: string
  created_at: string
  metadata: any
}

export default function RecentActivity() {
  const { user, profile, loading: authLoading } = useAuth()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      if (!user || !profile || authLoading) return

      try {

        // Fetch recent activities
        const { data } = await supabase
          .from('activity_log')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
          .limit(10)

        setActivities(data || [])
      } catch (error) {
        console.error('Error fetching activities:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [user, profile, authLoading, supabase])

  const getActivityDescription = (activity: ActivityItem) => {
    const { action, resource_type, metadata } = activity
    
    switch (action) {
      case 'upload':
        return `Uploaded document: ${metadata.filename || 'Unknown'}`
      case 'parse':
        return `Parsed document: ${metadata.filename || 'Unknown'}`
      case 'match_approved':
        return `Approved match for: ${metadata.product_name || 'Product'}`
      case 'match_rejected':
        return `Rejected match for: ${metadata.product_name || 'Product'}`
      case 'product_created':
        return `Added new product: ${metadata.product_name || 'Unknown'}`
      default:
        return `${action} ${resource_type}`
    }
  }

  const getActivityIcon = (activity: ActivityItem) => {
    const { action, resource_type } = activity
    
    switch (action) {
      case 'upload':
        return '📄'
      case 'parse':
        return '🔍'
      case 'match_approved':
        return '✅'
      case 'match_rejected':
        return '❌'
      case 'product_created':
        return '📦'
      default:
        return '📋'
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm">No recent activity</div>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="text-lg">{getActivityIcon(activity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900">
                    {getActivityDescription(activity)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDistance(new Date(activity.created_at), new Date(), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}