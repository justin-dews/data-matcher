'use client'

import { TrashIcon, XMarkIcon, TagIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

interface BulkActionToolbarProps {
  selectedCount: number
  onBulkDelete: () => void
  onClearSelection: () => void
  onBulkExport?: () => void
  onBulkTag?: (tag: string) => void
}

export default function BulkActionToolbar({
  selectedCount,
  onBulkDelete,
  onClearSelection,
  onBulkExport,
  onBulkTag
}: BulkActionToolbarProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag] = useState('')

  const handleDelete = () => {
    if (showConfirmDelete) {
      onBulkDelete()
      setShowConfirmDelete(false)
    } else {
      setShowConfirmDelete(true)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && onBulkTag) {
      onBulkTag(newTag.trim())
      setNewTag('')
      setShowTagInput(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium text-blue-900">
            {selectedCount} product{selectedCount === 1 ? '' : 's'} selected
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Export */}
            {onBulkExport && (
              <button
                type="button"
                onClick={onBulkExport}
                className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Export
              </button>
            )}

            {/* Add Tag */}
            {onBulkTag && (
              <div className="relative">
                {showTagInput ? (
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag()
                        } else if (e.key === 'Escape') {
                          setShowTagInput(false)
                          setNewTag('')
                        }
                      }}
                      placeholder="Tag name..."
                      className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="p-1 text-green-600 hover:text-green-700"
                    >
                      <TagIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTagInput(false)
                        setNewTag('')
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTagInput(true)}
                    className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <TagIcon className="h-4 w-4 mr-1" />
                    Add Tag
                  </button>
                )}
              </div>
            )}

            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              className={`inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 ${
                showConfirmDelete
                  ? 'border-red-600 text-white bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'border-red-300 text-red-700 bg-white hover:bg-red-50 focus:ring-red-500'
              }`}
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              {showConfirmDelete ? `Delete ${selectedCount}?` : 'Delete'}
            </button>

            {showConfirmDelete && (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Clear Selection */}
        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center text-sm text-blue-700 hover:text-blue-900"
        >
          <XMarkIcon className="h-4 w-4 mr-1" />
          Clear selection
        </button>
      </div>
    </div>
  )
}