/**
 * Environment Variable Checker
 * Run this script to verify all required environment variables are set
 * Usage: npx tsx scripts/check-env.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load .env.local file
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
  console.log(`✅ Loaded environment from .env.local\n`);
} else {
  console.log(`⚠️  No .env.local file found at ${envPath}\n`);
}

const requiredEnvVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ALLOWED_EMAIL_DOMAINS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'UIC_API_CLIENT_ID',
  'UIC_API_CLIENT_SECRET',
];

const optionalEnvVars = [
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
];

console.log('🔍 Checking environment variables...\n');

let missingRequired: string[] = [];
let missingOptional: string[] = [];

// Check required variables
console.log('📋 Required Variables:');
requiredEnvVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value) {
    console.log(`  ❌ ${varName} - MISSING`);
    missingRequired.push(varName);
  } else {
    // Mask the value for security
    const masked = value.length > 10 ? `${value.substring(0, 10)}...` : '***';
    console.log(`  ✅ ${varName} - ${masked}`);
  }
});

// Check optional variables
console.log('\n📋 Optional Variables:');
optionalEnvVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value) {
    console.log(`  ⚠️  ${varName} - Not set (optional)`);
    missingOptional.push(varName);
  } else {
    const masked = value.length > 10 ? `${value.substring(0, 10)}...` : '***';
    console.log(`  ✅ ${varName} - ${masked}`);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (missingRequired.length === 0) {
  console.log('✅ All required environment variables are set!');
  if (missingOptional.length > 0) {
    console.log(`⚠️  ${missingOptional.length} optional variable(s) not set:`);
    missingOptional.forEach(v => console.log(`   - ${v}`));
  }
  console.log('\n✨ Ready for deployment!');
  process.exit(0);
} else {
  console.log(`❌ Missing ${missingRequired.length} required environment variable(s):`);
  missingRequired.forEach(v => console.log(`   - ${v}`));
  console.log('\n🔧 Please set these variables in your .env.local file');
  console.log('   or in Vercel environment settings before deploying.');
  process.exit(1);
}
