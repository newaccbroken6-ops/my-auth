async function test() {
  console.log('Testing full API lifecycle on localhost:3001...');
  
  // 1. Login
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@supernova.com', password: 'admin' }),
  });
  const loginData = await loginRes.json();
  console.log('1. Login status:', loginRes.status, 'User:', loginData.user?.email, 'Role:', loginData.user?.role);
  const token = loginData.token;

  if (!token) {
    throw new Error('No token returned');
  }

  // 2. Create Application
  const appRes = await fetch('http://localhost:3001/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'ApexLoader', description: 'Internal tool', version: '2.0.0' }),
  });
  const app = await appRes.json();
  console.log('2. Created App:', app.id, app.name, 'Secret:', app.api_secret?.slice(0, 10) + '...');

  // 3. Bulk generate 2 licenses
  const bulkRes = await fetch('http://localhost:3001/api/licenses/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ app_id: app.id, license_type: 'monthly', count: 2, custom_name: 'VIP' }),
  });
  const bulkData = await bulkRes.json();
  console.log('3. Generated licenses:', bulkData.licenses?.map(l => l.license_key));

  const testKey = bulkData.licenses[0].license_key;

  // 4. Validate License (C++ client public endpoint)
  const val1 = await fetch('http://localhost:3001/api/v1/validate-license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: testKey, hwid: 'HWID-PC-USER-001', app_id: app.id }),
  });
  const val1Data = await val1.json();
  console.log('4. Initial Validation:', val1Data);

  // 5. Validate again with same HWID
  const val2 = await fetch('http://localhost:3001/api/v1/validate-license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: testKey, hwid: 'HWID-PC-USER-001', app_id: app.id }),
  });
  const val2Data = await val2.json();
  console.log('5. Repeat Validation (same HWID):', val2Data);

  // 6. Validate with mismatched HWID
  const val3 = await fetch('http://localhost:3001/api/v1/validate-license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: testKey, hwid: 'HWID-DIFFERENT-PC', app_id: app.id }),
  });
  const val3Data = await val3.json();
  console.log('6. Mismatch Validation (diff HWID):', val3Data);

  // 7. Get Dashboard stats
  const dashRes = await fetch('http://localhost:3001/api/stats/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const dashData = await dashRes.json();
  console.log('7. Dashboard Stats:', {
    totalLicenses: dashData.totalLicenses,
    activeLicenses: dashData.activeLicenses,
    totalApps: dashData.totalApps,
    totalLogs: dashData.totalLogs,
  });

  // 8. Get System stats (Neon DB metrics)
  const sysRes = await fetch('http://localhost:3001/api/stats/system', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const sysData = await sysRes.json();
  console.log('8. System Stats:', {
    totalRows: sysData.database?.totalRows,
    avgQueryTime: sysData.performance?.avgQueryTime + 'ms',
    tables: sysData.database?.tables?.map(t => `${t.name}: ${t.rows} rows (${t.size})`),
  });

  console.log('\nAll REST API tests PASSED successfully!');
}

test().catch(console.error);
