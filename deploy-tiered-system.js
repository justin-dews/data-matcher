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

async function deployTieredSystem() {
  console.log('🚀 Deploying tiered matching system...\n');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('./tiered_matching_system.sql', 'utf8');
    
    // Split by function definitions and execute one by one
    const functions = sqlContent.split('CREATE OR REPLACE FUNCTION');
    
    // Execute the first part (if any)
    if (functions[0].trim()) {
      console.log('📝 Executing initial setup...');
      const { error: setupError } = await supabase.rpc('exec_sql', { sql: functions[0] });
      if (setupError) {
        console.error('❌ Setup error:', setupError);
      } else {
        console.log('✅ Initial setup complete');
      }
    }
    
    // Execute each function
    for (let i = 1; i < functions.length; i++) {
      const functionSql = 'CREATE OR REPLACE FUNCTION' + functions[i];
      const functionName = functionSql.match(/FUNCTION\s+(\w+)/)?.[1] || `function_${i}`;
      
      console.log(`📝 Creating function: ${functionName}...`);
      
      // Execute the function creation
      const { error } = await supabase.rpc('exec_sql', { sql: functionSql });
      
      if (error) {
        console.error(`❌ Error creating ${functionName}:`, error);
      } else {
        console.log(`✅ Function ${functionName} created successfully`);
      }
    }
    
  } catch (error) {
    console.error('💥 Deployment error:', error);
  }
}

// Alternative: Execute the whole file as one command
async function deployAsOneCommand() {
  console.log('🚀 Deploying tiered matching system as single command...\n');
  
  try {
    const sqlContent = fs.readFileSync('./tiered_matching_system.sql', 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const [index, statement] of statements.entries()) {
      if (statement.toLowerCase().includes('create or replace function')) {
        const funcName = statement.match(/function\s+(\w+)/i)?.[1] || `func_${index}`;
        console.log(`📝 Creating function: ${funcName}...`);
      } else if (statement.toLowerCase().includes('grant')) {
        console.log(`🔑 Setting permissions...`);
      } else if (statement.toLowerCase().includes('select')) {
        console.log(`📊 Running validation...`);
      }
      
      try {
        // Execute each statement
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          console.error(`❌ Error in statement ${index + 1}:`, error.message);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${index + 1} executed successfully`);
          if (data) console.log('   Result:', data);
        }
      } catch (err) {
        console.error(`💥 Exception in statement ${index + 1}:`, err.message);
      }
      
      // Small delay between statements
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 Deployment complete! Testing the new system...');
    
    // Test the new system
    await testTieredSystem();
    
  } catch (error) {
    console.error('💥 Deployment error:', error);
  }
}

async function testTieredSystem() {
  console.log('\n🧪 Testing tiered matching system...');
  
  try {
    // Test the exact match case
    const { data: matches, error } = await supabase
      .rpc('hybrid_product_match_tiered', {
        query_text: 'GR. 8 HX HD CAP SCR 5/16-18X2-1/2',
        limit_count: 5,
        threshold: 0.1
      });
      
    if (error) {
      console.error('❌ Test error:', error);
    } else {
      console.log('\n🎯 Test Results for Screw Item:');
      matches.forEach((match, i) => {
        const marker = match.sku === '56X212C8' ? '🎯 CORRECT MATCH!' : '   ';
        console.log(`${i+1}. ${match.sku}: ${match.name}`);
        console.log(`   Final Score: ${match.final_score} (${match.matched_via}) ${match.is_training_match ? '[TRAINING]' : '[ALGO]'} ${marker}`);
        console.log('');
      });
      
      // Check if our expected match is #1
      if (matches.length > 0 && matches[0].sku === '56X212C8') {
        console.log('✅ SUCCESS: Correct product ranks #1 with training data!');
      } else {
        console.log('❌ ISSUE: Expected product (56X212C8) not ranking #1');
      }
    }
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

// Run deployment
deployAsOneCommand();