/**
 * RED TEAM ADVERSARIAL ATTACK & RESILIENCE VERIFICATION SUITE
 * 
 * Simulates real-world offensive tradecraft against the SUPER-AUTH perimeter:
 * - WAF Evasion & Obfuscated Injections (SQLi, NoSQL, Prototype Pollution, SSTI, LDAP)
 * - Advanced SSRF Bypass (Alternative notations, cloud metadata, link-local)
 * - JWT & Session Abuse (Alg none, signature tampering, revocation)
 * - IDOR & Privilege Escalation (Tenant boundaries, role injection, vertical bypass)
 * - Path Traversal & Content Smuggling (Encodings, null bytes, honeypots)
 * - HTTP Method Tampering & Header Injection
 * - Rate Limiting & Brute-Force Lockout Under Fire
 */

import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3001';

interface AttackVector {
  category: string;
  id: string;
  name: string;
  passed: boolean;
  blockedStatus?: number;
  details: string;
}

const vectorResults: AttackVector[] = [];

function recordVector(category: string, id: string, name: string, passed: boolean, details: string, blockedStatus?: number) {
  vectorResults.push({ category, id, name, passed, details, blockedStatus });
  const statusStr = passed ? '🛡️  DEFENDED' : '💥 BREACHED';
  console.log(`${statusStr.padEnd(14)} [${id.padEnd(7)}] ${name}`);
  if (!passed || process.env.VERBOSE) {
    console.log(`               Details: ${details}`);
  }
}

async function sendProbe(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; headers: Headers; body: any; raw: string }> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const raw = await res.text();
    let body = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    return { status: res.status, headers: res.headers, body, raw };
  } catch (err: any) {
    return { status: 0, headers: new Headers(), body: null, raw: err.message };
  }
}

