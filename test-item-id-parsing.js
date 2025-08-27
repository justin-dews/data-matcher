#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testItemIdParsing() {
  console.log('🧪 Testing ITEM ID column parsing fix...\n');
  
  try {
    // Create a test HTML table matching the user's structure
    const testHtml = `
    <table>
    <thead>
    <tr>
    <th>LN</th>
    <th>QTY. ORDER</th>
    <th>ALLC QTY</th>
    <th>ITEM ID</th>
    <th>UOM</th>
    <th>ITEM XREF</th>
    <th>DESCRIPTION</th>
    <th>PRICE</th>
    <th>VALUE</th>
    </tr>
    </thead>
    <tbody>
    <tr>
    <td>1</td>
    <td>10</td>
    <td></td>
    <td>KP82030</td>
    <td>EA</td>
    <td></td>
    <td>MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP</td>
    <td>.64000</td>
    <td>6.40</td>
    </tr>
    <tr>
    <td>2</td>
    <td>10</td>
    <td></td>
    <td>C90634</td>
    <td>EA</td>
    <td></td>
    <td>MET HARDENED FLAT WASHER M18 ZINC PL</td>
    <td>1.04000</td>
    <td>10.40</td>
    </tr>
    </tbody>
    </table>
    `;
    
    // Test the parse-pdf function with this HTML
    const response = await fetch('https://theattidfeqxyaexiqwj.supabase.co/functions/v1/parse-pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_id: 'test-item-id-parsing',
        test_mode: true,
        test_html: testHtml
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Edge function error:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Parsing result:', JSON.stringify(result, null, 2));
    
    // Check if the item_number was correctly mapped
    if (result.line_items && result.line_items.length > 0) {
      const firstItem = result.line_items[0];
      const secondItem = result.line_items[1];
      
      console.log('\n🔍 Checking column mapping:');
      console.log(`   First item number: "${firstItem.item_number}" (should be "KP82030")`);
      console.log(`   Second item number: "${secondItem.item_number}" (should be "C90634")`);
      
      if (firstItem.item_number === 'KP82030' && secondItem.item_number === 'C90634') {
        console.log('🎉 SUCCESS: ITEM ID column is now being mapped correctly!');
      } else {
        console.log('❌ ISSUE: ITEM ID column mapping still not working correctly');
      }
    }
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testItemIdParsing();