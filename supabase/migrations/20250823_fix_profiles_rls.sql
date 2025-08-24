-- Fix profiles RLS infinite recursion
-- The issue: profile policies reference the profiles table itself, creating infinite recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create new policies that don't cause recursion
-- Users can always view their own profile
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

-- Users can update their own profile  
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Users can insert their own profile (for sign-up)
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- Fix other policies that depend on profiles table
-- Update products policies to be simpler and avoid recursion
DROP POLICY IF EXISTS "Users can view products in their organization" ON products;
DROP POLICY IF EXISTS "Users can manage products in their organization" ON products;

CREATE POLICY "Users can view products in their organization" ON products
    FOR SELECT USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage products in their organization" ON products
    FOR ALL USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

-- Update product_embeddings policies
DROP POLICY IF EXISTS "Users can view embeddings in their organization" ON product_embeddings;

CREATE POLICY "Users can view embeddings in their organization" ON product_embeddings
    FOR SELECT USING (
        product_id IN (
            SELECT prod.id FROM products prod
            WHERE prod.organization_id = (
                SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
            )
        )
    );

-- Update documents policies  
DROP POLICY IF EXISTS "Users can view documents in their organization" ON documents;
DROP POLICY IF EXISTS "Users can manage documents in their organization" ON documents;

CREATE POLICY "Users can view documents in their organization" ON documents
    FOR SELECT USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage documents in their organization" ON documents
    FOR ALL USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

-- Update line_items policies
DROP POLICY IF EXISTS "Users can view line items in their organization" ON line_items;  
DROP POLICY IF EXISTS "Users can manage line items in their organization" ON line_items;

CREATE POLICY "Users can view line items in their organization" ON line_items
    FOR SELECT USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage line items in their organization" ON line_items
    FOR ALL USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

-- Update competitor_aliases policies
DROP POLICY IF EXISTS "Users can view aliases in their organization" ON competitor_aliases;
DROP POLICY IF EXISTS "Users can manage aliases in their organization" ON competitor_aliases;

CREATE POLICY "Users can view aliases in their organization" ON competitor_aliases
    FOR SELECT USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage aliases in their organization" ON competitor_aliases
    FOR ALL USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

-- Update matches policies
DROP POLICY IF EXISTS "Users can view matches in their organization" ON matches;
DROP POLICY IF EXISTS "Users can manage matches in their organization" ON matches;

CREATE POLICY "Users can view matches in their organization" ON matches
    FOR SELECT USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage matches in their organization" ON matches
    FOR ALL USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

-- Update settings policies  
DROP POLICY IF EXISTS "Users can view settings in their organization" ON settings;
DROP POLICY IF EXISTS "Users can manage settings in their organization" ON settings;

CREATE POLICY "Users can view settings in their organization" ON settings
    FOR SELECT USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "Users can manage settings in their organization" ON settings
    FOR ALL USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

-- Update activity_log policies
DROP POLICY IF EXISTS "Users can view activity in their organization" ON activity_log;

CREATE POLICY "Users can view activity in their organization" ON activity_log
    FOR SELECT USING (
        organization_id = (
            SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    );