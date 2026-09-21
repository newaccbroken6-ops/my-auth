/**
 * Test Script: Generate 10,000 License Keys
 * 
 * This script will generate 10,000 licenses in batches of 100
 * and measure the database space usage.
 */

const SUPABASE_URL = 'https://wncowlnkfjvmdhvtfxhz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY293bG5rZmp2bWRodnRmeGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNjkwNjgsImV4cCI6MjA5ODc0NTA2OH0.Uqw-4SGgKSlem5d9vzWNN7nfUoYH0LPsKJbR8zjZTms';

// YOU NEED TO LOGIN FIRST AND GET YOUR ACCESS TOKEN
// Open browser console on http://localhost:5173/ after login and run:
// supabase.auth.getSession().then(s => console.log(s.data.session.access_token))
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE'; // Replace with your actual token

const APP_ID = 'YOUR_APP_ID_HERE'; // Replace with your app ID

const TOTAL_LICENSES = 10000;
const BATCH_SIZE = 100;
const BATCHES = Math.ceil(TOTAL_LICENSES / BATCH_SIZE);

async function generateBatch(batchNumber) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-licenses/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        license_type: 'lifetime',
        count: BATCH_SIZE,
        note: `Test batch ${batchNumber}`
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Batch ${batchNumber} failed: ${error}`);
  }

  const data = await response.json();
  return data.licenses;
}

async function checkDatabaseSize() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/pg_database_size`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ database_name: 'postgres' })
    }
  );
  
  return response.ok;
}

async function main() {
  console.log('🚀 Starting license generation test...');
  console.log(`📊 Target: ${TOTAL_LICENSES} licenses`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`🔄 Total batches: ${BATCHES}\n`);

  const startTime = Date.now();
  let totalGenerated = 0;
  let errors = 0;

  for (let i = 1; i <= BATCHES; i++) {
    try {
      console.log(`[${i}/${BATCHES}] Generating batch...`);
      const licenses = await generateBatch(i);
      totalGenerated += licenses.length;
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const rate = (totalGenerated / elapsed).toFixed(2);
      
      console.log(`✅ Batch ${i} complete (${licenses.length} keys)`);
      console.log(`📈 Progress: ${totalGenerated}/${TOTAL_LICENSES} (${((totalGenerated/TOTAL_LICENSES)*100).toFixed(1)}%)`);
      console.log(`⏱️  Speed: ${rate} keys/sec\n`);

      // Small delay to avoid rate limiting
      if (i < BATCHES) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`❌ Error in batch ${i}:`, error.message);
      errors++;
      
      if (errors > 5) {
        console.error('🛑 Too many errors, stopping test');
        break;
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgRate = (totalGenerated / totalTime).toFixed(2);

  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Total generated: ${totalGenerated} licenses`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`⏱️  Total time: ${totalTime}s`);
  console.log(`📈 Average rate: ${avgRate} keys/sec`);
  console.log('='.repeat(50));
  
  console.log('\n💡 Next steps:');
  console.log('1. Check database size in Supabase Dashboard');
  console.log('2. Go to: Database > Usage');
  console.log('3. Check "Database size" metric');
  console.log('\nOr run this SQL query in SQL Editor:');
  console.log(`
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename = 'licenses'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  `);
}

// Run the test
if (ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN_HERE' || APP_ID === 'YOUR_APP_ID_HERE') {
  console.error('❌ Please configure ACCESS_TOKEN and APP_ID first!');
  console.log('\n📝 Instructions:');
  console.log('1. Login at http://localhost:5173/');
  console.log('2. Open browser console (F12)');
  console.log('3. Run: (await supabase.auth.getSession()).data.session.access_token');
  console.log('4. Copy the token and paste it in this script');
  console.log('5. Also get your APP_ID from the Applications page');
  process.exit(1);
}

main().catch(console.error);
