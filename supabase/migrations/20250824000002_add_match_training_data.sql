-- Add match training data table for machine learning enhanced matching
-- This stores approved matches to improve future matching accuracy

-- Create enum for match quality ratings
CREATE TYPE match_quality_enum AS ENUM ('excellent', 'good', 'fair', 'poor');

-- Create the match training data table
CREATE TABLE match_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Original line item data
    line_item_id UUID REFERENCES line_items(id) ON DELETE SET NULL,
    line_item_text TEXT NOT NULL,
    line_item_normalized TEXT NOT NULL,
    
    -- Matched product data (snapshot for stability)
    matched_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_manufacturer TEXT,
    product_category TEXT,
    
    -- Original match scores when approved
    trigram_score DOUBLE PRECISION,
    fuzzy_score DOUBLE PRECISION,
    alias_score DOUBLE PRECISION,
    final_score DOUBLE PRECISION,
    
    -- Match quality assessment
    match_quality match_quality_enum DEFAULT 'good',
    match_confidence DOUBLE PRECISION DEFAULT 0.8,
    
    -- Learning metadata
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    training_weight DOUBLE PRECISION DEFAULT 1.0, -- Allows weighting of different training examples
    
    -- Performance tracking
    times_referenced INTEGER DEFAULT 0, -- How many times this training data helped other matches
    last_referenced_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_match_training_org_text ON match_training_data(organization_id, line_item_normalized);
CREATE INDEX idx_match_training_product ON match_training_data(matched_product_id);
CREATE INDEX idx_match_training_quality ON match_training_data(match_quality, match_confidence);
CREATE INDEX idx_match_training_approved_at ON match_training_data(approved_at);

-- Text search index for similarity matching
CREATE INDEX idx_match_training_text_gin ON match_training_data USING gin(to_tsvector('english', line_item_text));

-- Enable RLS
ALTER TABLE match_training_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "match_training_data_select_own_org" ON match_training_data
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "match_training_data_insert_own_org" ON match_training_data
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "match_training_data_update_own_org" ON match_training_data
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "match_training_data_delete_own_org" ON match_training_data
    FOR DELETE USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_match_training_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
CREATE TRIGGER match_training_data_updated_at
    BEFORE UPDATE ON match_training_data
    FOR EACH ROW
    EXECUTE FUNCTION update_match_training_data_updated_at();

-- Function to normalize text for training data (consistent with matching function)
CREATE OR REPLACE FUNCTION normalize_training_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF input_text IS NULL OR trim(input_text) = '' THEN
        RETURN '';
    END IF;
    
    -- Same normalization as used in matching
    RETURN lower(trim(regexp_replace(input_text, '\s+', ' ', 'g')));
END;
$$;

-- Comments for documentation
COMMENT ON TABLE match_training_data IS 'Stores approved matches for machine learning enhanced product matching';
COMMENT ON COLUMN match_training_data.line_item_text IS 'Original line item text from PDF parsing';
COMMENT ON COLUMN match_training_data.line_item_normalized IS 'Normalized version for consistent matching';
COMMENT ON COLUMN match_training_data.match_quality IS 'Human assessment of match quality';
COMMENT ON COLUMN match_training_data.training_weight IS 'Weight factor for this training example (1.0 = normal)';
COMMENT ON COLUMN match_training_data.times_referenced IS 'Counter for how often this training data helped other matches';

-- Grant permissions
GRANT SELECT ON match_training_data TO authenticated;
GRANT INSERT ON match_training_data TO authenticated;  
GRANT UPDATE ON match_training_data TO authenticated;
GRANT DELETE ON match_training_data TO authenticated;

-- Service role needs full access for training functions
GRANT ALL ON match_training_data TO service_role;

-- Grant usage on the enum type
GRANT USAGE ON TYPE match_quality_enum TO authenticated;
GRANT USAGE ON TYPE match_quality_enum TO service_role;

SELECT 'Created match_training_data table for ML-enhanced matching' AS status;