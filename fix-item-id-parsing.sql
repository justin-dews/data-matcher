-- Quick fix for the ITEM ID column mapping issue
-- This adds the missing pattern to handle "ITEM ID" headers

-- For now, let me create a test to verify the issue
SELECT 'Testing ITEM ID pattern matching...' AS status;

-- The issue is that "ITEM ID" doesn't match any of the current patterns:
-- Current patterns: /^item$/i, /^sku$/i, /^part[\s_-]?number$/i, etc.
-- Missing pattern: /^item[\s_-]?id$/i

-- This explains why we see in the raw_row:
-- "1 | 10 |  | KP82030 | EA |  | MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP | .64000 | 6.40"
-- Position 0: LN (1)
-- Position 1: QTY. ORDER (10) 
-- Position 2: ALLC QTY (empty)
-- Position 3: ITEM ID (KP82030) <-- THIS should be the item_number
-- Position 4: UOM (EA)
-- Position 5: ITEM XREF (empty)
-- Position 6: DESCRIPTION (MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP)
-- Position 7: PRICE (.64000)
-- Position 8: VALUE (6.40)

-- But instead it's generating "ITEM-1", "ITEM-2" as placeholders

SELECT 'The fix needs to be applied to the parse-pdf edge function' AS next_step;