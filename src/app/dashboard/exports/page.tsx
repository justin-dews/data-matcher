'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../providers'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ExportConfigModal from '@/components/exports/ExportConfigModal'
import ActivityTracker from '@/components/exports/ActivityTracker'
import ExportHistory from '@/components/exports/ExportHistory'
import PerformanceMetrics from '@/components/exports/PerformanceMetrics'
import { 
  ArrowDownTrayIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentCheckIcon 
} from '@heroicons/react/24/outline'

export interface ExportSession {
  id: string
  name: string
  status: 'preparing' | 'processing' | 'completed' | 'failed'
  total_records: number
  processed_records: number
  file_path?: string
  created_at: string
  metadata: {
    columns: string[]
    filters: Record<string, any>
    include_write_back?: boolean
  }
}

export interface ActivityLogEntry {
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

export interface PerformanceStats {
  total_matches: number
  approved_matches: number
  rejected_matches: number
  auto_matches: number
  avg_confidence: number
  accuracy_rate: number
  processing_time_avg: number
  last_calculated: string
}

export default function ExportsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'exports' | 'activity' | 'metrics'>('exports')
  const [exportSessions, setExportSessions] = useState<ExportSession[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load all data
  const loadData = useCallback(async () => {
    if (!user || !user.organization_id) return

    setLoading(true)
    setError(null)

    try {
      // Load export history from activity log
      const { data: exportData } = await supabase
        .from('activity_log')
        .select('*')
        .eq('organization_id', user.organization_id!)
        .eq('action', 'export_csv')
        .order('created_at', { ascending: false })
        .limit(50)

      // Transform to export sessions
      const sessions: ExportSession[] = exportData?.map(log => ({
        id: log.id,
        name: log.metadata.export_name || 'CSV Export',
        status: log.metadata.status || 'completed',
        total_records: log.metadata.total_records || 0,
        processed_records: log.metadata.processed_records || 0,
        file_path: log.metadata.file_path,
        created_at: log.created_at,
        metadata: {
          columns: log.metadata.columns || [],
          filters: log.metadata.filters || {},
          include_write_back: log.metadata.include_write_back || false
        }
      })) || []

      setExportSessions(sessions)

      // Load recent activity
      const { data: activityData } = await supabase
        .from('activity_log')
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq('organization_id', user.organization_id!)
        .order('created_at', { ascending: false })
        .limit(100)

      setActivityLog(activityData as ActivityLogEntry[] || [])

      // Calculate performance metrics
      await calculatePerformanceMetrics()
      
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [user?.organization_id])

  // Calculate performance metrics
  const calculatePerformanceMetrics = useCallback(async () => {
    if (!user || !user.organization_id) return

    try {
      // Get match statistics
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('status, confidence_score, created_at, updated_at')
        .eq('organization_id', user.organization_id!)

      if (matchError) throw matchError

      const matches = matchData || []
      const totalMatches = matches.length
      const approvedMatches = matches.filter(m => m.status === 'approved').length
      const rejectedMatches = matches.filter(m => m.status === 'rejected').length
      const autoMatches = matches.filter(m => m.status === 'auto_matched').length

      const confidenceScores = matches
        .filter(m => m.confidence_score !== null)
        .map(m => m.confidence_score!)

      const avgConfidence = confidenceScores.length > 0
        ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
        : 0

      // Calculate accuracy rate (approved + auto / total non-pending)
      const processedMatches = approvedMatches + rejectedMatches + autoMatches
      const accuracyRate = processedMatches > 0 
        ? (approvedMatches + autoMatches) / processedMatches 
        : 0

      // Calculate average processing time
      const processingTimes = matches
        .filter(m => m.created_at && m.updated_at)
        .map(m => {
          const created = new Date(m.created_at!).getTime()
          const updated = new Date(m.updated_at!).getTime()
          return updated - created
        })

      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length / 1000 // Convert to seconds
        : 0

      const stats: PerformanceStats = {
        total_matches: totalMatches,
        approved_matches: approvedMatches,
        rejected_matches: rejectedMatches,
        auto_matches: autoMatches,
        avg_confidence: avgConfidence,
        accuracy_rate: accuracyRate,
        processing_time_avg: avgProcessingTime,
        last_calculated: new Date().toISOString()
      }

      setPerformanceStats(stats)
    } catch (err) {
      console.error('Error calculating performance metrics:', err)
    }
  }, [user?.organization_id])

  useEffect(() => {
    if (user?.organization_id) {
      loadData()
    }
  }, [user?.organization_id, loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading data
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => loadData()}
                className="bg-red-100 px-3 py-2 text-sm font-medium text-red-800 rounded-md hover:bg-red-200"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exports & Activity</h1>
          <p className="mt-2 text-sm text-gray-700">
            Export matched data, track activity, and monitor performance metrics
          </p>
        </div>
        
        <button
          onClick={() => setShowExportModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ArrowDownTrayIcon className="-ml-1 mr-2 h-4 w-4" />
          New Export
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('exports')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'exports'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ArrowDownTrayIcon className="inline w-4 h-4 mr-2" />
            Export History
          </button>
          
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClockIcon className="inline w-4 h-4 mr-2" />
            Activity Log
          </button>
          
          <button
            onClick={() => setActiveTab('metrics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'metrics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ChartBarIcon className="inline w-4 h-4 mr-2" />
            Performance Metrics
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg">
        {activeTab === 'exports' && (
          <ExportHistory 
            sessions={exportSessions}
            onRefresh={loadData}
          />
        )}
        
        {activeTab === 'activity' && (
          <ActivityTracker 
            activities={activityLog}
            onRefresh={loadData}
          />
        )}
        
        {activeTab === 'metrics' && performanceStats && (
          <PerformanceMetrics 
            stats={performanceStats}
            onRefresh={calculatePerformanceMetrics}
          />
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportConfigModal
          onClose={() => setShowExportModal(false)}
          onExport={async (config) => {
            setShowExportModal(false)
            await loadData() // Refresh to show new export session
          }}
        />
      )}
    </div>
  )
}