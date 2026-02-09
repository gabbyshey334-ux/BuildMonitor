/**
 * Standalone WhatsApp Webhook Handler for Vercel
 * 
 * This is a minimal, working WhatsApp webhook that operates independently
 * of the main server codebase. It handles incoming Twilio WhatsApp messages
 * and responds directly.
 * 
 * Route: /webhook/webhook -> /api/whatsapp
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract Twilio webhook data
    const { From, Body, MessageSid } = req.body;
    
    if (!From) {
      console.error('[WhatsApp] Missing From field in request body');
      return res.status(400).json({ error: 'Missing From field' });
    }

    // Clean phone number (remove whatsapp: prefix)
    const phoneNumber = From.replace('whatsapp:', '').trim();
    const message = (Body || '').trim();

    console.log(`[WhatsApp] Received message from ${phoneNumber}: "${message}"`);
    console.log(`[WhatsApp] Message SID: ${MessageSid}`);

    // Look up user in profiles table (matches schema)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, whatsapp_number, onboarding_completed_at')
      .eq('whatsapp_number', phoneNumber)
      .single();

    if (profileError || !profile) {
      console.log(`[WhatsApp] User not found for ${phoneNumber}, sending registration prompt`);
      
      // Send registration prompt for new users
      await twilioClient.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to: From,
        body: '👋 Welcome to JengaTrack!\n\nPlease register at https://build-monitor-lac.vercel.app to get started.\n\nOnce registered, you can track your construction projects via WhatsApp!'
      });
      
      return res.status(200).send('<Response></Response>');
    }

    // User exists - send personalized response
    const userName = profile.full_name || 'there';
    const isOnboardingComplete = !!profile.onboarding_completed_at;

    if (!isOnboardingComplete) {
      // User hasn't completed onboarding
      await twilioClient.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to: From,
        body: `Hello ${userName}! 👋\n\nI see you haven't completed onboarding yet. Please visit https://build-monitor-lac.vercel.app to set up your first project.\n\nOnce set up, you can send me updates via WhatsApp!`
      });
    } else {
      // User has completed onboarding - simple acknowledgment
      await twilioClient.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to: From,
        body: `Hello ${userName}! 👋\n\nYou sent: "${message}"\n\nWhatsApp integration is working! I'll be able to help you track your projects soon.`
      });
    }

    // Log the message (optional - can be removed if database is having issues)
    try {
      await supabase
        .from('whatsapp_messages')
        .insert({
          user_id: profile.id,
          from_number: phoneNumber,
          message_body: message,
          message_sid: MessageSid,
          direction: 'inbound',
          received_at: new Date().toISOString(),
          processed: false,
        });
    } catch (logError) {
      // Non-critical - log error but don't fail the webhook
      console.warn('[WhatsApp] Failed to log message to database:', logError);
    }

    // Return TwiML response
    res.status(200).send('<Response></Response>');
  } catch (error: any) {
    console.error('[WhatsApp Error]', error);
    console.error('[WhatsApp Error Stack]', error.stack);
    
    // Try to send error message to user
    try {
      const { From } = req.body;
      if (From) {
        await twilioClient.messages.create({
          from: TWILIO_WHATSAPP_NUMBER,
          to: From,
          body: '⚠️ Sorry, I encountered an error processing your message. Please try again later.'
        });
      }
    } catch (sendError) {
      console.error('[WhatsApp] Failed to send error message:', sendError);
    }
    
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      // Only include stack in development
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
}

