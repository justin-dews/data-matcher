-- Fix matches table to have unique constraint on line_item_id
-- This is needed for the upsert operation in handleMatchRejection to work

-- First, clean up any potential duplicate matches (keep the most recent one)
WITH ranked_matches AS (
  SELECT 
    id,
    line_item_id,
    ROW_NUMBER() OVER (PARTITION BY line_item_id ORDER BY created_at DESC) as rn
  FROM matches
),
duplicates_to_delete AS (
  SELECT id 
  FROM ranked_matches 
  WHERE rn > 1
)
DELETE FROM matches 
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Add unique constraint on line_item_id
ALTER TABLE matches ADD CONSTRAINT matches_line_item_id_unique UNIQUE (line_item_id);

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'matches'::regclass 
AND conname = 'matches_line_item_id_unique';

SELECT 'Fixed matches table unique constraint for proper upsert operations!' AS status;