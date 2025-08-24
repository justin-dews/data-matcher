# **Phase 1.2.2 Main Function - Implementation Plan**

## **Overview**
Implement the core `hybrid_product_match()` function that combines all matching algorithms and returns ranked results. This function integrates all Phase 1.2.1 supporting functions with vector and trigram matching.

---

## **Function Specification**

### **Function Signature**
```sql
CREATE OR REPLACE FUNCTION hybrid_product_match(
  query_text TEXT,
  organization_id UUID,
  limit_count INTEGER DEFAULT 10,
  threshold FLOAT DEFAULT 0.85
) 
RETURNS TABLE (
  product_id UUID,
  sku TEXT,
  name TEXT,
  vector_score FLOAT,
  trigram_score FLOAT,
  fuzzy_score FLOAT,
  alias_score FLOAT,
  final_score FLOAT,
  match_algorithm TEXT
)
```

### **Algorithm Weights**
- **Vector Similarity**: 40% (0.4)
- **Trigram Matching**: 30% (0.3) 
- **Fuzzy Matching**: 20% (0.2)
- **Alias Boost**: 10% (0.1)

**Final Score Formula:**
```sql
final_score = (vector_score * 0.4) + (trigram_score * 0.3) + 
              (fuzzy_score * 0.2) + (alias_score * 0.1)
```

---

## **Implementation Steps**

### **Step 1: Input Validation & Preprocessing**
```sql
-- Handle null/empty inputs
IF query_text IS NULL OR trim(query_text) = '' THEN
  RETURN; -- Empty result set
END IF;

-- Normalize query text using our function
normalized_query := normalize_product_text(query_text);

-- Validate organization_id exists
-- Set reasonable defaults for limit_count and threshold
limit_count := COALESCE(limit_count, 10);
threshold := COALESCE(threshold, 0.85);
```

### **Step 2: Candidate Filtering (Performance Optimization)**

**2a. Trigram Candidate Selection**
```sql
-- Get top 500 trigram candidates using existing index
CREATE TEMP TABLE trigram_candidates AS
SELECT DISTINCT p.id as product_id, p.sku, p.name,
       similarity(normalize_product_text(p.name), normalized_query) as trgm_sim
FROM products p
WHERE p.organization_id = organization_id
  AND similarity(normalize_product_text(p.name), normalized_query) > 0.1
ORDER BY trgm_sim DESC
LIMIT 500;
```

**2b. Vector Candidate Selection**
```sql
-- Get top 100 vector candidates using existing index
CREATE TEMP TABLE vector_candidates AS
SELECT DISTINCT p.id as product_id, p.sku, p.name,
       1 - (pe.embedding <=> get_embedding(normalized_query)) as vec_sim
FROM products p
JOIN product_embeddings pe ON pe.product_id = p.id
WHERE p.organization_id = organization_id
  AND pe.embedding IS NOT NULL
ORDER BY pe.embedding <=> get_embedding(normalized_query)
LIMIT 100;
```

**2c. Merge Candidate Sets**
```sql
-- Combine all candidates
CREATE TEMP TABLE all_candidates AS
SELECT product_id, sku, name FROM trigram_candidates
UNION
SELECT product_id, sku, name FROM vector_candidates;
```

### **Step 3: Multi-Algorithm Scoring**

**3a. Calculate Individual Scores**
```sql
-- Calculate all scores for each candidate
CREATE TEMP TABLE scored_candidates AS
SELECT 
  ac.product_id,
  ac.sku,
  ac.name,
  
  -- Vector similarity score (0-1)
  COALESCE(
    (SELECT 1 - (pe.embedding <=> get_embedding(normalized_query))
     FROM product_embeddings pe 
     WHERE pe.product_id = ac.product_id), 
    0.0
  ) as vector_score,
  
  -- Trigram similarity score (0-1)
  COALESCE(
    similarity(normalize_product_text(ac.name), normalized_query), 
    0.0
  ) as trigram_score,
  
  -- Fuzzy similarity score (0-1) - our function
  COALESCE(
    calculate_fuzzy_score(normalize_product_text(ac.name), normalized_query),
    0.0
  ) as fuzzy_score,
  
  -- Alias boost score (0-1) - our function
  COALESCE(
    get_alias_boost(query_text, ac.product_id, organization_id),
    0.0
  ) as alias_score

FROM all_candidates ac;
```

**3b. Calculate Final Combined Score**
```sql
-- Add final score calculation
CREATE TEMP TABLE final_scores AS
SELECT *,
  -- Weighted combination
  (vector_score * 0.4) + (trigram_score * 0.3) + 
  (fuzzy_score * 0.2) + (alias_score * 0.1) as final_score,
  
  -- Determine primary matching algorithm
  CASE 
    WHEN vector_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score) 
      THEN 'vector'
    WHEN trigram_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score) 
      THEN 'trigram'  
    WHEN fuzzy_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score) 
      THEN 'fuzzy'
    WHEN alias_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score)
      THEN 'alias'
    ELSE 'hybrid'
  END as match_algorithm

FROM scored_candidates;
```

