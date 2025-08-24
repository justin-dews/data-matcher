'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  XMarkIcon, 
  CheckIcon, 
  StarIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { LineItemWithMatch } from '@/app/dashboard/matches/page'
import { MatchCandidate, formatPercent, truncateText, cn } from '@/lib/utils'
import ConfidenceScoreBreakdown from './ConfidenceScoreBreakdown'

interface MatchPickerModalProps {
  lineItem: LineItemWithMatch
  candidates: MatchCandidate[]
  onSelect: (productId: string) => void
  onReject: () => void
  onClose: () => void
}

export default function MatchPickerModal({
  lineItem,
  candidates,
  onSelect,
  onReject,
  onClose
}: MatchPickerModalProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    candidates[0]?.product_id || null
  )
  const [showBreakdown, setShowBreakdown] = useState<string | null>(null)

  const handleSelect = useCallback(() => {
    if (selectedCandidate) {
      onSelect(selectedCandidate)
    }
  }, [selectedCandidate, onSelect])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          onClose()
          break
        case 'Enter':
          if (selectedCandidate) {
            handleSelect()
          }
          break
        case 'r':
        case 'R':
          onReject()
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          const index = parseInt(event.key) - 1
          if (candidates[index]) {
            setSelectedCandidate(candidates[index].product_id)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedCandidate, candidates, onClose, onReject, handleSelect])

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    if (score >= 0.4) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <StarIconSolid className="h-4 w-4 text-yellow-400" />
      case 1:
        return <StarIcon className="h-4 w-4 text-gray-400" />
      case 2:
        return <StarIcon className="h-4 w-4 text-gray-300" />
      default:
        return <span className="text-xs text-gray-400">#{index + 1}</span>
    }
  }

  return (
    <Transition appear show as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Select Product Match
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose the best match for this line item, or reject if none are suitable.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Line Item Details */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Line Item to Match
                      </h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-900">
                            {lineItem.parsed_data?.name || truncateText(lineItem.raw_text, 100)}
                          </div>
                          
                          {lineItem.parsed_data?.sku && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">SKU:</span> {lineItem.parsed_data.sku}
                            </div>
                          )}
                          
                          {lineItem.parsed_data?.manufacturer && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Manufacturer:</span> {lineItem.parsed_data.manufacturer}
                            </div>
                          )}
                          
                          <div className="flex space-x-4 text-sm text-gray-600">
                            {lineItem.parsed_data?.quantity && (
                              <span>
                                <span className="font-medium">Qty:</span> {lineItem.parsed_data.quantity}
                              </span>
                            )}
                            {lineItem.parsed_data?.unit_price && (
                              <span>
                                <span className="font-medium">Price:</span> ${lineItem.parsed_data.unit_price}
                              </span>
                            )}
                          </div>
                          
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View raw text
                            </summary>
                            <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-700">
                              {lineItem.raw_text}
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>

                    {/* Current Selection Details */}
                    {selectedCandidate && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          Selected Match Details
                        </h4>
                        {showBreakdown === selectedCandidate ? (
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <button
                              onClick={() => setShowBreakdown(null)}
                              className="text-sm text-blue-600 hover:text-blue-800 mb-3"
                            >
                              ← Back to match list
                            </button>
                            <ConfidenceScoreBreakdown
                              candidate={candidates.find(c => c.product_id === selectedCandidate)}
                            />
                          </div>
                        ) : (
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-sm text-blue-800">
                              Click &quot;Why?&quot; next to a match to see detailed scoring breakdown
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Match Candidates */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">
                      Match Candidates ({candidates.length})
                    </h4>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {candidates.map((candidate, index) => (
                        <div
                          key={candidate.product_id}
                          className={cn(
                            'p-4 rounded-lg border-2 cursor-pointer transition-all',
                            selectedCandidate === candidate.product_id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          )}
                          onClick={() => setSelectedCandidate(candidate.product_id)}
                        >
                          <div className="space-y-3">
                            {/* Header with rank and confidence */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {getRankIcon(index)}
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="radio"
                                    checked={selectedCandidate === candidate.product_id}
                                    onChange={() => setSelectedCandidate(candidate.product_id)}
                                    className="text-blue-600 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                              
                              <div className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium border',
                                getConfidenceColor(candidate.final_score)
                              )}>
                                {formatPercent(candidate.final_score)}
                              </div>
                            </div>

                            {/* Product details */}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {candidate.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                SKU: {candidate.sku}
                              </div>
                              {candidate.manufacturer && (
                                <div className="text-sm text-gray-600">
                                  Mfg: {candidate.manufacturer}
                                </div>
                              )}
                            </div>

                            {/* Match method and scores */}
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-gray-500">
                                Matched via: <span className="capitalize font-medium">{candidate.matched_via}</span>
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setShowBreakdown(
                                    showBreakdown === candidate.product_id 
                                      ? null 
                                      : candidate.product_id
                                  )
                                  setSelectedCandidate(candidate.product_id)
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                              >
                                <InformationCircleIcon className="h-3 w-3" />
                                <span>Why?</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {candidates.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-sm">No match candidates found</div>
                        <div className="text-xs mt-1">
                          This line item couldn&apos;t be matched to any products in your catalog
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-6 mt-6 border-t border-gray-200">
                  <button
                    onClick={onReject}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    Reject All Matches
                  </button>

                  <div className="flex space-x-3">
                    <button
                      onClick={onClose}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={handleSelect}
                      disabled={!selectedCandidate}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Approve Selected Match
                    </button>
                  </div>
                </div>

                {/* Keyboard shortcuts */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Keyboard shortcuts:</span>
                    <span className="ml-2">
                      <kbd className="px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs">1-9</kbd> Select candidate
                      <kbd className="ml-2 px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs">Enter</kbd> Approve
                      <kbd className="ml-2 px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs">R</kbd> Reject
                      <kbd className="ml-2 px-1 py-0.5 bg-gray-200 border border-gray-300 rounded text-xs">Esc</kbd> Cancel
                    </span>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}