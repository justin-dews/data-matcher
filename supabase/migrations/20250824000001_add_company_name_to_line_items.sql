-- Add company_name field to line_items table for competitor tracking
-- This enables the learning system to associate line items with specific competitor companies

-- Add company_name field to line_items table
ALTER TABLE line_items ADD COLUMN company_name TEXT;

-- Add index for efficient company_name queries
CREATE INDEX idx_line_items_company_name ON line_items(company_name);

-- Add comment for documentation
COMMENT ON COLUMN line_items.company_name IS 'Name of the competitor company from which this line item originated (used for building competitor aliases)';

SELECT 'Added company_name field to line_items table successfully!' as status;