### **Step 4: Filtering & Results**
```sql
-- Return filtered and sorted results
RETURN QUERY
SELECT 
  fs.product_id,
  fs.sku,
  fs.name,
  fs.vector_score,
  fs.trigram_score,
  fs.fuzzy_score,
  fs.alias_score,
  fs.final_score,
  fs.match_algorithm
FROM final_scores fs
WHERE fs.final_score >= threshold
ORDER BY fs.final_score DESC, fs.vector_score DESC
LIMIT limit_count;
```

### **Step 5: Cleanup**
```sql
-- Clean up temporary tables
DROP TABLE IF EXISTS trigram_candidates;
DROP TABLE IF EXISTS vector_candidates; 
DROP TABLE IF EXISTS all_candidates;
DROP TABLE IF EXISTS scored_candidates;
DROP TABLE IF EXISTS final_scores;
```

---

## **Missing Dependencies**

### **Vector Embedding Function**
We need to implement `get_embedding()` function or handle this differently:

**Option A: Pre-computed embeddings only**
```sql
-- Skip vector scoring if no embedding exists
-- Use 0.0 as vector_score for products without embeddings
```

**Option B: Real-time embedding (requires Edge Function)**
```sql
-- Call edge function to get embedding for query_text
-- More expensive but handles new queries
```

**Recommendation**: Start with Option A (pre-computed only) for Phase 1.2.2

---

## **Test Cases to Validate**

### **Test Case 1: High Vector Similarity**
- Query: "METRIC HEX HEAD CAP SCREW M16X1.50X30MM"
- Expected: Should match products with high vector similarity
- Verify vector_score is primary contributor

### **Test Case 2: High Trigram Similarity** 
- Query: "BOLT M16" 
- Expected: Should match "BOLT M16X1.5" with high trigram score
- Verify trigram_score contributes significantly

### **Test Case 3: Fuzzy Match Strength**
- Query: "SAFETY GOGGLES"
- Expected: Should match "SAFETY GLASSES" via fuzzy scoring
- Verify fuzzy_score handles word variations

### **Test Case 4: Alias Boost**
- Query: Competitor product name with existing alias
- Expected: Should get boost from alias_score
- Verify alias learning integration

### **Test Case 5: Combined Scoring**
- Query: Product that scores moderately on all algorithms
- Expected: Combined score should exceed threshold
- Verify weighted combination works correctly

### **Test Case 6: Threshold Filtering**
- Query: Low similarity product
- Expected: Should be filtered out by threshold
- Verify only high-confidence matches return

### **Test Case 7: Organization Isolation**
- Query: Product from different organization 
- Expected: Should return no matches
- Verify multi-tenant security

### **Test Case 8: Performance**
- Query: Any product name
- Expected: Function completes in <100ms with 92-product dataset
- Verify candidate filtering optimization works

---

## **Error Handling Requirements**

1. **Null/Empty Query**: Return empty result set
2. **Invalid Organization**: Return empty result set  
3. **No Embeddings**: Use 0.0 for vector_score, continue with other algorithms
4. **Database Errors**: Handle gracefully, log for debugging
5. **Temporary Table Conflicts**: Use unique temp table names if needed

---

## **Performance Expectations**

- **Target Response Time**: <100ms for 92-product dataset
- **Candidate Filtering**: Should reduce search space to <600 products
- **Memory Usage**: Temporary tables should be manageable size
- **Index Usage**: Must leverage existing trigram and vector indices

---

## **Success Criteria**

- [ ] Function created and deployed successfully
- [ ] All 8 test cases pass with expected scoring patterns
- [ ] Performance meets <100ms target
- [ ] Multi-tenant isolation works correctly  
- [ ] Handles edge cases without errors
- [ ] Integrates all three supporting functions correctly
- [ ] Weighted scoring formula produces reasonable results
- [ ] Threshold filtering works as expected

---

## **Implementation Sequence**

1. **Basic Function Shell**: Create function with input validation
2. **Candidate Filtering**: Implement trigram + vector candidate selection
3. **Individual Scoring**: Add all four scoring algorithms  
4. **Score Combination**: Implement weighted formula
5. **Results Processing**: Add filtering, sorting, limiting
6. **Error Handling**: Add comprehensive error handling
7. **Testing**: Run all test cases and validate results
8. **Performance Tuning**: Optimize if needed to meet targets

**Ready to begin implementation with Step 1?**