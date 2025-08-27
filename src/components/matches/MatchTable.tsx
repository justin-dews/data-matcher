'use client'

import React, { useState, useMemo, memo, useCallback } from 'react'
import { 
  CheckIcon, 
  XMarkIcon, 
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  QuestionMarkCircleIcon,
  ArrowPathIcon
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
  onResetMatch: (lineItemId: string) => Promise<void>
  onShowPicker: (lineItem: LineItemWithMatch) => void
  processingItems: Set<string>
}

type SortField = 'created_at' | 'confidence' | 'status' | 'name'
type SortDirection = 'asc' | 'desc'

// Memoized Status Icon Component
const StatusIcon = memo(({ status }: { status: string }) => {
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
})
StatusIcon.displayName = 'StatusIcon'

// Memoized Sort Icon Component
const SortIcon = memo(({ field, sortField, sortDirection }: { 
  field: SortField
  sortField: SortField
  sortDirection: SortDirection
}) => {
  if (sortField !== field) {
    return <ChevronUpIcon className="h-4 w-4 text-gray-400" />
  }
  return sortDirection === 'asc' 
    ? <ChevronUpIcon className="h-4 w-4 text-gray-700" />
    : <ChevronDownIcon className="h-4 w-4 text-gray-700" />
})
SortIcon.displayName = 'SortIcon'

// Memoized Line Item Cell Component
const LineItemCell = memo(({ item }: { item: LineItemWithMatch }) => {
  const parsedData = item.parsed_data
  
  // 🔥 CHAMPIONSHIP DEBUGGING: Log the actual data structure
  console.log('🔍 DEBUG LineItemCell data for item:', item.id, {
    parsed_data: parsedData,
    raw_text: item.raw_text,
    parsed_name: parsedData?.name,
    company_name: item.company_name
  })
  
  const displayName = useMemo(() => {
    const name = parsedData?.name || item.raw_text || '[NO DATA]'
    console.log('🎯 DEBUG displayName for', item.id, ':', name)
    return truncateText(name, 60)
  }, [parsedData?.name, item.raw_text, item.id])

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium text-gray-900">
          {displayName}
        </div>
        {parsedData?.sku && (
          <div className="text-xs text-gray-500">
            SKU: {parsedData.sku}
          </div>
        )}
        {parsedData?.manufacturer && (
          <div className="text-xs text-gray-500">
            Mfg: {parsedData.manufacturer}
          </div>
        )}
        {item.company_name && (
          <div className="text-xs text-gray-500">
            Company: {item.company_name}
          </div>
        )}
      </div>
      
      {(parsedData?.quantity || parsedData?.unit_price) && (
        <div className="flex space-x-4 text-xs text-gray-600">
          {parsedData?.quantity && (
            <span>Qty: {parsedData.quantity}</span>
          )}
          {parsedData?.unit_price && (
            <span>Price: {formatCurrency(parsedData.unit_price)}</span>
          )}
        </div>
      )}
    </div>
  )
})
LineItemCell.displayName = 'LineItemCell'

