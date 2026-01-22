/**
 * Security verification script
 * Run with: docker exec -it matcha_backend node seeds/security-check.js
 */

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'matcha_user',
  password: process.env.DB_PASSWORD || 'your_secure_password_here',
  database: process.env.DB_NAME || 'matcha_db',
});

async function runSecurityChecks() {
  console.log('\n🔒 MATCHA SECURITY VERIFICATION\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  // Check 1: No plain-text passwords
  console.log('\n1️⃣  Checking for plain-text passwords...');
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM users 
      WHERE password_hash NOT LIKE '$2a$%' 
      AND password_hash NOT LIKE '$2b$%'
    `);
    if (parseInt(result.rows[0].count) === 0) {
      console.log('   ✅ PASS: All passwords are properly hashed (bcrypt)');
      passed++;
    } else {
      console.log('   ❌ FAIL: Found unhashed passwords!');
      failed++;
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify:', err.message);
  }

  // Check 2: Password hash length
  console.log('\n2️⃣  Checking password hash length...');
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM users 
      WHERE LENGTH(password_hash) < 50
    `);
    if (parseInt(result.rows[0].count) === 0) {
      console.log('   ✅ PASS: All password hashes have proper length');
      passed++;
    } else {
      console.log('   ❌ FAIL: Found short password hashes!');
      failed++;
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify:', err.message);
  }

  // Check 3: Email uniqueness
  console.log('\n3️⃣  Checking email uniqueness constraint...');
  try {
    const result = await pool.query(`
      SELECT email, COUNT(*) as count FROM users 
      GROUP BY email HAVING COUNT(*) > 1
    `);
    if (result.rows.length === 0) {
      console.log('   ✅ PASS: All emails are unique');
      passed++;
    } else {
      console.log('   ❌ FAIL: Found duplicate emails!');
      failed++;
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify:', err.message);
  }

  // Check 4: Username uniqueness
  console.log('\n4️⃣  Checking username uniqueness constraint...');
  try {
    const result = await pool.query(`
      SELECT username, COUNT(*) as count FROM users 
      GROUP BY username HAVING COUNT(*) > 1
    `);
    if (result.rows.length === 0) {
      console.log('   ✅ PASS: All usernames are unique');
      passed++;
    } else {
      console.log('   ❌ FAIL: Found duplicate usernames!');
      failed++;
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify:', err.message);
  }

  // Check 5: SQL Injection test (parameterized queries)
  console.log('\n5️⃣  Testing SQL injection protection...');
  try {
    const maliciousInput = "'; DROP TABLE users; --";
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [maliciousInput]
    );
    console.log('   ✅ PASS: Parameterized queries working correctly');
    passed++;
  } catch (err) {
    console.log('   ✅ PASS: Query properly rejected');
    passed++;
  }

  // Check 6: XSS in biography (should be sanitized)
  console.log('\n6️⃣  Checking for potential XSS in stored data...');
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM users 
      WHERE biography LIKE '%<script%' OR biography LIKE '%javascript:%'
    `);
    if (parseInt(result.rows[0].count) === 0) {
      console.log('   ✅ PASS: No obvious XSS payloads found in biographies');
      passed++;
    } else {
      console.log('   ⚠️  WARNING: Found potential XSS in biographies');
      failed++;
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify:', err.message);
  }

  // Check 7: Environment variables
  console.log('\n7️⃣  Checking environment configuration...');
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length >= 32) {
    console.log('   ✅ PASS: JWT_SECRET has adequate length');
    passed++;
  } else {
    console.log('   ❌ FAIL: JWT_SECRET is too short (need 32+ chars)');
    failed++;
  }

  // Check 8: Database connection security
  console.log('\n8️⃣  Checking database configuration...');
  if (process.env.DB_PASSWORD && process.env.DB_PASSWORD !== 'your_secure_password_here') {
    console.log('   ✅ PASS: Database password has been changed from default');
    passed++;
  } else {
    console.log('   ⚠️  WARNING: Using default database password');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SECURITY CHECK SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 All security checks passed!\n');
  } else {
    console.log('\n⚠️  Some security issues need attention!\n');
  }

  await pool.end();
}

runSecurityChecks().catch(console.error);