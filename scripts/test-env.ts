#!/usr/bin/env tsx
/**
 * Test Environment Variables Script
 * Checks if all required environment variables are set
 */

import { config } from 'dotenv';
config(); // Load .env file

console.log('🔍 Checking Environment Variables...\n');

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_NUMBER',
  'OPENAI_API_KEY',
  'SESSION_SECRET',
  'NODE_ENV',
  'PORT',
];

const optionalEnvVars = [
  'FRONTEND_URL',
];

let allPassed = true;
const missing: string[] = [];
const present: string[] = [];

// Check required variables
console.log('📋 Required Environment Variables:');
console.log('─────────────────────────────────────\n');

for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];
  
  if (!value || value.trim() === '') {
    console.log(`❌ ${envVar}: NOT SET`);
    missing.push(envVar);
    allPassed = false;
  } else {
    // Mask sensitive values
    const maskedValue = envVar.includes('KEY') || envVar.includes('SECRET') || envVar.includes('TOKEN')
      ? `${value.substring(0, 8)}${'*'.repeat(Math.max(0, value.length - 8))}`
      : value;
    
    console.log(`✅ ${envVar}: ${maskedValue}`);
    present.push(envVar);
  }
}

console.log('\n📋 Optional Environment Variables:');
console.log('─────────────────────────────────────\n');

for (const envVar of optionalEnvVars) {
  const value = process.env[envVar];
  
  if (!value || value.trim() === '') {
    console.log(`⚠️  ${envVar}: NOT SET (optional)`);
  } else {
    console.log(`✅ ${envVar}: ${value}`);
  }
}

// Test Twilio credentials format
console.log('\n🔍 Validating Twilio Configuration:');
console.log('─────────────────────────────────────\n');

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

if (twilioSid && twilioSid.startsWith('AC')) {
  console.log('✅ TWILIO_ACCOUNT_SID format is valid (starts with AC)');
} else if (twilioSid) {
  console.log('❌ TWILIO_ACCOUNT_SID format is invalid (should start with AC)');
  allPassed = false;
}

if (twilioAuthToken && twilioAuthToken.length >= 32) {
  console.log('✅ TWILIO_AUTH_TOKEN length is valid');
} else if (twilioAuthToken) {
  console.log('⚠️  TWILIO_AUTH_TOKEN might be invalid (should be 32+ characters)');
}

if (twilioWhatsAppNumber) {
  if (twilioWhatsAppNumber.startsWith('whatsapp:+')) {
    console.log(`✅ TWILIO_WHATSAPP_NUMBER format is valid: ${twilioWhatsAppNumber}`);
  } else if (twilioWhatsAppNumber.startsWith('+')) {
    console.log(`⚠️  TWILIO_WHATSAPP_NUMBER missing 'whatsapp:' prefix: ${twilioWhatsAppNumber}`);
    console.log('   Should be: whatsapp:' + twilioWhatsAppNumber);
  } else {
    console.log('❌ TWILIO_WHATSAPP_NUMBER format is invalid (should start with whatsapp:+)');
    allPassed = false;
  }
}

// Test database URL format
console.log('\n🔍 Validating Database Configuration:');
console.log('─────────────────────────────────────\n');

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    console.log('✅ DATABASE_URL format is valid');
    
    // Extract host and database name
    try {
      const url = new URL(databaseUrl);
      console.log(`   Host: ${url.hostname}`);
      console.log(`   Port: ${url.port || '5432'}`);
      console.log(`   Database: ${url.pathname.substring(1)}`);
    } catch (e) {
      console.log('⚠️  DATABASE_URL might be malformed');
    }
  } else {
    console.log('❌ DATABASE_URL format is invalid (should start with postgres:// or postgresql://)');
    allPassed = false;
  }
}

// Test Supabase URL format
console.log('\n🔍 Validating Supabase Configuration:');
console.log('─────────────────────────────────────\n');

const supabaseUrl = process.env.SUPABASE_URL;
if (supabaseUrl) {
  if (supabaseUrl.includes('.supabase.co')) {
    console.log(`✅ SUPABASE_URL format is valid: ${supabaseUrl}`);
  } else {
    console.log('⚠️  SUPABASE_URL might be invalid (doesn\'t contain .supabase.co)');
  }
}

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (supabaseAnonKey && supabaseAnonKey.startsWith('eyJ')) {
  console.log('✅ SUPABASE_ANON_KEY format is valid (JWT)');
} else if (supabaseAnonKey) {
  console.log('⚠️  SUPABASE_ANON_KEY might be invalid (should be a JWT starting with eyJ)');
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (supabaseServiceKey && supabaseServiceKey.startsWith('eyJ')) {
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY format is valid (JWT)');
} else if (supabaseServiceKey) {
  console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY might be invalid (should be a JWT starting with eyJ)');
}

// Test OpenAI API key format
console.log('\n🔍 Validating OpenAI Configuration:');
console.log('─────────────────────────────────────\n');

const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey && openaiKey.startsWith('sk-')) {
  console.log('✅ OPENAI_API_KEY format is valid (starts with sk-)');
} else if (openaiKey) {
  console.log('⚠️  OPENAI_API_KEY might be invalid (should start with sk-)');
}

// Test session secret
console.log('\n🔍 Validating Session Configuration:');
console.log('─────────────────────────────────────\n');

const sessionSecret = process.env.SESSION_SECRET;
if (sessionSecret && sessionSecret.length >= 32) {
  console.log('✅ SESSION_SECRET is strong (32+ characters)');
} else if (sessionSecret && sessionSecret.length >= 16) {
  console.log('⚠️  SESSION_SECRET is weak (less than 32 characters)');
} else if (sessionSecret) {
  console.log('❌ SESSION_SECRET is too weak (less than 16 characters)');
  allPassed = false;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Summary:');
console.log('='.repeat(50) + '\n');

console.log(`✅ Present: ${present.length}/${requiredEnvVars.length} required variables`);
if (missing.length > 0) {
  console.log(`❌ Missing: ${missing.length} required variables`);
  console.log(`   ${missing.join(', ')}`);
}

if (allPassed) {
  console.log('\n✅ All environment variables are properly configured!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some environment variables are missing or invalid.\n');
  console.log('💡 Create a .env file with the required variables.');
  console.log('   See .env.example for reference.\n');
  process.exit(1);
}

