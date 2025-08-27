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
import { getMatchStatistics } from '@/lib/db-optimizations'

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
  const [loadingCandidates, setLoadingCandidates] = useState<Set<string>>(new Set())
  
  // Clear cache when threshold changes or on demand
  const clearMatchCache = useCallback(() => {
    setCandidateCache({})
    console.log('🔄 Match cache cleared - will regenerate with new threshold')
  }, [])
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set())

  // Load line items with their current matches using optimized batch query
  const loadLineItems = useCallback(async () => {
    if (!user || !profile || authLoading) return

    setLoading(true)
    setError(null)

    try {
      const organizationId = profile.organization_id
      const startTime = performance.now()

      // 🚀 Use optimized single-query approach to eliminate N+1 pattern
      console.log('📊 Loading line items for organization:', organizationId)
      // Temporarily force fallback due to field mapping issues
      const fetchError = new Error('Forcing fallback path')
      
      if (fetchError) {
        console.error('❌ Optimized query failed, falling back to standard query:', fetchError)
        console.error('❌ Error details:', fetchError)
        
        // Fallback to standard query but with better structure
        console.log('🔄 Using fallback query for organization:', organizationId)
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('line_items')
          .select(`
            id,
            raw_text,
            parsed_data,
            company_name,
            created_at,
            document_id,
            line_number,
            quantity,
            unit_price,
            total_price,
            organization_id,
            matches!left (
              id,
              product_id,
              status,
              confidence_score,
              final_score,
              matched_text,
              reasoning,
              created_at,
              updated_at,
              products (
                id,
                sku,
                name,
                manufacturer,
                category
              )
            )
          `)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(100)
          
        if (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError)
          throw fallbackError
        }
        
        console.log(`✅ Fallback query success: ${fallbackData?.length || 0} line items found`)
        console.log('📋 Sample fallback data:', fallbackData?.[0] ? {
          id: fallbackData[0].id,
          raw_text: fallbackData[0].raw_text?.substring(0, 50),
          matches_count: fallbackData[0].matches?.length || 0
        } : 'No data')
        
        const itemsWithMatches = fallbackData?.map(item => ({
          ...item,
          match: item.matches?.[0] || null,
          product: item.matches?.[0]?.products || null
        })) as LineItemWithMatch[]
        
        console.log(`🎯 Final line items with matches: ${itemsWithMatches?.length || 0}`)
        setLineItems(itemsWithMatches || [])
      } else {
        // 🎯 Transform optimized query results
        const itemsWithMatches = data?.map((row: any) => ({
          id: row.line_item_id,
          raw_text: row.line_item_raw_text,
          parsed_data: row.line_item_parsed_data,
          company_name: row.line_item_company_name,
          created_at: row.line_item_created_at,
          organization_id: organizationId,
          match: row.match_id ? {
            id: row.match_id,
            product_id: row.match_product_id,
            status: row.match_status,
            final_score: row.match_final_score,
            matched_text: row.match_matched_text,
            reasoning: row.match_reasoning
          } : null,
          product: row.product_sku ? {
            id: row.match_product_id,
            sku: row.product_sku,
            name: row.product_name,
            manufacturer: row.product_manufacturer,
            category: row.product_category
          } : null
        })) as LineItemWithMatch[]
        
        setLineItems(itemsWithMatches || [])
        
        const endTime = performance.now()
        const executionTime = Math.round(endTime - startTime)
        
        console.log(`🚀 Optimized query completed in ${executionTime}ms for ${itemsWithMatches?.length || 0} items`)
        
        // Performance metrics logged to console
        if (itemsWithMatches?.length) {
          console.log(`📊 Performance: ${executionTime}ms for ${itemsWithMatches.length} items`)
        }
      }
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
      
      // Call the NEW tiered hybrid matching function (training data takes priority)
      const { data, error } = await supabase.rpc('hybrid_product_match_tiered', {
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

  // Load candidates on-demand for better performance
  const loadCandidatesOnDemand = useCallback(async (itemId: string): Promise<MatchCandidate[]> => {
    if (candidateCache[itemId]) {
      return candidateCache[itemId]
    }

    const item = lineItems.find(i => i.id === itemId)
    if (!item) return []

    try {
      const candidates = await generateMatchCandidates(item)
      setCandidateCache(prev => ({ ...prev, [itemId]: candidates }))
      return candidates
    } catch (error) {
      console.error(`❌ Failed to load candidates for item ${itemId}:`, error)
      return []
    }
  }, [candidateCache, lineItems, generateMatchCandidates])

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
          fuzzy_score: candidate.fuzzy_score,        // Added fuzzy score
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

      // Store training data for machine learning enhancement
      if (lineItem) {
        try {
          // Get product details for the training data
          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('sku, name, manufacturer, category')
            .eq('id', productId)
            .single()

          if (!productError && productData) {
            const lineItemText = lineItem.parsed_data?.name || lineItem.raw_text
            const normalizedText = lineItemText.toLowerCase().trim().replace(/\s+/g, ' ')
            
            // Determine match quality based on confidence score
            let matchQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good'
            if (candidate.final_score >= 0.9) matchQuality = 'excellent'
            else if (candidate.final_score >= 0.7) matchQuality = 'good'
            else if (candidate.final_score >= 0.5) matchQuality = 'fair'
            else matchQuality = 'poor'

            await supabase
              .from('match_training_data')
              .insert({
                organization_id: organizationId,
                line_item_id: lineItemId,
                line_item_text: lineItemText,
                line_item_normalized: normalizedText,
                matched_product_id: productId,
                product_sku: productData.sku,
                product_name: productData.name,
                product_manufacturer: productData.manufacturer,
                product_category: productData.category,
                trigram_score: candidate.trigram_score,
                fuzzy_score: candidate.fuzzy_score,
                alias_score: candidate.alias_score,
                final_score: candidate.final_score,
                match_quality: matchQuality,
                match_confidence: candidate.final_score,
                approved_by: user.id,
                approved_at: new Date().toISOString(),
                training_weight: 1.0
              })

            console.log('✅ Created training data:', {
              lineItemText: lineItemText,
              productName: productData.name,
              matchQuality,
              confidence: candidate.final_score
            })
          }
        } catch (trainingError) {
          console.warn('⚠️ Could not create training data:', trainingError)
          // Don't fail the match approval if training data creation fails
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
      // First check if a match already exists for this line item
      const { data: existingMatch, error: checkError } = await supabase
        .from('matches')
        .select('id')
        .eq('line_item_id', lineItemId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // Error other than "not found"
        throw checkError
      }

      if (existingMatch) {
        // Update existing match
        const { error: updateError } = await supabase
          .from('matches')
          .update({
            product_id: null,
            status: 'rejected' as any,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', existingMatch.id)
        
        if (updateError) throw updateError
      } else {
        // Create new match
        const { error: insertError } = await supabase
          .from('matches')
          .insert({
            line_item_id: lineItemId,
            product_id: null,
            organization_id: organizationId,
            status: 'rejected' as any,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
        
        if (insertError) throw insertError
      }

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

  // Handle reset rejected match back to pending
  const handleMatchReset = useCallback(async (lineItemId: string) => {
    if (!user || !profile) return

    const organizationId = profile.organization_id

    setProcessingItems(prev => new Set([...prev, lineItemId]))

    try {
      // Find existing rejected match
      const { data: existingMatch, error: checkError } = await supabase
        .from('matches')
        .select('id')
        .eq('line_item_id', lineItemId)
        .eq('status', 'rejected')
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingMatch) {
        // Update to pending status
        const { error: updateError } = await supabase
          .from('matches')
          .update({
            status: 'pending' as any,
            product_id: null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', existingMatch.id)
        
        if (updateError) throw updateError
      } else {
        // Create new pending match if none exists
        const { error: insertError } = await supabase
          .from('matches')
          .insert({
            line_item_id: lineItemId,
            product_id: null,
            organization_id: organizationId,
            status: 'pending' as any,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString()
          })
        
        if (insertError) throw insertError
      }

      // Log the activity
      await ActivityLogger.logMatchAction(
        organizationId,
        user.id,
        'match_reset_to_pending',
        lineItemId,
        {
          lineItemId,
          previousStatus: 'rejected'
        }
      )

      // Clear the candidate cache for this item so new matches will be generated
      setCandidateCache(prev => {
        const updated = { ...prev }
        delete updated[lineItemId]
        return updated
      })

      await loadLineItems()
    } catch (err) {
      console.error('Error resetting match:', err)
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


  const handleBulkReset = useCallback(async () => {
    if (selectedItems.length === 0) return

    const resetPromises = selectedItems.map(itemId => handleMatchReset(itemId))
    await Promise.allSettled(resetPromises)
    
    if (!profile) return
    // Log bulk reset activity
    const organizationId = profile.organization_id
    await ActivityLogger.logBulkMatchAction(
      organizationId,
      user?.id || '',
      'match_bulk_reset' as any,
      selectedItems,
      {
        count: selectedItems.length,
        action_type: 'bulk_reset'
      }
    )
    
    setSelectedItems([])
  }, [selectedItems, handleMatchReset, user, profile])

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
  }, [user?.id, lineItems, loadCandidatesOnDemand, autoMatchThreshold, handleMatchApproval])

  // Show picker modal for ambiguous matches
  const handleShowPicker = useCallback(async (lineItem: LineItemWithMatch) => {
    // Load candidates on-demand when picker is opened
    if (!candidateCache[lineItem.id] && !loadingCandidates.has(lineItem.id)) {
      setLoadingCandidates(prev => new Set([...prev, lineItem.id]))
      loadCandidatesOnDemand(lineItem.id).finally(() => {
        setLoadingCandidates(prev => {
          const newSet = new Set(prev)
          newSet.delete(lineItem.id)
          return newSet
        })
      })
    }
    
    // Show picker immediately - candidates will load async
    setActiveLineItem(lineItem)
    setShowPickerModal(true)
  }, [candidateCache, loadingCandidates, loadCandidatesOnDemand])

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

  // 🚀 Optimized candidate preloading with batch processing
  useEffect(() => {
    const loadCandidatesOptimized = async () => {
      const itemsNeedingCandidates = lineItems
        .filter(item => !candidateCache[item.id] && (!item.match || item.match.status === 'pending'))
        .slice(0, 50) // Load candidates for first 50 items

      if (itemsNeedingCandidates.length === 0) return

      console.log(`🔄 Optimized candidate loading for ${itemsNeedingCandidates.length} items`)
      const startTime = performance.now()
      
      try {
        // 🎯 Use the optimized batch candidate generation from db-optimizations
        const { getMatchCandidatesBatch } = await import('@/lib/db-optimizations')
        const batchCandidates = await getMatchCandidatesBatch(
          itemsNeedingCandidates,
          CONFIG.MATCHING.CONFIDENCE_THRESHOLD
        )
        
        // Update cache with all results at once
        setCandidateCache(prev => ({
          ...prev,
          ...batchCandidates
        }))
        
        const endTime = performance.now()
        const executionTime = Math.round(endTime - startTime)
        const totalCandidates = Object.values(batchCandidates).reduce((sum, candidates) => sum + candidates.length, 0)
        
        console.log(`🚀 Batch candidate loading completed in ${executionTime}ms, loaded ${totalCandidates} candidates`)
        
        // Performance metrics logged to console
        if (profile) {
          console.log(`📊 Batch performance: ${executionTime}ms for ${totalCandidates} candidates`)
        }
        
      } catch (error) {
        console.error('❌ Batch candidate loading failed, falling back to sequential:', error)
        
        // Fallback to sequential loading with smaller batches
        const batchSize = 3
        for (let i = 0; i < itemsNeedingCandidates.length; i += batchSize) {
          const batch = itemsNeedingCandidates.slice(i, i + batchSize)
          
          const batchPromises = batch.map(async (item) => {
            try {
              const candidates = await generateMatchCandidates(item)
              return { id: item.id, candidates }
            } catch (error) {
              console.error(`❌ Failed to load candidates for item ${item.id}:`, error)
              return { id: item.id, candidates: [] }
            }
          })
          
          const batchResults = await Promise.all(batchPromises)
          
          // Update cache incrementally
          setCandidateCache(prev => {
            const newCache = { ...prev }
            batchResults.forEach(({ id, candidates }) => {
              newCache[id] = candidates
            })
            return newCache
          })
          
          // Small delay between batches
          if (i + batchSize < itemsNeedingCandidates.length) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }
    }

    if (lineItems.length > 0 && user && profile) {
      loadCandidatesOptimized()
    }
  }, [lineItems, generateMatchCandidates, user, profile, candidateCache])

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
            onResetAll={handleBulkReset}
            onAutoMatch={handleAutoMatch}
            disabled={processingItems.size > 0}
            rejectedCount={lineItems.filter(item => item.match?.status === 'rejected').length}
          />
        </div>
        
        <div className="flex items-center space-x-3">
          <ThresholdControl
            value={autoMatchThreshold}
            onChange={setAutoMatchThreshold}
          />
          <button
            onClick={clearMatchCache}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 border"
            title="Clear match cache and regenerate with new threshold"
          >
            🔄 Refresh Cache
          </button>
        </div>
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
          onResetMatch={handleMatchReset}
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

      {/* Optimized Stats Component */}
      {profile && (
        <OptimizedMatchStats 
          organizationId={profile.organization_id}
          fallbackStats={{
            totalItems: lineItems.length,
            pending: lineItems.filter(item => !item.match || item.match.status === 'pending').length,
            approved: lineItems.filter(item => item.match?.status === 'approved' || item.match?.status === 'auto_matched').length,
            rejected: lineItems.filter(item => item.match?.status === 'rejected').length
          }}
        />
      )}
    </div>
  )
}

// 🚀 Optimized stats component using database function
function OptimizedMatchStats({ 
  organizationId, 
  fallbackStats 
}: { 
  organizationId: string
  fallbackStats: { totalItems: number; pending: number; approved: number; rejected: number }
}) {
  const [stats, setStats] = useState(fallbackStats)
  const [loading, setLoading] = useState(false)
  const [avgConfidence, setAvgConfidence] = useState<number | null>(null)

  useEffect(() => {
    if (!organizationId) return
    
    const loadOptimizedStats = async () => {
      setLoading(true)
      const startTime = performance.now()
      
      try {
        // 🎯 Use optimized database function for statistics
        const { data, error } = await supabase
          .rpc('get_match_statistics_optimized', {
            p_organization_id: organizationId
          })
        
        if (error) throw error
        
        if (data && data.length > 0) {
          const result = data[0]
          setStats({
            totalItems: parseInt(result.total_items) || 0,
            pending: parseInt(result.pending_items) || 0,
            approved: parseInt(result.approved_items) || 0,
            rejected: parseInt(result.rejected_items) || 0
          })
          setAvgConfidence(result.avg_confidence ? parseFloat(result.avg_confidence) : null)
        } else {
          setStats(fallbackStats)
        }
        
        const endTime = performance.now()
        const executionTime = Math.round(endTime - startTime)
        
        console.log(`📊 Statistics loaded in ${executionTime}ms`)
        
        // Performance metrics logged to console
        console.log(`📊 Stats performance: ${executionTime}ms`)
        
      } catch (error) {
        console.error('❌ Optimized stats failed, using fallback:', error)
        setStats(fallbackStats)
      } finally {
        setLoading(false)
      }
    }
    
    loadOptimizedStats()
  }, [organizationId, JSON.stringify(fallbackStats)])

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-sm font-medium text-gray-500">Total Items</div>
        <div className="text-2xl font-bold text-gray-900">
          {loading ? '...' : stats.totalItems.toLocaleString()}
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-sm font-medium text-gray-500">Pending</div>
        <div className="text-2xl font-bold text-yellow-600">
          {loading ? '...' : stats.pending.toLocaleString()}
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-sm font-medium text-gray-500">Approved</div>
        <div className="text-2xl font-bold text-green-600">
          {loading ? '...' : stats.approved.toLocaleString()}
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-sm font-medium text-gray-500">Rejected</div>
        <div className="text-2xl font-bold text-red-600">
          {loading ? '...' : stats.rejected.toLocaleString()}
        </div>
      </div>
      {avgConfidence !== null && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Avg Confidence</div>
          <div className="text-2xl font-bold text-blue-600">
            {loading ? '...' : `${(avgConfidence * 100).toFixed(1)}%`}
          </div>
        </div>
      )}
    </div>
  )
}