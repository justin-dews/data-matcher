-- Migration: Add fuzzy_score column to matches table
-- Date: 2025-08-23
-- Purpose: Support the new no-vector hybrid matching algorithm that includes fuzzy scoring

-- Add fuzzy_score column to matches table
ALTER TABLE matches 
ADD COLUMN fuzzy_score double precision;

-- Add comment for documentation
COMMENT ON COLUMN matches.fuzzy_score IS 'Fuzzy string similarity score (0.0-1.0) from hybrid matching algorithm';