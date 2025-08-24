# **Phase 1.2.1 Supporting Functions - Implementation Plan**

## **Overview**
Create three supporting functions that will be used by the main `hybrid_product_match` function. Each function needs to be implemented, tested, and verified before moving to the next.

---

## **Function 1: `normalize_product_text()`**

### **Purpose**
Standardize product text for consistent matching across all algorithms.

### **Function Signature**
```sql
normalize_product_text(input_text TEXT) RETURNS TEXT
```

### **Implementation Steps**
1. **Text Cleaning**
   - Convert to lowercase
   - Remove extra whitespace (multiple spaces → single space)
   - Strip leading/trailing whitespace

2. **Character Normalization**
   - Remove special characters but preserve important ones (-, ., /)
   - Replace multiple hyphens with single hyphen
   - Normalize common abbreviations (& → and, w/ → with)

3. **Industrial Product Specific**
   - Normalize measurement units (mm → millimeter, " → inch)
   - Standardize material codes (SS → STAINLESS STEEL)
   - Handle part number patterns

### **Test Cases to Validate**
- `"  BOLT - M16X1.50  "` → `"bolt m16x1.50"`
- `"Safety Glasses w/ 2.0 Diopter"` → `"safety glasses with 2.0 diopter"`
- `"STEEL M8-1.25"` → `"steel m8-1.25"`

---

## **Function 2: `calculate_fuzzy_score()`**

### **Purpose**
Calculate fuzzy string similarity using multiple PostgreSQL string functions.

### **Function Signature**
```sql
calculate_fuzzy_score(text1 TEXT, text2 TEXT) RETURNS FLOAT
```

### **Implementation Steps**
1. **Levenshtein Distance**
   - Use `levenshtein(text1, text2)`
   - Normalize to 0-1 scale: `1 - (distance / max_length)`

2. **Word-Level Matching**
   - Split both texts into word arrays
   - Calculate word overlap ratio
   - Account for word order differences

3. **Substring Matching**
   - Check for exact substring matches
   - Boost score for longer common substrings

4. **Combined Scoring**
   - Weight: 50% Levenshtein, 30% word overlap, 20% substring
   - Return final normalized score 0-1

### **Test Cases to Validate**
- `"BOLT M16", "BOLT M16X1.5"` → ~0.85 (high similarity)
- `"SAFETY GLASSES", "SAFETY GOGGLES"` → ~0.65 (medium similarity)
- `"STEEL BOLT", "ALUMINUM NUT"` → ~0.20 (low similarity)

---

## **Function 3: `get_alias_boost()`**

### **Purpose**
Check if query text has learned competitor aliases and return boost score.

### **Function Signature**
```sql
get_alias_boost(query_text TEXT, product_id UUID, org_id UUID) RETURNS FLOAT
```

### **Implementation Steps**
1. **Exact Match Check**
   - Query `competitor_aliases` for exact `competitor_name` match
   - If exact match found for this product_id, return confidence_score

2. **Fuzzy Alias Match**
   - Use trigram similarity on competitor_name column
   - Find aliases with similarity > 0.8
   - Return weighted confidence based on similarity

3. **No Match Handling**
   - Return 0.0 if no aliases found
   - Ensure function handles empty competitor_aliases table

4. **Performance Optimization**
   - Use the trigram index we created: `idx_competitor_aliases_competitor_name_trgm`
   - Limit results to organization_id scope

### **Test Cases to Validate**
- Exact alias match → Return stored confidence_score
- Similar alias match → Return weighted confidence  
- No alias found → Return 0.0
- Empty aliases table → Return 0.0 (no errors)

---

## **Implementation Sequence & Validation**

### **Step 1: Create Each Function**
1. Write SQL for `normalize_product_text()`
2. Create function in Supabase
3. Test with sample inputs
4. Verify outputs match expected results

### **Step 2: Integration Testing**  
1. Test all three functions work together
2. Verify performance with real product data
3. Check error handling edge cases

### **Step 3: Performance Validation**
1. Test functions with 92-product dataset
2. Measure execution time for each function
3. Ensure sub-millisecond performance for individual calls

---

## **Success Criteria for Phase 1.2.1**
- [ ] All three supporting functions created and deployed
- [ ] Each function passes its specific test cases  
- [ ] Functions handle edge cases (null input, empty strings, special characters)
- [ ] Performance meets requirements (<1ms per function call)
- [ ] Functions work with real product data from your 92-item catalog
- [ ] No SQL errors or exceptions during testing

---

## **Ready to Begin Implementation?**

**Order of implementation:**
1. `normalize_product_text()` first (foundational)
2. `calculate_fuzzy_score()` second (uses normalized text) 
3. `get_alias_boost()` third (least critical for initial testing)

**Shall I proceed with implementing `normalize_product_text()` first?**