-- Manual SQL to add fuzzy_score column to matches table
-- Run this in Supabase SQL Editor or database admin tool

ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS fuzzy_score double precision;

COMMENT ON COLUMN matches.fuzzy_score IS 'Fuzzy string similarity score (0.0-1.0) from hybrid matching algorithm';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name = 'fuzzy_score';