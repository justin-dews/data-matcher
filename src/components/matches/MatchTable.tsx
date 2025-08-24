'use client'

import { useState } from 'react'
import { 
  CheckIcon, 
  XMarkIcon, 
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/solid'
import { LineItemWithMatch } from '@/app/dashboard/matches/page'
import { MatchCandidate, formatCurrency, formatPercent, getStatusColor, truncateText, cn } from '@/lib/utils'
import ConfidenceScoreBreakdown from './ConfidenceScoreBreakdown'

interface MatchTableProps {
  lineItems: LineItemWithMatch[]
  candidates: Record<string, MatchCandidate[]>
  selectedItems: string[]
  onSelectionChange: (items: string[]) => void
  onApproveMatch: (lineItemId: string, productId: string, candidates: MatchCandidate[]) => Promise<void>
  onRejectMatch: (lineItemId: string) => Promise<void>
  onShowPicker: (lineItem: LineItemWithMatch) => void
  processingItems: Set<string>
}

type SortField = 'created_at' | 'confidence' | 'status' | 'name'
type SortDirection = 'asc' | 'desc'

export default function MatchTable({
  lineItems,
  candidates,
  selectedItems,
  onSelectionChange,
  onApproveMatch,
  onRejectMatch,
  onShowPicker,
  processingItems
}: MatchTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Sort line items
  const sortedItems = [...lineItems].sort((a, b) => {
    let aValue: string | number | Date
    let bValue: string | number | Date

    switch (sortField) {
      case 'created_at':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      case 'confidence':
        aValue = a.match?.final_score || (candidates[a.id]?.[0]?.final_score || 0)
        bValue = b.match?.final_score || (candidates[b.id]?.[0]?.final_score || 0)
        break
      case 'status':
        aValue = a.match?.status || 'pending'
        bValue = b.match?.status || 'pending'
        break
      case 'name':
        aValue = a.parsed_data?.name || a.raw_text
        bValue = b.parsed_data?.name || b.raw_text
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Handle row selection
  const handleSelectAll = () => {
    if (selectedItems.length === lineItems.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(lineItems.map(item => item.id))
    }
  }

  const handleSelectItem = (itemId: string) => {
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId]
    onSelectionChange(newSelection)
  }

  // Toggle expanded row
  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedRows)
    if (expandedRows.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedRows(newExpanded)
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'auto_matched':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'pending':
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
    }
  }

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUpIcon className="h-4 w-4 text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 text-gray-700" />
      : <ChevronDownIcon className="h-4 w-4 text-gray-700" />
  }

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedItems.length === lineItems.length && lineItems.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Line Item</span>
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('confidence')}
              >
                <div className="flex items-center space-x-1">
                  <span>Top Match</span>
                  <SortIcon field="confidence" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  <SortIcon field="status" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedItems.map((item) => {
              const topCandidate = candidates[item.id]?.[0]
              const isProcessing = processingItems.has(item.id)
              const isExpanded = expandedRows.has(item.id)
              const currentMatch = item.match
              const status = currentMatch?.status || 'pending'
              
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      disabled={isProcessing}
                    />
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {truncateText(item.parsed_data?.name || item.raw_text, 60)}
                        </div>
                        {item.parsed_data?.sku && (
                          <div className="text-xs text-gray-500">
                            SKU: {item.parsed_data.sku}
                          </div>
                        )}
                        {item.parsed_data?.manufacturer && (
                          <div className="text-xs text-gray-500">
                            Mfg: {item.parsed_data.manufacturer}
                          </div>
                        )}
                        {item.company_name && (
                          <div className="text-xs text-gray-500">
                            Company: {item.company_name}
                          </div>
                        )}
                      </div>
                      
                      {(item.parsed_data?.quantity || item.parsed_data?.unit_price) && (
                        <div className="flex space-x-4 text-xs text-gray-600">
                          {item.parsed_data?.quantity && (
                            <span>Qty: {item.parsed_data.quantity}</span>
                          )}
                          {item.parsed_data?.unit_price && (
                            <span>Price: {formatCurrency(item.parsed_data.unit_price)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {currentMatch?.product ? (
                        // Show approved/rejected match
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {currentMatch.product.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            SKU: {currentMatch.product.sku}
                          </div>
                          {currentMatch.product.manufacturer && (
                            <div className="text-xs text-gray-500">
                              Mfg: {currentMatch.product.manufacturer}
                            </div>
                          )}
                          {currentMatch.final_score && (
                            <div className="text-xs font-medium text-green-600">
                              {formatPercent(currentMatch.final_score)} confidence
                            </div>
                          )}
                        </div>
                      ) : topCandidate ? (
                        // Show top candidate for pending items
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {topCandidate.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            SKU: {topCandidate.sku}
                          </div>
                          {topCandidate.manufacturer && (
                            <div className="text-xs text-gray-500">
                              Mfg: {topCandidate.manufacturer}
                            </div>
                          )}
                          <div className="text-xs font-medium text-blue-600">
                            {formatPercent(topCandidate.final_score)} confidence
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {isProcessing ? 'Finding matches...' : 'No matches found'}
                        </div>
                      )}
                      
                      {/* Show breakdown button for matches with scores */}
                      {(topCandidate || currentMatch?.final_score) && (
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <QuestionMarkCircleIcon className="h-3 w-3" />
                          <span>{isExpanded ? 'Hide' : 'Why?'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(status)}
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getStatusColor(status)
                      )}>
                        {status}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {status === 'pending' && topCandidate && !isProcessing && (
                        <>
                          <button
                            onClick={() => onApproveMatch(item.id, topCandidate.product_id, candidates[item.id] || [])}
                            className="text-green-600 hover:text-green-800"
                            title="Approve top match"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onRejectMatch(item.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Reject match"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      
                      {candidates[item.id]?.length > 1 && !isProcessing && (
                        <button
                          onClick={() => onShowPicker(item)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View all matches"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      )}
                      
                      {(status === 'approved' || status === 'auto_matched' || status === 'rejected') && (
                        <button
                          onClick={() => onShowPicker(item)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Review match"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            
            {/* Expanded rows for score breakdown */}
            {sortedItems.map((item) => {
              if (!expandedRows.has(item.id)) return null
              
              const topCandidate = candidates[item.id]?.[0]
              const currentMatch = item.match
              
              return (
                <tr key={`${item.id}-expanded`} className="bg-gray-50">
                  <td colSpan={5} className="px-6 py-4">
                    <ConfidenceScoreBreakdown
                      candidate={topCandidate}
                      match={currentMatch}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {lineItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-sm text-gray-500">No line items found</div>
        </div>
      )}
    </div>
  )
}