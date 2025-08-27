# Tiered Matching System Implementation Plan

## Problem Statement

The current matching system treats training data as just another similarity boost (15% weight), allowing algorithmic matches to override exact training data matches. This defeats the purpose of having curated training data.

**Specific Issue**: Line item `"GR. 8 HX HD CAP SCR 5/16-18X2-1/2"` has an exact match in training data (`56X212C8: HEX CAP SCREW BOLT UNC ZINC 5/16"-18 X 2-1/2", GR 8`) but the system returns a different screw as the top match due to trigram similarity overriding the training data.

## Root Cause Analysis

1. **Training data weight is too low**: Only 15% of final score
2. **No exact match detection**: System treats training data as similarity boost, not authoritative
3. **Cross-contamination**: Similar products in training data boost wrong matches
4. **Flawed hierarchy**: Algorithmic matching can override human-curated data

## Proposed Solution: Hierarchical Matching Logic

### Tier 1: Exact Training Match (Score 1.0)
- Check for exact or near-exact matches in `match_training_data` table
- Similarity threshold: **>95%**
- If found: Return with score **1.0**, skip other calculations
- This **trumps everything else**

### Tier 2: High-Quality Training Match (Score 0.85-0.95)  
- Training data matches with good similarity (80-95%)
- Still prioritized over algorithmic matching
- Scales score based on similarity within range

### Tier 3: Algorithmic Matching (Current System)
- Only used when no good training data exists
- Trigram + Fuzzy + Alias + Learned (reduced weight) scoring
- Maintains current functionality for new/untrained items

### Tier 4: Learning from Partial Patterns
- Training data with lower similarity provides boost to algorithmic scores
- Helps system learn from partial patterns
- Reduced weight since good matches handled in Tiers 1-2

## Implementation Phases

### Phase 1: Create Exact Match Detection Function
```sql
check_exact_training_match(query_text, org_id)
```
- Returns training matches with similarity scores
- Identifies exact matches (>95% similarity)
- Uses precise text matching with dimension awareness

### Phase 2: Create Tiered Hybrid Function
```sql  
hybrid_product_match_tiered(query_text, limit_count, threshold)
```
1. **Tier 1 Check**: Look for exact training matches (95%+ similarity)
   - If found → Return with score 1.0, skip other calculations
2. **Tier 2 Check**: Look for good training matches (80-95% similarity)
   - If found → Return with score 0.85-0.95, skip other calculations  
3. **Tier 3**: Current algorithmic matching (only if no good training data)
4. **Tier 4**: Apply training data as boost to algorithmic matches

### Phase 3: Improve Training Match Precision
- Enhance similarity detection for fastener specifications
- Better handling of dimension matching (thread size, length) 
- Prevent cross-contamination between similar product types
- Add dimension-specific bonuses for exact spec matches

### Phase 4: Integration & Testing
- Replace current `hybrid_product_match` calls with new tiered version
- Test screw example to ensure correct product ranks #1
- Validate other training data examples work correctly
- Ensure no regression in non-training-data scenarios

## Expected Outcomes

### Immediate Fixes
- Line item `"GR. 8 HX HD CAP SCR 5/16-18X2-1/2"` correctly matches `56X212C8` with score 1.0
- All exact training data matches become authoritative
- System respects human curation over algorithmic guessing

### System Benefits
- **Training data becomes authoritative**, not just suggestive
- **Maintains learning capability** for new patterns
- **Reduces false positives** from similar products
- **Improves user confidence** in match results
- **Clear hierarchy** of matching methods

## Technical Details

### Key Algorithm Changes
- **Similarity thresholds**: 95% for exact, 80% for good matches
- **Score assignment**: 1.0 for exact, 0.85-0.95 for good, algorithmic for rest
- **Early termination**: Stop processing when high-quality training matches found
- **Dimension awareness**: Bonus scoring for exact thread/length specifications

### Database Functions Needed
1. `check_exact_training_match()` - Training data lookup with precision
2. `hybrid_product_match_tiered()` - New tiered matching logic
3. Enhanced `get_learned_similarity_boost()` - More precise dimension matching

### Integration Points
- Update frontend calls from `hybrid_product_match` to `hybrid_product_match_tiered`
- Add UI indicators for "exact match from training data"  
- Maintain backward compatibility during transition

## Success Metrics

### Quantitative
- Screw example returns correct product as #1 match
- Training data exact matches achieve 1.0 scores
- No regression in algorithmic matching for untrained items
- Reduced false positive rate for similar products

### Qualitative  
- User reports improved match accuracy
- Reduced need for manual corrections
- Training data investment shows clear ROI
- System behavior becomes more predictable

## Risk Mitigation

### Potential Issues
- **Over-reliance on training data**: Mitigated by maintaining algorithmic fallback
- **Stale training data**: Handled by 12-month time window
- **Poor quality training**: Filtered by quality enum ('excellent', 'good')
- **Performance impact**: Minimized by early termination and indexed lookups

### Rollback Plan
- Keep original `hybrid_product_match` function as backup
- Gradual rollout with A/B testing capability
- Monitor performance metrics during transition
- Quick revert option if issues arise

## Timeline Estimate
- **Phase 1**: 1-2 hours (exact match detection function)
- **Phase 2**: 2-3 hours (tiered hybrid function)  
- **Phase 3**: 1-2 hours (precision improvements)
- **Phase 4**: 2-3 hours (integration and testing)
- **Total**: 6-10 hours for complete implementation

## Files to Modify
1. **New SQL file**: `tiered_matching_system.sql` (functions)
2. **Frontend**: Update API calls to use new function
3. **Types**: Add `is_training_match` boolean to match results
4. **UI**: Optional indicators for training-based matches

---

This plan transforms the matching system from algorithmic-first to **training-data-first**, ensuring that human curation takes precedence while maintaining the system's learning and adaptation capabilities.