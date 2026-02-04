#!/usr/bin/env node
/**
 * Generate a secure SESSION_SECRET for JengaTrack
 * Run with: node generate-session-secret.js
 */

import crypto from 'crypto';

// Generate a secure 64-character hex string (32 bytes = 64 hex characters)
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('🔐 Generated SESSION_SECRET:');
console.log('');
console.log(sessionSecret);
console.log('');
console.log('📝 Add this to your .env file:');
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log('');
console.log('💡 For Vercel, add this to your environment variables:');
console.log('   Variable: SESSION_SECRET');
console.log(`   Value: ${sessionSecret}`);
console.log('');