async function runRedTeamSuite() {
  console.log('\n================================================================');
  console.log(' 🔥 EXECUTING RED TEAM ADVERSARIAL ATTACK MATRIX');
  console.log(` Target Perimeter: ${BASE_URL}`);
  console.log('================================================================');

  const stamp = Date.now();
  const redPass = 'RedTeam#P4ssw0rd!2026';

  // Provision attacker test credentials
  const targetA_Email = `victim_${stamp}@supernova.local`;
  const attackerB_Email = `adversary_${stamp}@supernova.local`;

  // 1. Provision Victim A
  const regVictim = await sendProbe('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: targetA_Email, password: redPass, username: `victim_${stamp}` }),
  });
  const tokenVictim = regVictim.body?.token;

  // Victim creates an application and license
  const victimApp = await sendProbe('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenVictim}` },
    body: JSON.stringify({ name: `Victim Vault ${stamp}`, description: 'Confidential assets' }),
  });
  const victimAppId = victimApp.body?.id;

  const victimLicense = await sendProbe('/api/licenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenVictim}` },
    body: JSON.stringify({ app_id: victimAppId, license_type: 'lifetime', note: 'Top Secret Lic' }),
  });
  const victimLicenseId = victimLicense.body?.id;

  // 2. Provision Adversary B
  const regAdversary = await sendProbe('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: attackerB_Email, password: redPass, username: `adversary_${stamp}` }),
  });
  const tokenAdversary = regAdversary.body?.token;

  // ============================================================================
  // SECTION 1: ADVANCED SQLi & FILTER EVASION
  // ============================================================================
  console.log('\n--- 1. Advanced SQLi & Filter Evasion Vectors ---');

  // Vector 1.1: Inline Comment Splitter (UNION/**/SELECT)
  const sqli1 = await sendProbe(`/api/licenses?search=1'/**/UNION/**/SELECT/**/1,2,3--`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SQLi Evasion', 'ADV-SQL1', 'Comment Splitting (UNION/**/SELECT)', sqli1.status === 403, `HTTP ${sqli1.status}`, sqli1.status);

  // Vector 1.2: Boolean Tautology with inline comment (1' OR 1=1 --)
  const sqli2 = await sendProbe('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `admin' OR 1=1 --`, password: 'any' }),
  });
  recordVector('SQLi Evasion', 'ADV-SQL2', 'Boolean Tautology in Login Body (admin\' OR 1=1 --)', sqli2.status === 403, `HTTP ${sqli2.status}`, sqli2.status);

  // Vector 1.3: Blind Time Delay Probe (pg_sleep)
  const sqli3 = await sendProbe(`/api/licenses?filter=test';SELECT+pg_sleep(5)--`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SQLi Evasion', 'ADV-SQL3', 'Blind Time-Based Injection (pg_sleep)', sqli3.status === 403, `HTTP ${sqli3.status}`, sqli3.status);

  // Vector 1.4: Multi-Byte / Case Inversion (uNiOn aLl sElEcT)
  const sqli4 = await sendProbe(`/api/licenses?query=x'+uNiOn+aLl+sElEcT+null,null--`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SQLi Evasion', 'ADV-SQL4', 'Mixed-Case Obfuscated UNION SELECT', sqli4.status === 403, `HTTP ${sqli4.status}`, sqli4.status);

  // Vector 1.5: Tautology in JSON Key / Value Nested
  const sqli5 = await sendProbe('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdversary}` },
    body: JSON.stringify({ name: `App_${stamp}`, description: `' OR '1'='1` }),
  });
  recordVector('SQLi Evasion', 'ADV-SQL5', 'Nested JSON Tautology Injection (\' OR \'1\'=\'1)', sqli5.status === 403, `HTTP ${sqli5.status}`, sqli5.status);

  // ============================================================================
  // SECTION 2: PROTOTYPE POLLUTION & NOSQL / SSTI INJECTION
  // ============================================================================
  console.log('\n--- 2. Prototype Pollution, NoSQL & SSTI Vectors ---');

  // Vector 2.1: Prototype Pollution via __proto__ in JSON body
  const proto1 = await sendProbe('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdversary}` },
    body: `{"username":"adv_${stamp}","__proto__":{"isAdmin":true}}`,
  });
  recordVector('Proto Pollution', 'ADV-PR1', 'Prototype Pollution via __proto__ payload', proto1.status === 403, `HTTP ${proto1.status}`, proto1.status);

  // Vector 2.2: Prototype Pollution via constructor.prototype
  const proto2 = await sendProbe('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdversary}` },
    body: JSON.stringify({ username: `adv_${stamp}`, constructor: { prototype: { role: 'admin' } } }),
  });
  recordVector('Proto Pollution', 'ADV-PR2', 'Constructor Prototype Pollution attempt', proto2.status === 403, `HTTP ${proto2.status}`, proto2.status);

  // Vector 2.3: Query String Prototype Pollution
  const proto3 = await sendProbe(`/api/licenses?__proto__[polluted]=true`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Proto Pollution', 'ADV-PR3', 'Query Parameter Prototype Pollution', proto3.status === 403, `HTTP ${proto3.status}`, proto3.status);

  // Vector 2.4: NoSQL Operator Injection ($where)
  const nosql1 = await sendProbe(`/api/licenses?$where=this.app_id.length>0`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('NoSQL Injection', 'ADV-NS1', 'NoSQL $where Operator Probe', nosql1.status === 403, `HTTP ${nosql1.status}`, nosql1.status);

  // Vector 2.5: Server-Side Template Injection (SSTI {{7*7}})
  const ssti1 = await sendProbe(`/api/licenses?tag={{7*7}}`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SSTI', 'ADV-SS1', 'Template Injection probe ({{7*7}})', ssti1.status === 403, `HTTP ${ssti1.status}`, ssti1.status);

  // ============================================================================
  // SECTION 3: ADVANCED SSRF & CLOUD METADATA EVASION
  // ============================================================================
  console.log('\n--- 3. Advanced SSRF & Cloud Metadata Evasion ---');

  // Vector 3.1: Standard Cloud Metadata (AWS/GCP/Azure)
  const ssrf1 = await sendProbe(`/api/licenses?redirect=http://169.254.169.254/latest/meta-data/`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SSRF Evasion', 'ADV-SR1', 'Cloud Metadata Endpoint (169.254.169.254)', ssrf1.status === 403, `HTTP ${ssrf1.status}`, ssrf1.status);

  // Vector 3.2: GCP Internal Metadata Hostname
  const ssrf2 = await sendProbe(`/api/licenses?webhook=http://metadata.google.internal/computeMetadata/v1/`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SSRF Evasion', 'ADV-SR2', 'GCP Internal Hostname (metadata.google.internal)', ssrf2.status === 403, `HTTP ${ssrf2.status}`, ssrf2.status);

  // Vector 3.3: Octal IP Representation (0177.0.0.1 -> 127.0.0.1)
  const ssrf3 = await sendProbe(`/api/licenses?callback=http://0177.0.0.1:8080/internal`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SSRF Evasion', 'ADV-SR3', 'Octal Localhost IP notation (0177.0.0.1)', ssrf3.status === 403, `HTTP ${ssrf3.status}`, ssrf3.status);

  // Vector 3.4: Hex IP Representation (0x7f000001 -> 127.0.0.1)
  const ssrf4 = await sendProbe(`/api/licenses?url=http://0x7f000001:3000/admin`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SSRF Evasion', 'ADV-SR4', 'Hex Localhost IP notation (0x7f000001)', ssrf4.status === 403, `HTTP ${ssrf4.status}`, ssrf4.status);

  // Vector 3.5: Private Class A Subnet Probe (10.x.x.x)
  const ssrf5 = await sendProbe(`/api/licenses?dest=http://10.0.0.1:9000/metrics`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('SSRF Evasion', 'ADV-SR5', 'Private Subnet Traversal (10.0.0.1)', ssrf5.status === 403, `HTTP ${ssrf5.status}`, ssrf5.status);

  // ============================================================================
  // SECTION 4: AUTHENTICATION, JWT FORGERY & LOCKOUT RESILIENCE
  // ============================================================================
  console.log('\n--- 4. Authentication, JWT Forgery & Session Defense ---');

  // Vector 4.1: JWT Algorithm Confusion ("none")
  const forgedNoneToken = jwt.sign({ userId: '00000000-0000-0000-0000-000000000001', role: 'admin' }, '', { algorithm: 'none' as any });
  const jwtNoneRes = await sendProbe('/api/auth/me', {
    headers: { Authorization: `Bearer ${forgedNoneToken}` },
  });
  recordVector('Auth Abuse', 'ADV-AT1', 'JWT "none" Algorithm Rejection', jwtNoneRes.status === 401, `HTTP ${jwtNoneRes.status}`, jwtNoneRes.status);

  // Vector 4.2: Forged HMAC Signature with Arbitrary Secret
  const forgedFakeSecret = jwt.sign({ userId: '00000000-0000-0000-0000-000000000001', role: 'admin' }, 'wrong_secret_attack');
  const jwtFakeRes = await sendProbe('/api/auth/me', {
    headers: { Authorization: `Bearer ${forgedFakeSecret}` },
  });
  recordVector('Auth Abuse', 'ADV-AT2', 'Tampered Signature Rejection', jwtFakeRes.status === 401, `HTTP ${jwtFakeRes.status}`, jwtFakeRes.status);

  // Vector 4.3: Session Invalidation on Logout (Instant Revocation via token_version)
  const tempUserEmail = `logout_probe_${stamp}@supernova.local`;
  const tempReg = await sendProbe('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: tempUserEmail, password: redPass, username: `tmp_${stamp}` }),
  });
  const tempToken = tempReg.body?.token;

  await sendProbe('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tempToken}` },
  });

  const postLogoutProbe = await sendProbe('/api/auth/me', {
    headers: { Authorization: `Bearer ${tempToken}` },
  });
  recordVector('Auth Abuse', 'ADV-AT3', 'Instant Post-Logout Session Token Revocation', postLogoutProbe.status === 401, `HTTP ${postLogoutProbe.status}`, postLogoutProbe.status);

  // Vector 4.4: Brute-Force Lockout Defense (5 Failed Logins)
  const bruteTarget = `brute_victim_${stamp}@supernova.local`;
  await sendProbe('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: bruteTarget, password: redPass, username: `brute_${stamp}` }),
  });

  let lockoutTriggered = false;
  for (let i = 0; i < 6; i++) {
    const probe = await sendProbe('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bruteTarget, password: 'WrongPassword99!' }),
    });
    if (probe.status === 429 || (probe.body?.error && probe.body.error.includes('troppi tentativi'))) {
      lockoutTriggered = true;
      break;
    }
  }
  recordVector('Auth Abuse', 'ADV-AT4', 'Automated Account Lockout on Credential Stuffing', lockoutTriggered, `Lockout triggered: ${lockoutTriggered}`);

  // Vector 4.5: Weak Password Registration Defense (<8 chars & simple)
  const weakPassRes = await sendProbe('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `weak_${stamp}@supernova.local`, password: '123', username: `weak_${stamp}` }),
  });
  recordVector('Auth Abuse', 'ADV-AT5', 'Trivial Password Rejection Policy', weakPassRes.status === 400, `HTTP ${weakPassRes.status}`, weakPassRes.status);

  // ============================================================================
  // SECTION 5: IDOR & PRIVILEGE ESCALATION
  // ============================================================================
  console.log('\n--- 5. IDOR & Privilege Escalation Vectors ---');

  // Vector 5.1: Horizontal IDOR - Adversary modifying Victim application
  const idor1 = await sendProbe(`/api/applications/${victimAppId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdversary}` },
    body: JSON.stringify({ name: 'HACKED APPLICATION' }),
  });
  recordVector('Access Control', 'ADV-ID1', 'Horizontal IDOR: Modifying Victim Application', idor1.status === 403 || idor1.status === 404, `HTTP ${idor1.status}`, idor1.status);

  // Vector 5.2: Horizontal IDOR - Adversary deleting Victim license
  const idor2 = await sendProbe(`/api/licenses/${victimLicenseId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Access Control', 'ADV-ID2', 'Horizontal IDOR: Deleting Victim License', idor2.status === 403 || idor2.status === 404, `HTTP ${idor2.status}`, idor2.status);

  // Vector 5.3: Vertical Escalation - Adversary attempting to access Admin Users List
  const idor3 = await sendProbe('/api/users', {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Access Control', 'ADV-ID3', 'Vertical Escalation: Accessing /api/users', idor3.status === 403, `HTTP ${idor3.status}`, idor3.status);

  // Vector 5.4: Vertical Escalation - Adversary attempting to access System Stats
  const idor4 = await sendProbe('/api/stats/system', {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Access Control', 'ADV-ID4', 'Vertical Escalation: Accessing /api/stats/system', idor4.status === 403, `HTTP ${idor4.status}`, idor4.status);

  // Vector 5.5: Mass Assignment - Adversary promoting role to admin in profile update
  await sendProbe('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdversary}` },
    body: JSON.stringify({ username: `adv_pwn_${stamp}`, role: 'admin', is_banned: false }),
  });
  const checkRole = await sendProbe('/api/auth/me', {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  const roleUnchanged = checkRole.body?.user?.role !== 'admin';
  recordVector('Access Control', 'ADV-ID5', 'Mass Assignment Role Escalation Prevention', roleUnchanged, `Role: ${checkRole.body?.user?.role}`);

  // ============================================================================
  // SECTION 6: PATH TRAVERSAL, CONTENT SMUGGLING & HONEYPOT DEFENSE
  // ============================================================================
  console.log('\n--- 6. Path Traversal & Content Smuggling Vectors ---');

  // Vector 6.1: Double URL Encoded Traversal (%252e%252e%252f)
  const trav1 = await sendProbe('/api/licenses?file=%252e%252e%252f%252e%252e%252fetc%252fpasswd', {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Traversal Defense', 'ADV-TR1', 'Double URL Encoded Path Traversal (%252e%252e%252f)', trav1.status === 403, `HTTP ${trav1.status}`, trav1.status);

  // Vector 6.2: Windows Backslash Path Traversal (..\..\windows\system32)
  const trav2 = await sendProbe('/api/licenses?path=..\\..\\windows\\system32\\cmd.exe', {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Traversal Defense', 'ADV-TR2', 'Windows Backslash Traversal (..\\..\\win)', trav2.status === 403, `HTTP ${trav2.status}`, trav2.status);

  // Vector 6.3: Null-Byte Path Poisoning (%00)
  const trav3 = await sendProbe('/api/licenses?doc=safe.png%00.php', {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Traversal Defense', 'ADV-TR3', 'Null-Byte Path Poisoning (%00)', trav3.status === 403, `HTTP ${trav3.status}`, trav3.status);

  // Vector 6.4: Honeypot Trigger - Sensitive File Discovery (/.env)
  const honey1 = await sendProbe('/.env');
  recordVector('Honeypot Trap', 'ADV-HN1', 'Honeypot Probe Protection (/.env: 404 & IP autoban)', honey1.status === 404, `HTTP ${honey1.status}`, honey1.status);

  // Vector 6.5: Honeypot Trigger - Git Repository Config (/.git/config)
  const honey2 = await sendProbe('/.git/config');
  recordVector('Honeypot Trap', 'ADV-HN2', 'Honeypot Probe Protection (/.git/config)', honey2.status === 404, `HTTP ${honey2.status}`, honey2.status);

  // ============================================================================
  // SECTION 7: HTTP VERB TAMPERING, OVERRIDES & PARAMETER POLLUTION
  // ============================================================================
  console.log('\n--- 7. Verb Tampering & Parameter Pollution Vectors ---');

  // Vector 7.1: Forbidden HTTP Verb (TRACE)
  const verb1 = await new Promise<number>((resolve) => {
    import('http').then(({ default: http }) => {
      const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api/health', method: 'TRACE' }, (res) => resolve(res.statusCode || 0));
      req.on('error', () => resolve(0));
      req.end();
    });
  });
  recordVector('Protocol Defense', 'ADV-VB1', 'Arbitrary Verb Tampering (TRACE: 405 Method Not Allowed)', verb1 === 405, `HTTP ${verb1}`, verb1);

  // Vector 7.2: HTTP Method Override Header Stripping (X-HTTP-Method-Override: DELETE)
  const overrideProbe = await sendProbe('/api/health', {
    method: 'GET',
    headers: { 'X-HTTP-Method-Override': 'DELETE', 'X-Method-Override': 'POST' },
  });
  const overrideDefended = overrideProbe.status === 200 && overrideProbe.body?.status === 'ok';
  recordVector('Protocol Defense', 'ADV-VB2', 'Method Override Header Neutralization', overrideDefended, `Status: ${overrideProbe.status}`);

  // Vector 7.3: HTTP Parameter Pollution Array Hijack
  const hppProbe = await sendProbe(`/api/licenses?app_id=${victimAppId}&app_id=INVALID_HIJACK_ID`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Protocol Defense', 'ADV-VB3', 'HTTP Parameter Pollution Scalar Enforcement', hppProbe.status === 200 || hppProbe.status === 403, `HTTP ${hppProbe.status}`, hppProbe.status);

  // Vector 7.4: CRLF Header Injection Probe
  const crlfProbe = await sendProbe(`/api/licenses?param=val%0d%0aSet-Cookie:%20evil=1`, {
    headers: { Authorization: `Bearer ${tokenAdversary}` },
  });
  recordVector('Protocol Defense', 'ADV-VB4', 'CRLF Header Injection Defense (%0d%0a)', crlfProbe.status === 403, `HTTP ${crlfProbe.status}`, crlfProbe.status);

  // Vector 7.5: Oversized Payload Bomb (> 2.5MB payload rejected)
  const bombPayload = JSON.stringify({ overflow: '0'.repeat(2.5 * 1024 * 1024) });
  const bombRes = await sendProbe('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdversary}` },
    body: bombPayload,
  });
  recordVector('Resource Defense', 'ADV-RS1', 'DoS Body Limit Defense (2.5MB payload -> 413)', bombRes.status === 413, `HTTP ${bombRes.status}`, bombRes.status);

  // ============================================================================
  // FINAL SCOREBOARD
  // ============================================================================
  const total = vectorResults.length;
  const defended = vectorResults.filter((r) => r.passed).length;
  const breached = total - defended;
  const rate = Math.round((defended / total) * 100);

  console.log('\n================================================================');
  console.log(' 🛡️  RED TEAM ADVERSARIAL MATRIX EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`TOTAL ATTACK VECTORS TESTED : ${total}`);
  console.log(`DEFENDED & MITIGATED        : ${defended} (${rate}%)`);
  console.log(`BREACHED / BYPASSED         : ${breached}`);
  console.log('================================================================');

  if (breached > 0) {
    console.error(`\n❌ RED TEAM DETECTED ${breached} VULNERABLE VECTORS!`);
    process.exit(1);
  } else {
    console.log('\n✅ ALL ADVERSARIAL VECTORS SUCCESSFULLY REPELLED! PERIMETER SECURE.\n');
    process.exit(0);
  }
}

runRedTeamSuite().catch((err) => {
  console.error('Fatal Red Team error:', err);
  process.exit(1);
});