// Memoized Top Match Cell Component
const TopMatchCell = memo(({ 
  item, 
  topCandidate, 
  isProcessing, 
  onToggleExpanded,
  isExpanded
}: { 
  item: LineItemWithMatch
  topCandidate: MatchCandidate | undefined
  isProcessing: boolean
  onToggleExpanded: (itemId: string) => void
  isExpanded: boolean
}) => {
  const currentMatch = item.match
  
  const handleToggleExpanded = useCallback(() => {
    onToggleExpanded(item.id)
  }, [item.id, onToggleExpanded])

  return (
    <div className="space-y-2">
      {currentMatch && item.product ? (
        // Show approved/rejected match
        <div>
          <div className="text-sm font-medium text-gray-900">
            {item.product.name}
          </div>
          <div className="text-xs text-gray-500">
            SKU: {item.product.sku}
          </div>
          {item.product.manufacturer && (
            <div className="text-xs text-gray-500">
              Mfg: {item.product.manufacturer}
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
          onClick={handleToggleExpanded}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
        >
          <QuestionMarkCircleIcon className="h-3 w-3" />
          <span>{isExpanded ? 'Hide' : 'Why?'}</span>
        </button>
      )}
    </div>
  )
})
TopMatchCell.displayName = 'TopMatchCell'

// Memoized Action Buttons Component
const ActionButtons = memo(({ 
  item, 
  topCandidate, 
  candidates, 
  isProcessing, 
  onApproveMatch, 
  onRejectMatch, 
  onResetMatch, 
  onShowPicker 
}: {
  item: LineItemWithMatch
  topCandidate: MatchCandidate | undefined
  candidates: MatchCandidate[]
  isProcessing: boolean
  onApproveMatch: (lineItemId: string, productId: string, candidates: MatchCandidate[]) => Promise<void>
  onRejectMatch: (lineItemId: string) => Promise<void>
  onResetMatch: (lineItemId: string) => Promise<void>
  onShowPicker: (lineItem: LineItemWithMatch) => void
}) => {
  const status = item.match?.status || 'pending'
  
  const handleApprove = useCallback(() => {
    if (topCandidate) {
      onApproveMatch(item.id, topCandidate.product_id, candidates)
    }
  }, [item.id, topCandidate, candidates, onApproveMatch])
  
  const handleReject = useCallback(() => {
    onRejectMatch(item.id)
  }, [item.id, onRejectMatch])
  
  const handleReset = useCallback(() => {
    onResetMatch(item.id)
  }, [item.id, onResetMatch])
  
  const handleShowPicker = useCallback(() => {
    onShowPicker(item)
  }, [item, onShowPicker])

  return (
    <div className="flex items-center space-x-2">
      {status === 'pending' && topCandidate && !isProcessing && (
        <>
          <button
            onClick={handleApprove}
            className="text-green-600 hover:text-green-800"
            title="Approve top match"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleReject}
            className="text-red-600 hover:text-red-800"
            title="Reject match"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </>
      )}
      
      {candidates.length > 1 && !isProcessing && (
        <button
          onClick={handleShowPicker}
          className="text-blue-600 hover:text-blue-800"
          title="View all matches"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      )}
      
      {status === 'rejected' && (
        <button
          onClick={handleReset}
          className="text-blue-600 hover:text-blue-800"
          title="Reset to pending for re-matching"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </button>
      )}
      
      {(status === 'approved' || status === 'auto_matched' || status === 'rejected') && (
        <button
          onClick={handleShowPicker}
          className="text-gray-600 hover:text-gray-800"
          title="Review match"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
})
ActionButtons.displayName = 'ActionButtons'

// Memoized Table Row Component
const TableRow = memo(({ 
  item, 
  candidates, 
  selectedItems, 
  processingItems, 
  expandedRows, 
  onSelectionChange, 
  onApproveMatch, 
  onRejectMatch, 
  onResetMatch, 
  onShowPicker, 
  onToggleExpanded 
}: {
  item: LineItemWithMatch
  candidates: MatchCandidate[]
  selectedItems: string[]
  processingItems: Set<string>
  expandedRows: Set<string>
  onSelectionChange: (items: string[]) => void
  onApproveMatch: (lineItemId: string, productId: string, candidates: MatchCandidate[]) => Promise<void>
  onRejectMatch: (lineItemId: string) => Promise<void>
  onResetMatch: (lineItemId: string) => Promise<void>
  onShowPicker: (lineItem: LineItemWithMatch) => void
  onToggleExpanded: (itemId: string) => void
}) => {
  const topCandidate = candidates[0]
  const isProcessing = processingItems.has(item.id)
  const isExpanded = expandedRows.has(item.id)
  const status = item.match?.status || 'pending'
  const isSelected = selectedItems.includes(item.id)
  
  const handleSelectItem = useCallback(() => {
    const newSelection = isSelected
      ? selectedItems.filter(id => id !== item.id)
      : [...selectedItems, item.id]
    onSelectionChange(newSelection)
  }, [item.id, isSelected, selectedItems, onSelectionChange])

  // Temporarily return single row to test React key issue
  return (
    <tr key={item.id} className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={isSelected}
            onChange={handleSelectItem}
            disabled={isProcessing}
          />
        </td>
        
        <td className="px-6 py-4">
          <LineItemCell item={item} />
        </td>
        
        <td className="px-6 py-4">
          <TopMatchCell 
            item={item}
            topCandidate={topCandidate}
            isProcessing={isProcessing}
            onToggleExpanded={onToggleExpanded}
            isExpanded={isExpanded}
          />
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <StatusIcon status={status} />
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              getStatusColor(status)
            )}>
              {status}
            </span>
          </div>
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap">
          <ActionButtons 
            item={item}
            topCandidate={topCandidate}
            candidates={candidates}
            isProcessing={isProcessing}
            onApproveMatch={onApproveMatch}
            onRejectMatch={onRejectMatch}
            onResetMatch={onResetMatch}
            onShowPicker={onShowPicker}
          />
        </td>
      </tr>
  )
})
TableRow.displayName = 'TableRow'

// Main MatchTable Component with performance optimizations
const MatchTable = memo((props: MatchTableProps) => {
  const {
    lineItems,
    candidates,
    selectedItems,
    onSelectionChange,
    onApproveMatch,
    onRejectMatch,
    onResetMatch,
    onShowPicker,
    processingItems
  } = props

  // 🔥 CHAMPIONSHIP DEBUGGING: Log the props coming in
  console.log('🚀 DEBUG MatchTable received:', {
    lineItems_count: lineItems.length,
    first_item: lineItems[0] ? {
      id: lineItems[0].id,
      raw_text: lineItems[0].raw_text,
      parsed_data: lineItems[0].parsed_data
    } : 'NO ITEMS',
    candidates_keys: Object.keys(candidates)
  })

  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Memoized sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection])

  // Memoized sorted items to prevent re-sorting on every render
  const sortedItems = useMemo(() => {
    return [...lineItems].sort((a, b) => {
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
  }, [lineItems, sortField, sortDirection, candidates])

  // Memoized select all handler
  const handleSelectAll = useCallback(() => {
    if (selectedItems.length === lineItems.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(lineItems.map(item => item.id))
    }
  }, [selectedItems.length, lineItems, onSelectionChange])

  // Memoized toggle expanded handler
  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev)
      if (prev.has(itemId)) {
        newExpanded.delete(itemId)
      } else {
        newExpanded.add(itemId)
      }
      return newExpanded
    })
  }, [])

  // Memoized sort icon handlers
  const handleSortName = useCallback(() => handleSort('name'), [handleSort])
  const handleSortConfidence = useCallback(() => handleSort('confidence'), [handleSort])
  const handleSortStatus = useCallback(() => handleSort('status'), [handleSort])

  // Show loading skeleton for performance
  if (lineItems.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-sm text-gray-500">No line items found</div>
      </div>
    )
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
                onClick={handleSortName}
              >
                <div className="flex items-center space-x-1">
                  <span>Line Item</span>
                  <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={handleSortConfidence}
              >
                <div className="flex items-center space-x-1">
                  <span>Top Match</span>
                  <SortIcon field="confidence" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={handleSortStatus}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedItems.map((item) => (
              <TableRow
                key={item.id}
                item={item}
                candidates={candidates[item.id] || []}
                selectedItems={selectedItems}
                processingItems={processingItems}
                expandedRows={expandedRows}
                onSelectionChange={onSelectionChange}
                onApproveMatch={onApproveMatch}
                onRejectMatch={onRejectMatch}
                onResetMatch={onResetMatch}
                onShowPicker={onShowPicker}
                onToggleExpanded={toggleExpanded}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})
MatchTable.displayName = 'MatchTable'

export default MatchTable