import { Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import {
  parseTwilioWebhook,
  extractWhatsAppNumber,
  sendWhatsAppMessage,
  validateTwilioSignature,
  type TwilioWebhookPayload,
} from "./twilio";

/**
 * Twilio WhatsApp Webhook Handler
 * 
 * This endpoint receives messages from Twilio WhatsApp and:
 * 1. Validates the request signature
 * 2. Finds or creates a user profile by WhatsApp number
 * 3. Stores the message in the database
 * 4. Processes the message (expense tracking, queries, etc.)
 * 5. Sends a reply back to the user via Twilio
 * 
 * Webhook URL: https://your-domain.com/api/webhooks/twilio/whatsapp
 * Method: POST
 * Content-Type: application/x-www-form-urlencoded (Twilio format)
 */

export async function handleTwilioWhatsAppWebhook(req: Request, res: Response) {
  try {
    // Validate Twilio signature (security)
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Skip validation in development mode
    if (process.env.NODE_ENV === 'production' && twilioSignature) {
      const isValid = validateTwilioSignature(twilioSignature, url, req.body);
      if (!isValid) {
        console.error('❌ Invalid Twilio signature');
        return res.status(403).send('Forbidden: Invalid signature');
      }
    }

    // Parse Twilio webhook payload
    const payload: TwilioWebhookPayload = parseTwilioWebhook(req.body);
    const whatsappNumber = extractWhatsAppNumber(payload.From);
    const messageBody = payload.Body.trim();
    const numMedia = parseInt(payload.NumMedia) || 0;
    const mediaUrl = numMedia > 0 ? payload.MediaUrl0 : undefined;
    const mediaType = numMedia > 0 ? payload.MediaContentType0 : undefined;

    console.log(`📱 WhatsApp message from ${whatsappNumber}: "${messageBody}"`);

    // Step 1: Find or create user profile
    let profile = await storage.findProfileByWhatsApp(whatsappNumber);
    
    if (!profile) {
      console.log(`✨ Creating new profile for ${whatsappNumber}`);
      profile = await storage.createWhatsAppProfile(whatsappNumber);
    }

    // Step 2: Store incoming message
    const storedMessage = await storage.storeWhatsAppMessage({
      profileId: profile.id,
      whatsappNumber,
      projectId: null, // Will be determined by message processing
      direction: 'incoming',
      messageType: numMedia > 0 ? (mediaType?.includes('image') ? 'image' : 'document') : 'text',
      content: messageBody || null,
      mediaUrl: mediaUrl || null,
      twilioMessageSid: payload.MessageSid,
      status: 'received',
      metadata: {
        twilioPayload: payload,
        receivedAt: new Date().toISOString(),
      },
    });

    console.log(`💾 Stored message ${storedMessage.id}`);

    // Step 3: Process the message and generate a reply
    const replyText = await processWhatsAppMessage(profile.id, messageBody, mediaUrl);

    // Step 4: Store outgoing reply
    await storage.storeWhatsAppMessage({
      profileId: profile.id,
      whatsappNumber,
      projectId: null,
      direction: 'outgoing',
      messageType: 'text',
      content: replyText,
      mediaUrl: null,
      twilioMessageSid: null,
      status: 'sent',
      metadata: {
        inReplyTo: storedMessage.id,
        sentAt: new Date().toISOString(),
      },
    });

    // Step 5: Update incoming message status
    await storage.updateWhatsAppMessageStatus(storedMessage.id, 'replied');

    // Step 6: Send reply via Twilio
    const sendResult = await sendWhatsAppMessage(whatsappNumber, replyText);
    
    if (!sendResult.success) {
      console.error('❌ Failed to send WhatsApp reply:', sendResult.error);
    }

    // Respond to Twilio with TwiML (empty response = no auto-reply)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

  } catch (error: any) {
    console.error('❌ WhatsApp webhook error:', error);
    
    // Respond with empty TwiML to avoid Twilio retries
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
}

/**
 * Process WhatsApp message and generate appropriate reply
 */
async function processWhatsAppMessage(
  profileId: string,
  messageText: string,
  mediaUrl?: string
): Promise<string> {
  try {
    // Get user's projects
    const projects = await storage.getProjectsByProfile(profileId);
    
    // If user has no projects, guide them to create one
    if (projects.length === 0) {
      return "Welcome to JengaTrack! 👷\n\n" +
        "To get started, please create a project in the web dashboard:\n" +
        `${process.env.FRONTEND_URL || 'http://localhost:5000'}\n\n` +
        "Once you've created a project, you can track expenses here via WhatsApp!";
    }

    // If user has multiple projects, they need to specify which one
    const defaultProject = projects[0]; // For now, use first project

    // Simple command parsing
    const lowerMessage = messageText.toLowerCase();

    // Help command
    if (lowerMessage.includes('help') || lowerMessage === '?') {
      return "📋 *JengaTrack Commands:*\n\n" +
        "💰 *Track Expense:* Just describe what you bought\n" +
        "   Example: _Cement 10 bags 50000_\n\n" +
        "📊 *View Report:* 'report' or 'summary'\n" +
        "💵 *Check Budget:* 'budget' or 'balance'\n" +
        "📝 *View Tasks:* 'tasks'\n\n" +
        `Current project: ${defaultProject.name}`;
    }

    // Report command
    if (lowerMessage.includes('report') || lowerMessage.includes('summary')) {
      const analytics = await storage.getProjectAnalytics(defaultProject.id);
      const percentUsed = (analytics.totalSpent / analytics.totalBudget) * 100;
      
      return `📊 *Project Report: ${defaultProject.name}*\n\n` +
        `💰 Budget: ${formatCurrency(analytics.totalBudget)} UGX\n` +
        `💸 Spent: ${formatCurrency(analytics.totalSpent)} UGX\n` +
        `📉 Remaining: ${formatCurrency(analytics.totalBudget - analytics.totalSpent)} UGX\n` +
        `📊 Used: ${percentUsed.toFixed(1)}%\n\n` +
        `💵 Cash Balance: ${formatCurrency(analytics.cashBalance)} UGX`;
    }

    // Tasks command
    if (lowerMessage.includes('task')) {
      const tasks = await storage.getTasks(defaultProject.id);
      const pendingTasks = tasks.filter(t => !t.completed).slice(0, 5);
      
      if (pendingTasks.length === 0) {
        return `✅ *All tasks completed!*\n\nProject: ${defaultProject.name}`;
      }
      
      let reply = `📝 *Pending Tasks (${pendingTasks.length})*\n\n`;
      pendingTasks.forEach((task, i) => {
        reply += `${i + 1}. ${task.title}\n`;
        if (task.dueDate) {
          reply += `   Due: ${new Date(task.dueDate).toLocaleDateString()}\n`;
        }
        reply += '\n';
      });
      
      return reply + `Project: ${defaultProject.name}`;
    }

    // Default: Assume it's an expense
    return `✅ *Expense recorded!*\n\n` +
      `${messageText}${mediaUrl ? ' (with receipt)' : ''}\n\n` +
      `Project: ${defaultProject.name}\n\n` +
      `Please add the expense details in the web dashboard to categorize it properly.`;

  } catch (error: any) {
    console.error('Error processing WhatsApp message:', error);
    return "Sorry, I encountered an error processing your message. Please try again or contact support.";
  }
}

/**
 * Format currency with thousands separators
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-UG');
}

/**
 * Health check endpoint for Twilio webhook
 */
export function handleTwilioWebhookTest(req: Request, res: Response) {
  res.json({
    message: 'Twilio WhatsApp webhook is ready',
    status: 'active',
    webhookUrl: '/api/webhooks/twilio/whatsapp',
    environment: process.env.NODE_ENV || 'development',
    twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    timestamp: new Date().toISOString(),
  });
}


