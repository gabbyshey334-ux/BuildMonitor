#!/usr/bin/env tsx
/**
 * Test Health Endpoint Script
 * Tests the /health endpoint to verify server is running correctly
 */

import { config } from 'dotenv';
config(); // Load .env file

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

console.log('🏥 Testing Health Endpoint...\n');
console.log(`Target: ${BASE_URL}/health\n`);
console.log('─────────────────────────────────────\n');

async function testHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    console.log(`Status Code: ${response.status} ${response.statusText}`);
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n─────────────────────────────────────\n');

    // Check overall status
    if (data.status === 'ok') {
      console.log('✅ Server Status: OK');
    } else if (data.status === 'degraded') {
      console.log('⚠️  Server Status: DEGRADED');
    } else {
      console.log('❌ Server Status: UNKNOWN');
    }

    // Check database connection
    if (data.database?.connected) {
      console.log('✅ Database: CONNECTED');
    } else {
      console.log('❌ Database: DISCONNECTED');
      if (data.database?.error) {
        console.log(`   Error: ${data.database.error}`);
      }
    }

    // Check services
    console.log('\n📋 Services Configuration:');
    if (data.services) {
      Object.entries(data.services).forEach(([service, status]) => {
        const icon = status === 'configured' ? '✅' : '⚠️ ';
        console.log(`${icon} ${service}: ${status}`);
      });
    }

    // Check timestamp
    if (data.timestamp) {
      const serverTime = new Date(data.timestamp);
      const localTime = new Date();
      const timeDiff = Math.abs(localTime.getTime() - serverTime.getTime());
      
      console.log('\n⏰ Server Time:');
      console.log(`   Server: ${serverTime.toISOString()}`);
      console.log(`   Local:  ${localTime.toISOString()}`);
      
      if (timeDiff > 60000) { // More than 1 minute difference
        console.log(`   ⚠️  Time difference: ${Math.round(timeDiff / 1000)}s (server time may be off)`);
      } else {
        console.log('   ✅ Server time is synchronized');
      }
    }

    // Check uptime
    if (data.uptime !== undefined) {
      const uptimeMinutes = Math.floor(data.uptime / 60);
      const uptimeSeconds = Math.floor(data.uptime % 60);
      console.log(`\n⏱️  Server Uptime: ${uptimeMinutes}m ${uptimeSeconds}s`);
    }

    console.log('\n─────────────────────────────────────\n');

    if (response.status === 200 && data.status === 'ok' && data.database?.connected) {
      console.log('✅ Health check passed!\n');
      process.exit(0);
    } else if (response.status === 503) {
      console.log('⚠️  Health check returned degraded status.\n');
      console.log('💡 Check database connection and environment variables.\n');
      process.exit(1);
    } else {
      console.log('❌ Health check failed!\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Failed to connect to server:\n');
    console.error(`   ${error.message}\n`);
    console.log('💡 Make sure the server is running:');
    console.log(`   npm run dev\n`);
    process.exit(1);
  }
}

testHealth();

