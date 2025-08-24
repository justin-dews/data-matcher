'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

interface ActivityLogEntry {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, any>
  created_at: string
  user?: {
    full_name: string | null
    email: string
  }
}

interface ActivityTrackerProps {
  activities: ActivityLogEntry[]
  onRefresh: () => void
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  export_csv: { label: 'CSV Export', icon: '📊', color: 'text-blue-600' },
  export_start: { label: 'Export Started', icon: '🚀', color: 'text-indigo-600' },
  export_failed: { label: 'Export Failed', icon: '❌', color: 'text-red-600' },
  match_approved: { label: 'Match Approved', icon: '✅', color: 'text-green-600' },
  match_rejected: { label: 'Match Rejected', icon: '❌', color: 'text-red-600' },
  match_auto: { label: 'Auto Match', icon: '⚡', color: 'text-yellow-600' },
  document_uploaded: { label: 'Document Uploaded', icon: '📄', color: 'text-blue-600' },
  document_parsed: { label: 'Document Parsed', icon: '🔍', color: 'text-purple-600' },
  product_created: { label: 'Product Created', icon: '📦', color: 'text-green-600' },
  product_updated: { label: 'Product Updated', icon: '✏️', color: 'text-orange-600' },
  bulk_action: { label: 'Bulk Action', icon: '⚡', color: 'text-indigo-600' },
  settings_changed: { label: 'Settings Changed', icon: '⚙️', color: 'text-gray-600' },
}

export default function ActivityTracker({ activities, onRefresh }: ActivityTrackerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Get unique actions and users for filters
  const { uniqueActions, uniqueUsers } = useMemo(() => {
    const actions = new Set(activities.map(a => a.action))
    const users = new Set(
      activities
        .filter(a => a.user)
        .map(a => JSON.stringify({ 
          id: a.user_id, 
          name: a.user?.full_name || a.user?.email || 'Unknown User' 
        }))
    )

    return {
      uniqueActions: Array.from(actions),
      uniqueUsers: Array.from(users).map(u => JSON.parse(u))
    }
  }, [activities])

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch = 
          activity.action.toLowerCase().includes(searchLower) ||
          (activity.user?.full_name || '').toLowerCase().includes(searchLower) ||
          (activity.user?.email || '').toLowerCase().includes(searchLower) ||
          JSON.stringify(activity.metadata).toLowerCase().includes(searchLower)
        
        if (!matchesSearch) return false
      }

      // Action filter
      if (selectedActions.length > 0 && !selectedActions.includes(activity.action)) {
        return false
      }

      // User filter
      if (selectedUsers.length > 0 && !selectedUsers.includes(activity.user_id)) {
        return false
      }

      // Date filter
      const activityDate = parseISO(activity.created_at)
      switch (dateFilter) {
        case 'today':
          return isToday(activityDate)
        case 'yesterday':
          return isYesterday(activityDate)
        case 'week':
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return activityDate >= weekAgo
        default:
          return true
      }
    })
  }, [activities, searchTerm, selectedActions, selectedUsers, dateFilter])

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityLogEntry[]> = {}
    
    filteredActivities.forEach(activity => {
      const date = format(parseISO(activity.created_at), 'yyyy-MM-dd')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(activity)
    })

    // Sort dates descending
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
    return sortedGroups
  }, [filteredActivities])

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MMMM d, yyyy')
  }

  const formatTime = (dateStr: string) => {
    return format(parseISO(dateStr), 'HH:mm:ss')
  }

  const getActionInfo = (action: string) => {
    return ACTION_LABELS[action] || { 
      label: action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
      icon: '📝', 
      color: 'text-gray-600' 
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh()
    setIsRefreshing(false)
  }

  const handleActionFilter = (action: string) => {
    setSelectedActions(prev => 
      prev.includes(action)
        ? prev.filter(a => a !== action)
        : [...prev, action]
    )
  }

  const handleUserFilter = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(u => u !== userId)
        : [...prev, userId]
    )
  }

  const renderMetadata = (metadata: Record<string, any>) => {
    const keys = Object.keys(metadata)
    if (keys.length === 0) return null

    const importantKeys = ['export_name', 'filename', 'product_name', 'match_count', 'error']
    const displayKeys = keys.filter(key => importantKeys.includes(key)).slice(0, 3)

    if (displayKeys.length === 0) return null

    return (
      <div className="mt-1 text-xs text-gray-500">
        {displayKeys.map(key => (
          <span key={key} className="mr-3">
            <span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(metadata[key])}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Activity Log</h3>
          <p className="text-sm text-gray-500">
            Track all user actions and system events
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Search activities..."
              />
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Actions ({selectedActions.length} selected)
            </label>
            <div className="relative">
              <FunnelIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                multiple
                value={selectedActions}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value)
                  setSelectedActions(values)
                }}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                size={4}
              >
                {uniqueActions.map(action => (
                  <option key={action} value={action}>
                    {getActionInfo(action).label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Users ({selectedUsers.length} selected)
            </label>
            <div className="relative">
              <UserIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                multiple
                value={selectedUsers}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value)
                  setSelectedUsers(values)
                }}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                size={4}
              >
                {uniqueUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Clear Filters */}
        {(selectedActions.length > 0 || selectedUsers.length > 0 || searchTerm || dateFilter !== 'all') && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedActions([])
                setSelectedUsers([])
                setDateFilter('all')
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="space-y-6">
        {groupedActivities.length === 0 ? (
          <div className="text-center py-12">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No activities found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or check back later.
            </p>
          </div>
        ) : (
          groupedActivities.map(([date, dayActivities]) => (
            <div key={date} className="relative">
              {/* Date Header */}
              <div className="relative flex items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <ClockIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">
                    {formatDate(date + 'T00:00:00Z')}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {dayActivities.length} activities
                  </p>
                </div>
              </div>

              {/* Activities */}
              <div className="ml-12 mt-2 space-y-3">
                {dayActivities.map((activity) => {
                  const actionInfo = getActionInfo(activity.action)
                  
                  return (
                    <div
                      key={activity.id}
                      className="relative bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <span className="text-lg mr-3">{actionInfo.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center">
                              <span className={`text-sm font-medium ${actionInfo.color}`}>
                                {actionInfo.label}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {formatTime(activity.created_at)}
                              </span>
                            </div>
                            
                            <div className="mt-1 text-sm text-gray-700">
                              by {activity.user?.full_name || activity.user?.email || 'Unknown User'}
                            </div>
                            
                            {renderMetadata(activity.metadata)}
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-400">
                          {activity.resource_type}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {filteredActivities.length}
            </div>
            <div className="text-sm text-gray-500">Total Activities</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {uniqueUsers.length}
            </div>
            <div className="text-sm text-gray-500">Active Users</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {uniqueActions.length}
            </div>
            <div className="text-sm text-gray-500">Action Types</div>
          </div>
        </div>
      </div>
    </div>
  )
}