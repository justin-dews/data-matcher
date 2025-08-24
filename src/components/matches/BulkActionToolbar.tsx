'use client'

import { 
  CheckIcon, 
  XMarkIcon, 
  BoltIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'

interface BulkActionToolbarProps {
  selectedCount: number
  onApproveAll: () => void
  onRejectAll: () => void
  onAutoMatch: () => void
  disabled?: boolean
}

export default function BulkActionToolbar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onAutoMatch,
  disabled = false
}: BulkActionToolbarProps) {
  return (
    <div className="flex items-center space-x-3">
      {/* Selection counter */}
      <div className="flex items-center space-x-2">
        <ClipboardDocumentListIcon className="h-5 w-5 text-gray-400" />
        <span className="text-sm text-gray-600">
          {selectedCount} selected
        </span>
      </div>

      {/* Bulk actions - show when items are selected */}
      {selectedCount > 0 && (
        <>
          <div className="border-l border-gray-300 h-6" />
          
          <button
            onClick={onApproveAll}
            disabled={disabled}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="h-4 w-4 mr-2" />
            Approve All ({selectedCount})
          </button>
          
          <button
            onClick={onRejectAll}
            disabled={disabled}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="h-4 w-4 mr-2" />
            Reject All ({selectedCount})
          </button>
        </>
      )}

      {/* Auto-match button - always visible */}
      <div className={selectedCount > 0 ? "border-l border-gray-300 h-6 pl-3" : ""}>
        <button
          onClick={onAutoMatch}
          disabled={disabled}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Auto-approve matches above threshold"
        >
          <BoltIcon className="h-4 w-4 mr-2" />
          Auto-Match
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:block text-xs text-gray-500 ml-4">
        <div className="flex items-center space-x-4">
          {selectedCount > 0 && (
            <>
              <div className="flex items-center space-x-1">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">A</kbd>
                <span>Approve All</span>
              </div>
              <div className="flex items-center space-x-1">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">R</kbd>
                <span>Reject All</span>
              </div>
            </>
          )}
          <div className="flex items-center space-x-1">
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">M</kbd>
            <span>Auto-Match</span>
          </div>
        </div>
      </div>
    </div>
  )
}