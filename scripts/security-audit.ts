/**
 * Security Testing & Validation Suite
 * Reference: Section 19 of architettura_sicurezza_web.txt
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  category: string,
  expected: string,
  fn: () => Promise<{ passed: boolean; actual: string; details?: string }>
) {
  try {
    const res = await fn();
    results.push({
      name,
      category,
      expected,
      passed: res.passed,
      actual: res.actual,
      details: res.details,
    });
  } catch (err: any) {
    results.push({
      name,
      category,
      expected,
      passed: false,
      actual: `Error: ${err.message}`,
    });
  }
}

async function startSuite() {
  console.log(`\n================================================================`);
  console.log(` RUNNING SECURITY VERIFICATION SUITE (${BASE_URL})`);
  console.log(` Based on: architettura_sicurezza_web.txt (Section 19)`);
  console.log(`================================================================\n`);

  // 1. Healthcheck
  await runTest('API Health Check', 'Perimeter', 'Status 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    return {
      passed: res.status === 200 && data.status === 'ok',
      actual: `Status: ${res.status}, Body: ${JSON.stringify(data)}`,
    };
  });

  // 2. Security Headers (Section 12.7)
  await runTest('Security Header: X-Content-Type-Options', 'Headers', 'nosniff', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const val = res.headers.get('x-content-type-options');
    return { passed: val === 'nosniff', actual: val || 'Missing' };
  });

  await runTest('Security Header: X-Frame-Options', 'Headers', 'DENY', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const val = res.headers.get('x-frame-options');
    return { passed: val === 'DENY', actual: val || 'Missing' };
  });

  await runTest('Security Header: Content-Security-Policy', 'Headers', 'Contains strict CSP', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const val = res.headers.get('content-security-policy') || '';
    const passed = val.includes("default-src 'self'") && val.includes("frame-ancestors 'none'");
    return { passed, actual: val ? 'Present and strict' : 'Missing' };
  });

  await runTest('Fingerprint Removal: X-Powered-By is Stripped', 'Headers', 'Header absent', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const val = res.headers.get('x-powered-by');
    return { passed: val === null, actual: val ? `Leaked: ${val}` : 'Successfully stripped' };
  });

  await runTest('Fingerprint Removal: Server is Stripped', 'Headers', 'Header absent', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const val = res.headers.get('server');
    return { passed: val === null, actual: val ? `Leaked: ${val}` : 'Successfully stripped' };
  });

  // 3. Honeypot & Scanner Trap (Section 8.4)
  await runTest('Honeypot Trap: /.env probe', 'WAF / Honeypot', 'Status 404 & blocked', async () => {
    const res = await fetch(`${BASE_URL}/.env`);
    return { passed: res.status === 404, actual: `Status: ${res.status}` };
  });

  await runTest('Honeypot Trap: /.git/config probe', 'WAF / Honeypot', 'Status 404 & blocked', async () => {
    const res = await fetch(`${BASE_URL}/.git/config`);
    return { passed: res.status === 404, actual: `Status: ${res.status}` };
  });

  await runTest('Honeypot Trap: /wp-admin probe', 'WAF / Honeypot', 'Status 404 & blocked', async () => {
    const res = await fetch(`${BASE_URL}/wp-admin`);
    return { passed: res.status === 404, actual: `Status: ${res.status}` };
  });

  // 4. WAF Attack Vector Filters (Section 8.3)
  await runTest('WAF: SQL Injection filter (UNION SELECT)', 'WAF', 'Status 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/applications?search=${encodeURIComponent("' UNION SELECT 1,2,3--")}`);
    return { passed: res.status === 403, actual: `Status: ${res.status}` };
  });

  await runTest('WAF: Cross-Site Scripting filter (<script>)', 'WAF', 'Status 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/applications?search=${encodeURIComponent("<script>alert('xss')</script>")}`);
    return { passed: res.status === 403, actual: `Status: ${res.status}` };
  });

  await runTest('WAF: Path Traversal filter (../../etc/passwd)', 'WAF', 'Status 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/applications?file=${encodeURIComponent("../../etc/passwd")}`);
    return { passed: res.status === 403, actual: `Status: ${res.status}` };
  });

  await runTest('WAF: SSRF Cloud Metadata filter (169.254.169.254)', 'WAF', 'Status 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/applications?target=${encodeURIComponent("http://169.254.169.254/latest/meta-data")}`);
    return { passed: res.status === 403, actual: `Status: ${res.status}` };
  });

  await runTest('WAF: Disallowed Method filter (TRACE)', 'WAF', 'Status 405 Method Not Allowed', async () => {
    const http = await import('node:http');
    return new Promise((resolve) => {
      const url = new URL(`${BASE_URL}/api/health`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'TRACE',
        },
        (res) => {
          resolve({
            passed: res.statusCode === 405,
            actual: `Status: ${res.statusCode}`,
          });
        }
      );
      req.on('error', (err) => resolve({ passed: false, actual: `Req Error: ${err.message}` }));
      req.end();
    });
  });

  // 5. Rate Limiting Headers (Section 10)
  await runTest('Rate Limit: RateLimit Headers Present', 'Traffic Control', 'Headers Present', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const limit = res.headers.get('ratelimit-limit');
    const remaining = res.headers.get('ratelimit-remaining');
    const passed = limit !== null && remaining !== null;
    return { passed, actual: `Limit: ${limit}, Remaining: ${remaining}` };
  });

  // Print Summary Table
  console.log('\n----------------------------------------------------------------');
  console.log(' TEST RESULTS SUMMARY');
  console.log('----------------------------------------------------------------');
  let passedCount = 0;
  for (const r of results) {
    const icon = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${icon.padEnd(8)} [${r.category.padEnd(16)}] ${r.name}`);
    if (!r.passed) {
      console.log(`         Expected: ${r.expected}`);
      console.log(`         Actual:   ${r.actual}`);
    } else {
      passedCount++;
    }
  }

  console.log(`\n================================================================`);
  console.log(` TOTAL: ${passedCount} / ${results.length} PASSED (${Math.round((passedCount / results.length) * 100)}%)`);
  console.log(`================================================================\n`);
}

startSuite();
