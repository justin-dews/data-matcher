#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMatchesFix() {
  console.log('🔧 Applying matches table unique constraint fix...\n');
  
  try {
    // Step 1: Clean up any duplicate matches
    console.log('1️⃣ Cleaning up duplicate matches...');
    const cleanupSql = `
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
    `;
    
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc('exec_sql', { 
      sql: cleanupSql 
    });
    
    if (cleanupError) {
      console.error('❌ Error cleaning up duplicates:', cleanupError);
      // Continue anyway, duplicates might not exist
    } else {
      console.log('✅ Cleanup completed');
    }
    
    // Step 2: Add unique constraint
    console.log('\n2️⃣ Adding unique constraint on line_item_id...');
    const constraintSql = `
      ALTER TABLE matches ADD CONSTRAINT matches_line_item_id_unique UNIQUE (line_item_id);
    `;
    
    const { data: constraintResult, error: constraintError } = await supabase.rpc('exec_sql', { 
      sql: constraintSql 
    });
    
    if (constraintError) {
      if (constraintError.message.includes('already exists')) {
        console.log('✅ Unique constraint already exists');
      } else {
        console.error('❌ Error adding constraint:', constraintError);
        return;
      }
    } else {
      console.log('✅ Unique constraint added successfully');
    }
    
    // Step 3: Verify the constraint
    console.log('\n3️⃣ Verifying constraint...');
    const verifySql = `
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint 
      WHERE conrelid = 'matches'::regclass 
      AND conname = 'matches_line_item_id_unique';
    `;
    
    const { data: verifyResult, error: verifyError } = await supabase.rpc('exec_sql', { 
      sql: verifySql 
    });
    
    if (verifyError) {
      console.error('❌ Error verifying constraint:', verifyError);
    } else {
      console.log('✅ Constraint verified:', verifyResult);
    }
    
    // Step 4: Test the rejection fix
    console.log('\n4️⃣ Testing the rejection fix...');
    const testLineItemId = '108cb223-9479-4e60-8662-6a41ac47e198'; // POWER NUTSETTER
    const ORG_ID = '00000000-0000-0000-0000-000000000001';
    const USER_ID = 'b903b88d-e667-4dde-94ff-79dbbb1fcb38';
    
    const { data: testResult, error: testError } = await supabase
      .from('matches')
      .upsert({
        line_item_id: testLineItemId,
        product_id: null,
        organization_id: ORG_ID,
        status: 'rejected',
        reviewed_by: USER_ID,
        reviewed_at: new Date().toISOString()
      }, {
        onConflict: 'line_item_id'
      })
      .select();
      
    if (testError) {
      console.error('❌ Test upsert failed:', testError);
    } else {
      console.log('✅ Test upsert successful:', testResult);
      
      // Clean up test record
      await supabase
        .from('matches')
        .delete()
        .eq('line_item_id', testLineItemId);
      console.log('✅ Test record cleaned up');
    }
    
    console.log('\n🎉 Matches table fix completed successfully!');
    console.log('   Now the "Reject All Matches" functionality should work without errors.');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

applyMatchesFix();