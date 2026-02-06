import twilio from 'twilio';

// Validate required environment variables
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  console.warn('⚠️  Twilio credentials not configured. WhatsApp features will not work.');
  console.warn('   Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file');
}

// Initialize Twilio client
export const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

/**
 * Send a WhatsApp message via Twilio
 */
export async function sendWhatsAppMessage(
  to: string, // format: +256XXXXXXXXX or whatsapp:+256XXXXXXXXX
  message: string
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  console.log('[Twilio Send] ========================================');
  console.log('[Twilio Send] Attempting to send WhatsApp message');
  console.log('[Twilio Send] To:', to);
  console.log('[Twilio Send] Message length:', message.length);
  console.log('[Twilio Send] Message preview:', message.substring(0, 100));
  
  if (!twilioClient) {
    console.error('[Twilio Send] ❌ Twilio client not initialized');
    console.error('[Twilio Send] Environment check:', {
      hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasWhatsAppNumber: !!process.env.TWILIO_WHATSAPP_NUMBER,
    });
    return {
      success: false,
      error: 'Twilio is not configured. Check your environment variables.',
    };
  }

  try {
    // Ensure 'whatsapp:' prefix
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    console.log('[Twilio Send] From:', TWILIO_WHATSAPP_NUMBER);
    console.log('[Twilio Send] To (formatted):', toNumber);
    
    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_WHATSAPP_NUMBER,
      to: toNumber,
    });

    console.log('[Twilio Send] ✅ Message sent successfully');
    console.log('[Twilio Send] Message SID:', result.sid);
    console.log('[Twilio Send] Status:', result.status);
    console.log('[Twilio Send] ========================================');
    
    return {
      success: true,
      messageSid: result.sid,
    };
  } catch (error: any) {
    console.error('[Twilio Send] ❌ Failed to send WhatsApp message');
    console.error('[Twilio Send] Error:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      status: error?.status,
      stack: error?.stack,
    });
    console.error('[Twilio Send] ========================================');
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Send a WhatsApp message with media (image/document)
 */
export async function sendWhatsAppMedia(
  to: string,
  message: string,
  mediaUrl: string
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!twilioClient) {
    return {
      success: false,
      error: 'Twilio is not configured. Check your environment variables.',
    };
  }

  try {
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_WHATSAPP_NUMBER,
      to: toNumber,
      mediaUrl: [mediaUrl],
    });

    console.log(`✅ WhatsApp media message sent: ${result.sid}`);
    
    return {
      success: true,
      messageSid: result.sid,
    };
  } catch (error: any) {
    console.error('❌ Failed to send WhatsApp media message:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Validate Twilio webhook signature to ensure requests come from Twilio
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, any>
): boolean {
  if (!process.env.TWILIO_AUTH_TOKEN) {
    console.warn('⚠️  Cannot validate Twilio signature: TWILIO_AUTH_TOKEN not set');
    return false;
  }

  const webhookSecret = process.env.TWILIO_WEBHOOK_SECRET || process.env.TWILIO_AUTH_TOKEN;
  return twilio.validateRequest(webhookSecret, signature, url, params);
}

/**
 * Parse incoming Twilio webhook payload
 */
export interface TwilioWebhookPayload {
  MessageSid: string;
  From: string; // format: whatsapp:+256XXXXXXXXX
  To: string;
  Body: string;
  NumMedia: string; // number of media attachments
  MediaUrl0?: string;
  MediaContentType0?: string;
  [key: string]: any; // Allow additional fields
}

export function parseTwilioWebhook(body: any): TwilioWebhookPayload {
  return {
    MessageSid: body.MessageSid || '',
    From: body.From || '',
    To: body.To || '',
    Body: body.Body || '',
    NumMedia: body.NumMedia || '0',
    MediaUrl0: body.MediaUrl0,
    MediaContentType0: body.MediaContentType0,
    ...body,
  };
}

/**
 * Extract WhatsApp number from Twilio format (removes 'whatsapp:' prefix)
 */
export function extractWhatsAppNumber(twilioNumber: string): string {
  return twilioNumber.replace('whatsapp:', '');
}

/**
 * Format WhatsApp number for Twilio (adds 'whatsapp:' prefix if not present)
 */
export function formatWhatsAppNumber(number: string): string {
  return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
}

/**
 * Send WhatsApp message with interactive buttons
 * 
 * Note: Twilio sandbox has limited support for interactive messages.
 * For production, use WhatsApp Business API with approved templates.
 * 
 * This implementation uses numbered options for sandbox mode.
 * In production with WhatsApp Business API, we can use proper interactive buttons.
 */
export async function sendInteractiveButtons(
  to: string,
  message: string,
  buttons: Array<{ id: string; title: string }>
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  if (!twilioClient) {
    return {
      success: false,
      error: 'Twilio is not configured. Check your environment variables.',
    };
  }

  try {
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    // Limit to 3 buttons (WhatsApp Business API limit)
    const limitedButtons = buttons.slice(0, 3);
    
    // For Twilio sandbox, we'll send the message with numbered options
    // Format: "1. Option 1\n2. Option 2\n3. Option 3"
    const buttonList = limitedButtons
      .map((btn, index) => `${index + 1}. ${btn.title}`)
      .join('\n');
    
    const fullMessage = `${message}\n\n${buttonList}\n\n(Reply with the number or button text)`;
    
    const result = await twilioClient.messages.create({
      body: fullMessage,
      from: TWILIO_WHATSAPP_NUMBER,
      to: toNumber,
    });

    console.log(`✅ WhatsApp interactive message sent: ${result.sid}`);
    console.log(`   Buttons: ${limitedButtons.map(b => b.title).join(', ')}`);
    
    return {
      success: true,
      messageSid: result.sid,
    };
  } catch (error: any) {
    console.error('❌ Failed to send WhatsApp interactive message:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Parse button response from user message
 * Handles both numeric responses (1, 2, 3) and button IDs
 */
export function parseButtonResponse(
  message: string,
  buttons: Array<{ id: string; title: string }>
): string | null {
  const trimmed = message.trim().toLowerCase();
  
  // Check for numeric response (1, 2, 3, etc.)
  const numberMatch = trimmed.match(/^(\d+)/);
  if (numberMatch) {
    const index = parseInt(numberMatch[1]) - 1;
    if (index >= 0 && index < buttons.length) {
      return buttons[index].id;
    }
  }
  
  // Check for button ID match
  const buttonId = buttons.find(btn => 
    btn.id.toLowerCase() === trimmed || 
    btn.title.toLowerCase() === trimmed
  );
  
  if (buttonId) {
    return buttonId.id;
  }
  
  return null;
}


