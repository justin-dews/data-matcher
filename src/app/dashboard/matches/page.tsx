'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../providers'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import MatchTable from '@/components/matches/MatchTable'
import BulkActionToolbar from '@/components/matches/BulkActionToolbar'
import ThresholdControl from '@/components/matches/ThresholdControl'
import MatchPickerModal from '@/components/matches/MatchPickerModal'
import { LineItem, Match, MatchCandidate, CONFIG } from '@/lib/utils'
import { ActivityLogger } from '@/lib/activityLogger'

export interface LineItemWithMatch extends LineItem {
  match?: Match
  product?: {
    id: string
    sku: string
    name: string
    manufacturer: string | null
  }
  candidates?: MatchCandidate[]
}

export default function MatchesPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [lineItems, setLineItems] = useState<LineItemWithMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [autoMatchThreshold, setAutoMatchThreshold] = useState<number>(CONFIG.MATCHING.AUTO_APPROVE_THRESHOLD)
  const [showPickerModal, setShowPickerModal] = useState(false)
  const [activeLineItem, setActiveLineItem] = useState<LineItemWithMatch | null>(null)
  const [candidateCache, setCandidateCache] = useState<Record<string, MatchCandidate[]>>({})
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set())

  // Load line items with their current matches
  const loadLineItems = useCallback(async () => {
    if (!user || !profile || authLoading) return

    setLoading(true)
    setError(null)

    try {
      const organizationId = profile.organization_id

      // Get line items with existing matches
      const { data, error: fetchError } = await supabase
        .from('line_items')
        .select(`
          *,
          match:matches(
            *,
            product:products(
              id,
              sku,
              name,
              manufacturer
            )
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (fetchError) throw fetchError

      const itemsWithMatches = data?.map(item => ({
        ...item,
        match: item.match?.[0] || null,
        product: item.match?.[0]?.product || null
      })) as LineItemWithMatch[]

      setLineItems(itemsWithMatches || [])
    } catch (err) {
      console.error('Error loading line items:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [user, profile, authLoading])

  // Generate match candidates for a line item
  const generateMatchCandidates = useCallback(async (lineItem: LineItem): Promise<MatchCandidate[]> => {
    if (!user || !profile) return []

    try {
      // Get the text to match (prioritize parsed name, fallback to raw text)
      const matchText = lineItem.parsed_data?.name || lineItem.raw_text
      
      console.log(`🔍 Generating matches for: "${matchText}"`)
      
      // Call the hybrid matching function (RLS-compatible version)
      const { data, error } = await supabase.rpc('hybrid_product_match', {
        query_text: matchText,
        limit_count: 5,
        threshold: CONFIG.MATCHING.CONFIDENCE_THRESHOLD
      })

      if (error) {
        console.error('❌ RPC Error:', error)
        throw error
      }

      console.log(`✅ Found ${data?.length || 0} matches for: "${matchText}"`)
      return data || []
    } catch (err) {
      console.error('Error generating match candidates:', err)
      return []
    }
  }, [user, profile])

  // Handle match approval
  const handleMatchApproval = useCallback(async (lineItemId: string, productId: string, candidates: MatchCandidate[]) => {
    if (!user || !profile) return

    const organizationId = profile.organization_id

    setProcessingItems(prev => new Set([...prev, lineItemId]))

    try {
      const candidate = candidates.find(c => c.product_id === productId)
      if (!candidate) throw new Error('Candidate not found')

      // Create or update the match
      const { error } = await supabase
        .from('matches')
        .upsert({
          line_item_id: lineItemId,
          product_id: productId,
          organization_id: organizationId,
          status: 'approved',
          confidence_score: candidate.final_score,
          vector_score: candidate.vector_score,
          trigram_score: candidate.trigram_score,
          fuzzy_score: candidate.fuzzy_score,        // NEW: Added fuzzy score
          alias_score: candidate.alias_score,
          final_score: candidate.final_score,
          matched_text: candidate.name,
          reasoning: `Matched via ${candidate.matched_via}`,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        }, {
          onConflict: 'line_item_id'
        })

      if (error) throw error

      // Create competitor alias for learning system
      const lineItem = lineItems.find(item => item.id === lineItemId)
      if (lineItem && (lineItem.parsed_data?.name || lineItem.company_name)) {
        try {
          const competitorName = lineItem.parsed_data?.name || lineItem.raw_text
          const competitorSku = lineItem.parsed_data?.sku || null
          const companyName = lineItem.company_name || null

          // Only create alias if we have meaningful data
          if (competitorName.trim().length > 3) {
            await supabase
              .from('competitor_aliases')
              .upsert({
                organization_id: organizationId,
                product_id: productId,
                competitor_name: competitorName.trim(),
                competitor_sku: competitorSku,
                confidence_score: Math.min(candidate.final_score, 1.0), // Ensure it's ≤ 1.0
                created_by: user.id,
              }, {
                onConflict: 'organization_id,competitor_name,competitor_sku',
                ignoreDuplicates: false // Update if exists with higher confidence
              })

            console.log('✅ Created competitor alias:', {
              competitorName,
              competitorSku,
              companyName,
              productId,
              confidence: candidate.final_score
            })
          }
        } catch (aliasError) {
          console.warn('⚠️ Could not create competitor alias:', aliasError)
          // Don't fail the match approval if alias creation fails
        }
      }

      // Log the activity
      await ActivityLogger.logMatchAction(
        organizationId,
        user.id,
        'match_approved',
        lineItemId, // This will be the match ID after upsert
        {
          lineItemId,
          productId,
          confidenceScore: candidate.final_score,
          reasoning: `Matched via ${candidate.matched_via}`
        }
      )

      // Reload data to reflect changes
      await loadLineItems()
    } catch (err) {
      console.error('Error approving match:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev)
        next.delete(lineItemId)
        return next
      })
    }
  }, [user?.id, loadLineItems])

  // Handle match rejection
  const handleMatchRejection = useCallback(async (lineItemId: string) => {
    if (!user || !profile) return

    const organizationId = profile.organization_id

    setProcessingItems(prev => new Set([...prev, lineItemId]))

    try {
      const { error } = await supabase
        .from('matches')
        .upsert({
          line_item_id: lineItemId,
          product_id: null,
          organization_id: organizationId,
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        }, {
          onConflict: 'line_item_id'
        })

      if (error) throw error

      // Log the activity
      await ActivityLogger.logMatchAction(
        organizationId,
        user.id,
        'match_rejected',
        lineItemId, // This will be the match ID after upsert
        {
          lineItemId
        }
      )

      await loadLineItems()
    } catch (err) {
      console.error('Error rejecting match:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev)
        next.delete(lineItemId)
        return next
      })
    }
  }, [user?.id, loadLineItems])

  // Handle bulk operations
  const handleBulkApproval = useCallback(async () => {
    if (!user || !profile || selectedItems.length === 0) return

    const organizationId = profile.organization_id

    const approvePromises = selectedItems.map(async (itemId) => {
      const lineItem = lineItems.find(li => li.id === itemId)
      if (!lineItem) return

      const candidates = candidateCache[itemId] || await generateMatchCandidates(lineItem)
      if (candidates.length > 0) {
        await handleMatchApproval(itemId, candidates[0].product_id, candidates)
      }
    })

    await Promise.allSettled(approvePromises)
    
    // Log bulk approval activity
    await ActivityLogger.logBulkMatchAction(
      organizationId,
      user.id,
      'match_bulk_approved',
      selectedItems,
      {
        count: selectedItems.length,
        action_type: 'bulk_approve'
      }
    )
    
    setSelectedItems([])
  }, [user, selectedItems, lineItems, candidateCache, generateMatchCandidates, handleMatchApproval])

  const handleBulkRejection = useCallback(async () => {
    if (selectedItems.length === 0) return

    const rejectPromises = selectedItems.map(itemId => handleMatchRejection(itemId))
    await Promise.allSettled(rejectPromises)
    
    if (!profile) return
    // Log bulk rejection activity
    const organizationId = profile.organization_id
    await ActivityLogger.logBulkMatchAction(
      organizationId,
      user.id,
      'match_bulk_rejected',
      selectedItems,
      {
        count: selectedItems.length,
        action_type: 'bulk_reject'
      }
    )
    
    setSelectedItems([])
  }, [selectedItems, handleMatchRejection, user, profile])

  // Auto-match based on threshold
  const handleAutoMatch = useCallback(async () => {
    if (!user || !profile) return

    const organizationId = profile.organization_id

    const pendingItems = lineItems.filter(item => 
      !item.match || item.match.status === 'pending'
    )

    let autoMatchedCount = 0
    const autoMatchedItems: string[] = []

    for (const item of pendingItems) {
      const candidates = candidateCache[item.id] || await generateMatchCandidates(item)
      setCandidateCache(prev => ({ ...prev, [item.id]: candidates }))

      if (candidates.length > 0 && candidates[0].final_score >= autoMatchThreshold) {
        await handleMatchApproval(item.id, candidates[0].product_id, candidates)
        autoMatchedCount++
        autoMatchedItems.push(item.id)
      }
    }

    // Log the auto-match activity
    if (autoMatchedCount > 0) {
      await ActivityLogger.log({
        organizationId: organizationId,
        userId: user.id,
        action: 'auto_match_run',
        resourceType: 'match',
        metadata: {
          threshold: autoMatchThreshold,
          total_pending: pendingItems.length,
          auto_matched_count: autoMatchedCount,
          matched_items: autoMatchedItems
        }
      })
    }
  }, [user?.id, lineItems, candidateCache, generateMatchCandidates, autoMatchThreshold, handleMatchApproval])

  // Show picker modal for ambiguous matches
  const handleShowPicker = async (lineItem: LineItemWithMatch) => {
    setActiveLineItem(lineItem)
    
    if (!candidateCache[lineItem.id]) {
      const candidates = await generateMatchCandidates(lineItem)
      setCandidateCache(prev => ({ ...prev, [lineItem.id]: candidates }))
    }
    
    setShowPickerModal(true)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not in an input field
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return
      }

      switch (event.key.toLowerCase()) {
        case 'a':
          if (selectedItems.length > 0) {
            event.preventDefault()
            handleBulkApproval()
          }
          break
        case 'r':
          if (selectedItems.length > 0) {
            event.preventDefault()
            handleBulkRejection()
          }
          break
        case 'm':
          event.preventDefault()
          handleAutoMatch()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedItems.length, handleBulkApproval, handleBulkRejection, handleAutoMatch])

  // Initialize data loading
  useEffect(() => {
    if (user) {
      loadLineItems()
    }
  }, [user, loadLineItems])

  // Preload candidates for visible items
  useEffect(() => {
    const loadCandidates = async () => {
      const itemsNeedingCandidates = lineItems
        .filter(item => !candidateCache[item.id] && (!item.match || item.match.status === 'pending'))
        .slice(0, 50) // Load candidates for first 50 items

      for (const item of itemsNeedingCandidates) {
        const candidates = await generateMatchCandidates(item)
        setCandidateCache(prev => ({ ...prev, [item.id]: candidates }))
      }
    }

    if (lineItems.length > 0) {
      loadCandidates()
    }
  }, [lineItems, generateMatchCandidates])

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
              Error loading matches
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => loadLineItems()}
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Matching Review</h1>
        <p className="mt-2 text-sm text-gray-700">
          Review and approve product matches for imported line items
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <BulkActionToolbar
            selectedCount={selectedItems.length}
            onApproveAll={handleBulkApproval}
            onRejectAll={handleBulkRejection}
            onAutoMatch={handleAutoMatch}
            disabled={processingItems.size > 0}
          />
        </div>
        
        <ThresholdControl
          value={autoMatchThreshold}
          onChange={setAutoMatchThreshold}
        />
      </div>

      {/* Main Table */}
      <div className="bg-white shadow rounded-lg">
        <MatchTable
          lineItems={lineItems}
          candidates={candidateCache}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          onApproveMatch={handleMatchApproval}
          onRejectMatch={handleMatchRejection}
          onShowPicker={handleShowPicker}
          processingItems={processingItems}
        />
      </div>

      {/* Match Picker Modal */}
      {showPickerModal && activeLineItem && (
        <MatchPickerModal
          lineItem={activeLineItem}
          candidates={candidateCache[activeLineItem.id] || []}
          onSelect={async (productId) => {
            await handleMatchApproval(activeLineItem.id, productId, candidateCache[activeLineItem.id] || [])
            setShowPickerModal(false)
            setActiveLineItem(null)
          }}
          onReject={async () => {
            await handleMatchRejection(activeLineItem.id)
            setShowPickerModal(false)
            setActiveLineItem(null)
          }}
          onClose={() => {
            setShowPickerModal(false)
            setActiveLineItem(null)
          }}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Total Items</div>
          <div className="text-2xl font-bold text-gray-900">{lineItems.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            {lineItems.filter(item => !item.match || item.match.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Approved</div>
          <div className="text-2xl font-bold text-green-600">
            {lineItems.filter(item => item.match?.status === 'approved' || item.match?.status === 'auto_matched').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Rejected</div>
          <div className="text-2xl font-bold text-red-600">
            {lineItems.filter(item => item.match?.status === 'rejected').length}
          </div>
        </div>
      </div>
    </div>
  )
}