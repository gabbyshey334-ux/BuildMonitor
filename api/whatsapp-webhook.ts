/**
 * Standalone WhatsApp Webhook for Vercel
 * This file works independently of the main build
 * 
 * Routes: /webhook/webhook -> /api/whatsapp-webhook
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[WhatsApp Webhook] =====================================');
    console.log('[WhatsApp Webhook] Received message');
    console.log('[WhatsApp Webhook] From:', req.body.From);
    console.log('[WhatsApp Webhook] Body:', req.body.Body);
    console.log('[WhatsApp Webhook] MessageSid:', req.body.MessageSid);
    console.log('[WhatsApp Webhook] =====================================');

    const { From, Body = '', MessageSid } = req.body;
    
    if (!From) {
      console.error('[WhatsApp Webhook] Missing From field');
      return res.status(400).json({ error: 'Missing From field' });
    }

    const phoneNumber = From.replace('whatsapp:', '').trim();
    const message = Body.trim();

    console.log(`[WhatsApp Webhook] Cleaned - Phone: ${phoneNumber}, Message: "${message}"`);

    // Build reply message
    const replyMessage = `👋 Hey there! Welcome to JengaTrack!

You sent: "${message}"

WhatsApp integration is working! 🎉

Your number: ${phoneNumber}

Next steps:
1. Register at https://build-monitor-lac.vercel.app
2. Set your WhatsApp number to: ${phoneNumber}
3. Then we can start tracking your projects!

This is a test response - full features coming soon!`;

    console.log('[WhatsApp Webhook] Sending TwiML response');

    // Send TwiML response (Twilio expects XML)
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyMessage}</Message>
</Response>`);

    console.log('[WhatsApp Webhook] Response sent successfully');

  } catch (error: any) {
    console.error('[WhatsApp Webhook] ERROR:', error);
    console.error('[WhatsApp Webhook] ERROR Stack:', error.stack);
    
    // Send error response as TwiML
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>⚠️ Sorry, there was an error processing your message. Please try again.</Message>
</Response>`);
  }
}

