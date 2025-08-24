-- Function to create required performance indices
CREATE OR REPLACE FUNCTION create_matching_indices()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  indices_created text[] := ARRAY[]::text[];
  errors text[] := ARRAY[]::text[];
BEGIN
  -- Create trigram index on products.name
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops)';
    indices_created := array_append(indices_created, 'idx_products_name_trgm');
  EXCEPTION WHEN OTHERS THEN
    errors := array_append(errors, 'idx_products_name_trgm: ' || SQLERRM);
  END;

  -- Create trigram index on products.sku
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin(sku gin_trgm_ops)';
    indices_created := array_append(indices_created, 'idx_products_sku_trgm');
  EXCEPTION WHEN OTHERS THEN
    errors := array_append(errors, 'idx_products_sku_trgm: ' || SQLERRM);
  END;

  -- Create vector similarity index
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector ON product_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
    indices_created := array_append(indices_created, 'idx_product_embeddings_vector');
  EXCEPTION WHEN OTHERS THEN
    errors := array_append(errors, 'idx_product_embeddings_vector: ' || SQLERRM);
  END;

  -- Create alias lookup index
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_competitor_aliases_text ON competitor_aliases(competitor_text)';
    indices_created := array_append(indices_created, 'idx_competitor_aliases_text');
  EXCEPTION WHEN OTHERS THEN
    errors := array_append(errors, 'idx_competitor_aliases_text: ' || SQLERRM);
  END;

  -- Create organization filter index
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id)';
    indices_created := array_append(indices_created, 'idx_products_organization_id');
  EXCEPTION WHEN OTHERS THEN
    errors := array_append(errors, 'idx_products_organization_id: ' || SQLERRM);
  END;

  result := json_build_object(
    'indices_created', indices_created,
    'errors', errors,
    'success', array_length(errors, 1) IS NULL OR array_length(errors, 1) = 0
  );

  RETURN result;
END;
$$;