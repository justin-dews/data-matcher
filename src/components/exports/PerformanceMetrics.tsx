'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { 
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
  ArrowPathIcon,
  TrophyIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface PerformanceStats {
  total_matches: number
  approved_matches: number
  rejected_matches: number
  auto_matches: number
  avg_confidence: number
  accuracy_rate: number
  processing_time_avg: number
  last_calculated: string
}

interface PerformanceMetricsProps {
  stats: PerformanceStats
  onRefresh: () => void
}

export default function PerformanceMetrics({ stats, onRefresh }: PerformanceMetricsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh()
    setIsRefreshing(false)
  }

  // Calculate derived metrics
  const processingRate = stats.total_matches > 0 
    ? ((stats.approved_matches + stats.rejected_matches + stats.auto_matches) / stats.total_matches) * 100 
    : 0

  const autoMatchRate = stats.total_matches > 0 
    ? (stats.auto_matches / stats.total_matches) * 100 
    : 0

  const manualReviewRate = stats.total_matches > 0 
    ? ((stats.approved_matches + stats.rejected_matches) / stats.total_matches) * 100 
    : 0

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
  }

  const getScoreColor = (score: number, thresholds: { good: number; warning: number }) => {
    if (score >= thresholds.good) return 'text-green-600'
    if (score >= thresholds.warning) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadge = (score: number, thresholds: { good: number; warning: number }) => {
    if (score >= thresholds.good) return 'bg-green-100 text-green-800'
    if (score >= thresholds.warning) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const MetricCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend, 
    color = 'text-gray-900',
    badge,
    description 
  }: {
    title: string
    value: string | number
    subtitle?: string
    icon: any
    trend?: { value: number; label: string }
    color?: string
    badge?: string
    description?: string
  }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${color.includes('green') ? 'text-green-500' : 
                                     color.includes('yellow') ? 'text-yellow-500' : 
                                     color.includes('red') ? 'text-red-500' : 
                                     color.includes('blue') ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="flex items-baseline">
                <div className={`text-2xl font-semibold ${color}`}>
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                {badge && (
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}`}>
                    {subtitle}
                  </span>
                )}
                {!badge && subtitle && (
                  <span className="ml-2 text-sm text-gray-500">{subtitle}</span>
                )}
              </dd>
              {description && (
                <dd className="mt-1 text-xs text-gray-400">{description}</dd>
              )}
            </dl>
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center text-sm">
            <span className={trend.value >= 0 ? 'text-green-600' : 'text-red-600'}>
              {trend.value >= 0 ? '↗' : '↘'} {Math.abs(trend.value)}%
            </span>
            <span className="ml-1 text-gray-500">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
          <p className="text-sm text-gray-500">
            System performance and accuracy analytics
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Last updated: {format(parseISO(stats.last_calculated), 'MMM d, yyyy HH:mm')}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Recalculate
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Matches"
          value={stats.total_matches}
          subtitle={`${processingRate.toFixed(1)}% processed`}
          icon={ChartBarIcon}
          description="All matching attempts in system"
        />
        
        <MetricCard
          title="Accuracy Rate"
          value={`${(stats.accuracy_rate * 100).toFixed(1)}%`}
          subtitle={stats.accuracy_rate >= 0.8 ? 'Excellent' : stats.accuracy_rate >= 0.6 ? 'Good' : 'Needs Improvement'}
          icon={TrophyIcon}
          color={getScoreColor(stats.accuracy_rate, { good: 0.8, warning: 0.6 })}
          badge={getScoreBadge(stats.accuracy_rate, { good: 0.8, warning: 0.6 })}
          description="(Approved + Auto) / Total processed"
        />
        
        <MetricCard
          title="Auto-Match Rate"
          value={`${autoMatchRate.toFixed(1)}%`}
          subtitle={`${stats.auto_matches} auto-matched`}
          icon={BoltIcon}
          color={getScoreColor(autoMatchRate / 100, { good: 0.6, warning: 0.3 })}
          description="Matches confirmed automatically"
        />
        
        <MetricCard
          title="Avg Processing Time"
          value={formatDuration(stats.processing_time_avg)}
          subtitle="per match"
          icon={ClockIcon}
          color={getScoreColor(1 / (stats.processing_time_avg + 1), { good: 0.5, warning: 0.2 })}
          description="Time from creation to resolution"
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Match Status Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Match Status Distribution</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">Approved</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-semibold text-gray-900">
                  {stats.approved_matches.toLocaleString()}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({stats.total_matches > 0 ? ((stats.approved_matches / stats.total_matches) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BoltIcon className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">Auto-matched</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-semibold text-gray-900">
                  {stats.auto_matches.toLocaleString()}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({stats.total_matches > 0 ? ((stats.auto_matches / stats.total_matches) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">Rejected</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-semibold text-gray-900">
                  {stats.rejected_matches.toLocaleString()}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({stats.total_matches > 0 ? ((stats.rejected_matches / stats.total_matches) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">Pending</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-semibold text-gray-900">
                  {(stats.total_matches - stats.approved_matches - stats.auto_matches - stats.rejected_matches).toLocaleString()}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({stats.total_matches > 0 ? (((stats.total_matches - stats.approved_matches - stats.auto_matches - stats.rejected_matches) / stats.total_matches) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>

            {/* Visual progress bar */}
            <div className="mt-4">
              <div className="flex text-xs text-gray-600 mb-1">
                <span>Match Resolution Progress</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 flex overflow-hidden">
                <div 
                  className="bg-green-500 h-2"
                  style={{ width: `${stats.total_matches > 0 ? (stats.approved_matches / stats.total_matches) * 100 : 0}%` }}
                />
                <div 
                  className="bg-yellow-500 h-2"
                  style={{ width: `${stats.total_matches > 0 ? (stats.auto_matches / stats.total_matches) * 100 : 0}%` }}
                />
                <div 
                  className="bg-red-500 h-2"
                  style={{ width: `${stats.total_matches > 0 ? (stats.rejected_matches / stats.total_matches) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Quality Indicators</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-700">Average Confidence</div>
                <div className="text-xs text-gray-500">Across all matches</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getScoreColor(stats.avg_confidence, { good: 0.8, warning: 0.6 })}`}>
                  {(stats.avg_confidence * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">confidence</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-700">Manual Review Rate</div>
                <div className="text-xs text-gray-500">Requires human intervention</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getScoreColor(1 - (manualReviewRate / 100), { good: 0.6, warning: 0.3 })}`}>
                  {manualReviewRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">manual</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-700">Processing Efficiency</div>
                <div className="text-xs text-gray-500">Resolved vs pending</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getScoreColor(processingRate / 100, { good: 0.8, warning: 0.6 })}`}>
                  {processingRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">processed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white shadow rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
          Performance Recommendations
        </h4>
        
        <div className="space-y-3">
          {stats.accuracy_rate < 0.8 && (
            <div className="flex items-start p-3 bg-yellow-50 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-yellow-800">
                  Low Accuracy Rate ({(stats.accuracy_rate * 100).toFixed(1)}%)
                </div>
                <div className="text-xs text-yellow-700 mt-1">
                  Consider reviewing matching algorithms, updating product catalog, or adjusting confidence thresholds.
                </div>
              </div>
            </div>
          )}

          {autoMatchRate < 30 && (
            <div className="flex items-start p-3 bg-blue-50 rounded-lg">
              <BoltIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-blue-800">
                  Low Auto-Match Rate ({autoMatchRate.toFixed(1)}%)
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  Consider lowering auto-match thresholds or improving product embeddings to reduce manual work.
                </div>
              </div>
            </div>
          )}

          {stats.processing_time_avg > 300 && (
            <div className="flex items-start p-3 bg-red-50 rounded-lg">
              <ClockIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-red-800">
                  High Processing Time ({formatDuration(stats.processing_time_avg)})
                </div>
                <div className="text-xs text-red-700 mt-1">
                  Matches are taking too long to resolve. Consider optimizing workflows or increasing automation.
                </div>
              </div>
            </div>
          )}

          {processingRate < 60 && (
            <div className="flex items-start p-3 bg-purple-50 rounded-lg">
              <ChartBarIcon className="h-5 w-5 text-purple-500 mr-2 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-purple-800">
                  High Pending Rate ({(100 - processingRate).toFixed(1)}%)
                </div>
                <div className="text-xs text-purple-700 mt-1">
                  Large backlog of unprocessed matches. Consider bulk actions or increasing review capacity.
                </div>
              </div>
            </div>
          )}

          {stats.accuracy_rate >= 0.8 && autoMatchRate >= 60 && processingRate >= 80 && (
            <div className="flex items-start p-3 bg-green-50 rounded-lg">
              <TrophyIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-green-800">
                  Excellent Performance
                </div>
                <div className="text-xs text-green-700 mt-1">
                  Your matching system is performing well across all key metrics. Keep monitoring for consistency.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}