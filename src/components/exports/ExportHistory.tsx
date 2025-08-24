'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { 
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

interface ExportSession {
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

interface ExportHistoryProps {
  sessions: ExportSession[]
  onRefresh: () => void
}

const STATUS_COLORS = {
  preparing: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800'
}

const STATUS_ICONS = {
  preparing: ClockIcon,
  processing: ClockIcon,
  completed: CheckCircleIcon,
  failed: ExclamationCircleIcon
}

export default function ExportHistory({ sessions, onRefresh }: ExportHistoryProps) {
  const [selectedSession, setSelectedSession] = useState<ExportSession | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const getProgressPercentage = (session: ExportSession) => {
    if (session.total_records === 0) return 0
    return Math.round((session.processed_records / session.total_records) * 100)
  }

  const formatFileSize = (records: number) => {
    // Rough estimate: ~200 bytes per record
    const bytes = records * 200
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDownload = (session: ExportSession) => {
    // In a real implementation, this would download from server storage
    // For now, we'll show a message since we're generating files client-side
    alert('Export files are downloaded directly during generation. This feature would retrieve files from server storage in a production environment.')
  }

  const handleViewDetails = (session: ExportSession) => {
    setSelectedSession(session)
    setShowDetails(true)
  }

  const handleDelete = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this export session? This cannot be undone.')) {
      // In a real implementation, this would delete the export record
      // For now, just refresh the list
      onRefresh()
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Export History</h3>
          <p className="text-sm text-gray-500">
            View and manage your data exports
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {sessions.length} total exports
        </div>
      </div>

      {/* Export List */}
      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <DocumentArrowDownIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No exports yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start by creating your first data export.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {sessions.map((session) => {
              const StatusIcon = STATUS_ICONS[session.status]
              const progressPercentage = getProgressPercentage(session)
              
              return (
                <li key={session.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <StatusIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          
                          <div className="ml-3 min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {session.name}
                              </h4>
                              
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[session.status]}`}>
                                  {session.status.replace('_', ' ')}
                                </span>
                                
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleViewDetails(session)}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="View Details"
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                  </button>
                                  
                                  {session.status === 'completed' && session.file_path && (
                                    <button
                                      onClick={() => handleDownload(session)}
                                      className="text-gray-400 hover:text-gray-600"
                                      title="Download"
                                    >
                                      <ArrowDownTrayIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => handleDelete(session.id)}
                                    className="text-gray-400 hover:text-red-600"
                                    title="Delete"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-2 sm:flex sm:justify-between">
                              <div className="sm:flex sm:space-x-4">
                                <div className="flex items-center text-sm text-gray-500">
                                  <span>
                                    {session.processed_records.toLocaleString()} / {session.total_records.toLocaleString()} records
                                  </span>
                                  {session.status === 'processing' && (
                                    <span className="ml-2">({progressPercentage}%)</span>
                                  )}
                                </div>
                                
                                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                  <span>
                                    {session.metadata.columns.length} columns
                                  </span>
                                </div>
                                
                                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                  <span>
                                    ~{formatFileSize(session.processed_records)}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                {format(parseISO(session.created_at), 'MMM d, yyyy HH:mm')}
                              </div>
                            </div>
                            
                            {/* Progress bar for processing exports */}
                            {session.status === 'processing' && (
                              <div className="mt-3">
                                <div className="bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {/* Metadata preview */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {session.metadata.filters.status && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                                  Status: {Array.isArray(session.metadata.filters.status) 
                                    ? session.metadata.filters.status.join(', ')
                                    : session.metadata.filters.status}
                                </span>
                              )}
                              
                              {session.metadata.filters.confidenceThreshold && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                                  Min confidence: {session.metadata.filters.confidenceThreshold}
                                </span>
                              )}
                              
                              {session.metadata.include_write_back && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                  Write-back enabled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedSession && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Export Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Basic Information</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{selectedSession.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedSession.status]}`}>
                      {selectedSession.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Records:</span>
                    <span className="font-medium">
                      {selectedSession.processed_records.toLocaleString()} / {selectedSession.total_records.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium">
                      {format(parseISO(selectedSession.created_at), 'MMM d, yyyy HH:mm:ss')}
                    </span>
                  </div>
                  {selectedSession.file_path && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">File:</span>
                      <span className="font-medium">{selectedSession.file_path}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Columns */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Exported Columns ({selectedSession.metadata.columns.length})
                </h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedSession.metadata.columns.map((column, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {column.replace(/^(line_item|product|match|document)\./, '').replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Applied Filters</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  {Object.keys(selectedSession.metadata.filters).length === 0 ? (
                    <p className="text-sm text-gray-500">No filters applied</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedSession.metadata.filters.status && (
                        <div className="text-sm">
                          <span className="text-gray-600">Status:</span>{' '}
                          <span className="font-medium">
                            {Array.isArray(selectedSession.metadata.filters.status)
                              ? selectedSession.metadata.filters.status.join(', ')
                              : selectedSession.metadata.filters.status}
                          </span>
                        </div>
                      )}
                      
                      {selectedSession.metadata.filters.confidenceThreshold && (
                        <div className="text-sm">
                          <span className="text-gray-600">Min Confidence:</span>{' '}
                          <span className="font-medium">{selectedSession.metadata.filters.confidenceThreshold}</span>
                        </div>
                      )}
                      
                      {selectedSession.metadata.filters.dateRange && (
                        <div className="text-sm">
                          <span className="text-gray-600">Date Range:</span>{' '}
                          <span className="font-medium">
                            {selectedSession.metadata.filters.dateRange.start} to {selectedSession.metadata.filters.dateRange.end}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Options */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Export Options</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center text-sm">
                    <span className="text-gray-600">Write-back enabled:</span>
                    <span className={`ml-2 font-medium ${
                      selectedSession.metadata.include_write_back ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {selectedSession.metadata.include_write_back ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}