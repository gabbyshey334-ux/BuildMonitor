/**
 * WhatsApp Webhook Handler
 * 
 * Handles incoming messages from Twilio WhatsApp API
 * Parses user intent and routes to appropriate handlers
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { 
  getUserByWhatsApp, 
  getUserDefaultProject, 
  logWhatsAppMessage,
  createUserProfile
} from '../lib/supabase.js';
import { twilioClient, TWILIO_WHATSAPP_NUMBER, sendWhatsAppMessage, sendInteractiveButtons, parseButtonResponse } from '../twilio.js';
import { parseIntent, isValidIntent, meetsConfidenceThreshold } from '../services/intentParser.js';
import { 
  getOnboardingState, 
  needsOnboarding, 
  sendWelcomeMessage,
  handleProjectTypeSelection,
  handleLocationInput,
  handleStartDateInput,
  handleBudgetInput,
  createProjectFromOnboarding,
  sendPostCreationMessage,
  updateOnboardingState,
} from '../services/onboardingService.js';
import { parseUpdateWithAI, generateClarificationMessage } from '../services/aiUpdateParser.js';
import { aiService } from '../aiService.js';
import { 
  profiles,
  projects, 
  expenses, 
  tasks, 
  images,
  expenseCategories,
  whatsappMessages,
  InsertExpense,
  InsertTask,
  InsertImage,
  InsertWhatsappMessage,
} from '../../shared/schema.js';

const router = Router();

// ============================================================================
// TWILIO WEBHOOK SCHEMA
// ============================================================================

const twilioWebhookSchema = z.object({
  MessageSid: z.string().optional(),
  AccountSid: z.string().optional(),
  From: z.string().min(1, "From field is required"), // "whatsapp:+256770123456"
  To: z.string().optional(), // Our Twilio number
  Body: z.string().optional().default(''),
  NumMedia: z.string().transform(Number).default('0'),
  MediaUrl0: z.string().url().optional(),
  MediaContentType0: z.string().optional(),
  SmsStatus: z.string().optional(),
});

type TwilioWebhook = z.infer<typeof twilioWebhookSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://jengatrack.app';
const MAX_DESCRIPTION_LENGTH = 500;

// ============================================================================
// COMPREHENSIVE LOGGING
// ============================================================================

interface WhatsAppLog {
  timestamp: Date;
  userId?: string;
  phoneNumber: string;
  direction: 'inbound' | 'outbound';
  messageBody?: string;
  intent?: string;
  confidence?: number;
  action?: string;
  success?: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

const whatsappLogs: WhatsAppLog[] = [];

function logWhatsAppInteraction(log: WhatsAppLog): void {
  const logEntry = {
    ...log,
    timestamp: new Date(),
  };
  
  whatsappLogs.push(logEntry);
  
  // Log to console with emoji indicators
  const emoji = log.success === false ? '❌' : log.success === true ? '✅' : '📱';
  const direction = log.direction === 'inbound' ? 'IN' : 'OUT';
  
  console.log(`${emoji} [WhatsApp ${direction}] ${log.phoneNumber} | Intent: ${log.intent || 'N/A'} | ${log.action || 'Message'}`);
  
  if (log.error) {
    console.error(`   Error: ${log.error}`);
  }
  
  if (log.metadata) {
    console.log(`   Metadata:`, JSON.stringify(log.metadata, null, 2));
  }
}

// ============================================================================
// ONBOARDING FLOW HANDLER
// ============================================================================

/**
 * Handle onboarding flow for new users
 * Returns true if onboarding was handled, false if user should proceed to normal flow
 */
async function handleOnboardingFlow(
  userId: string,
  whatsappNumber: string,
  message: string,
  mediaUrl: string | undefined,
  currentState: string | null,
  onboardingData: any,
  requestId: string
): Promise<boolean> {
  console.log(`[Onboarding] ${requestId} - handleOnboardingFlow called:`, {
    userId,
    whatsappNumber,
    messagePreview: message.substring(0, 30),
    currentState,
    hasMedia: !!mediaUrl,
  });
  
  const normalizedMessage = message.trim().toLowerCase();
  
  // If no state, start onboarding immediately (user hasn't started yet)
  if (!currentState) {
    console.log(`[Onboarding] ${requestId} - ✅ No current state, starting onboarding for user ${userId} (first message)`);
    console.log(`[Onboarding] ${requestId} - Sending welcome message to ${whatsappNumber}...`);
    
    try {
      await sendWelcomeMessage(whatsappNumber);
      console.log(`[Onboarding] ${requestId} - ✅ Welcome message sent`);
      
      console.log(`[Onboarding] ${requestId} - Updating onboarding state to 'awaiting_project_type'...`);
      await updateOnboardingState(userId, 'awaiting_project_type');
      console.log(`[Onboarding] ${requestId} - ✅ Onboarding state updated`);
      
      return true;
    } catch (error: any) {
      console.error(`[Onboarding] ${requestId} - ❌ Error starting onboarding:`, error);
      console.error(`[Onboarding] ${requestId} - Error details:`, {
        message: error.message,
        stack: error.stack,
      });
      return false;
    }
  }
  
  console.log(`[Onboarding] ${requestId} - Current state is: ${currentState}, processing state transition...`);
  
  // Handle button responses and state transitions
  if (currentState === 'awaiting_project_type') {
    const buttons = [
      { id: 'btn_residential', title: 'Residential home' },
      { id: 'btn_commercial', title: 'Commercial building' },
      { id: 'btn_other', title: 'Other / Skip for now' },
    ];
    
    const buttonId = parseButtonResponse(message, buttons);
    if (buttonId) {
      await handleProjectTypeSelection(userId, whatsappNumber, buttonId);
      return true;
    }
    
    // If not a button response, treat as project type text
    if (normalizedMessage && !normalizedMessage.includes('skip')) {
      await handleProjectTypeSelection(userId, whatsappNumber, 'btn_other');
      return true;
    }
  }
  
  if (currentState === 'awaiting_location') {
    await handleLocationInput(userId, whatsappNumber, message);
    return true;
  }
  
  if (currentState === 'awaiting_start_date') {
    await handleStartDateInput(userId, whatsappNumber, message);
    return true;
  }
  
  if (currentState === 'awaiting_budget') {
    await handleBudgetInput(userId, whatsappNumber, message);
    return true;
  }
  
  if (currentState === 'confirmation') {
    const buttons = [
      { id: 'btn_confirm', title: 'Yes – Create project! 🎉' },
      { id: 'btn_edit', title: 'Edit something' },
      { id: 'btn_later', title: 'Add more details later' },
    ];
    
    const buttonId = parseButtonResponse(message, buttons);
    
    if (buttonId === 'btn_confirm') {
      // Create project
      const projectId = await createProjectFromOnboarding(userId);
      await sendPostCreationMessage(whatsappNumber, projectId);
      return true;
    } else if (buttonId === 'btn_edit' || buttonId === 'btn_later') {
      // Skip for now, mark as completed anyway
      await updateOnboardingState(userId, 'completed');
      await sendWhatsAppMessage(
        whatsappNumber,
        `No problem! You can add more details later from your dashboard: ${DASHBOARD_URL}/dashboard\n\nFor now, just send me updates anytime (e.g., "Used 50 bags cement" or "Paid workers 2M today").`
      );
      return true;
    }
    
    // If not a button, treat as confirmation
    if (normalizedMessage.includes('yes') || normalizedMessage.includes('confirm') || normalizedMessage === '1') {
      const projectId = await createProjectFromOnboarding(userId);
      await sendPostCreationMessage(whatsappNumber, projectId);
      return true;
    }
  }
  
  // If user is in onboarding but message doesn't match any state, prompt them
  if (currentState && currentState !== 'completed') {
    // Re-send the appropriate prompt based on state
    if (currentState === 'awaiting_project_type') {
      await sendWelcomeMessage(whatsappNumber);
    } else if (currentState === 'awaiting_location') {
      await sendWhatsAppMessage(
        whatsappNumber,
        `Where's the site? (e.g., Kampala Road, Entebbe, or even plot number)\n\nJust type it – or tap Skip`
      );
    } else if (currentState === 'awaiting_start_date') {
      await sendWhatsAppMessage(
        whatsappNumber,
        `Rough start date?\n\n(Type like: Today, 15 Feb 2026, or skip for now)`
      );
    } else if (currentState === 'awaiting_budget') {
      await sendWhatsAppMessage(
        whatsappNumber,
        `Any rough total budget? (UGX – e.g., 150,000,000 or skip)\n\nThis helps us set up your budget tracker right away.`
      );
    }
    return true;
  }
  
  return false; // Not in onboarding, proceed to normal flow
}

// ============================================================================
// WEBHOOK ENDPOINT
// ============================================================================

/**
 * POST /webhook
 * Main Twilio WhatsApp webhook endpoint
 * Note: This router is mounted at /webhook, so this route handles POST /webhook
 */
router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[WhatsApp Webhook] ${requestId} - ========================================`);
  console.log(`[WhatsApp Webhook] ${requestId} - Received request`);
  console.log(`[WhatsApp Webhook] ${requestId} - Method: ${req.method}`);
  console.log(`[WhatsApp Webhook] ${requestId} - URL: ${req.url}`);
  console.log(`[WhatsApp Webhook] ${requestId} - Headers:`, {
    'content-type': req.headers['content-type'],
    'x-twilio-signature': req.headers['x-twilio-signature'] ? 'present' : 'missing',
    'user-agent': req.headers['user-agent'],
  });
  console.log(`[WhatsApp Webhook] ${requestId} - Body keys:`, Object.keys(req.body || {}));
  console.log(`[WhatsApp Webhook] ${requestId} - Body preview:`, {
    From: req.body?.From,
    To: req.body?.To,
    Body: req.body?.Body?.substring(0, 50),
    MessageSid: req.body?.MessageSid,
    NumMedia: req.body?.NumMedia,
  });
  
  try {
    // 1. Validate incoming webhook data
    console.log(`[WhatsApp Webhook] ${requestId} - Validating webhook data...`);
    const data = twilioWebhookSchema.parse(req.body);
    console.log(`[WhatsApp Webhook] ${requestId} - ✅ Validation passed`);
    const phoneNumber = data.From.replace('whatsapp:', '');
    const messageBody = data.Body.trim();
    const mediaUrl = data.NumMedia > 0 ? data.MediaUrl0 : undefined;
    
    logWhatsAppInteraction({
      phoneNumber,
      direction: 'inbound',
      messageBody,
      intent: 'pending',
      action: 'Webhook received',
      metadata: {
        requestId,
        messageSid: data.MessageSid,
        hasMedia: data.NumMedia > 0,
        mediaType: data.MediaContentType0,
      },
    });
    
    // 2. Look up user profile
    console.log(`[Webhook] ${requestId} - Looking up user by WhatsApp: ${phoneNumber}`);
    const profileResponse = await getUserByWhatsApp(phoneNumber);
    
    console.log(`[Webhook] ${requestId} - Profile lookup result:`, {
      hasData: !!profileResponse.data,
      hasError: !!profileResponse.error,
      errorMessage: profileResponse.error?.message,
    });
    
    // Check if user exists
    if (!profileResponse.data) {
      console.log(`[WhatsApp Webhook] ${requestId} - User not found: ${phoneNumber}`);
      
      // Create user profile automatically and start onboarding
      console.log(`[WhatsApp Webhook] ${requestId} - Creating new user profile...`);
      const createResponse = await createUserProfile(phoneNumber);
      
      if (!createResponse.data || createResponse.error) {
        console.error(`[WhatsApp Webhook] ${requestId} - Failed to create user:`, createResponse.error);
        const errorMessage = `Sorry, we encountered an error. Please try again later or contact support at ${DASHBOARD_URL}`;
        await sendWhatsAppMessage(data.From, errorMessage);
        return res.status(200).send('<Response></Response>');
      }
      
      const newProfile = createResponse.data;
      console.log(`[WhatsApp Webhook] ${requestId} - User created: ${newProfile.id}`);
      
      // Start onboarding immediately for new users
      console.log(`[WhatsApp Webhook] ${requestId} - Starting onboarding for new user...`);
      await sendWelcomeMessage(data.From);
      await updateOnboardingState(newProfile.id, 'awaiting_project_type');
      
      // Log the message
      await logWhatsAppMessage({
        userId: newProfile.id,
        whatsappMessageId: data.MessageSid || null,
        direction: 'inbound',
        messageBody: messageBody || null,
        mediaUrl: mediaUrl || null,
        intent: 'onboarding',
        processed: true,
        aiUsed: false,
        errorMessage: null,
        receivedAt: new Date(),
        processedAt: new Date(),
      });
      
      logWhatsAppInteraction({
        phoneNumber,
        userId: newProfile.id,
        direction: 'outbound',
        messageBody: 'Welcome message with project type buttons',
        intent: 'onboarding',
        action: 'Started onboarding',
        success: true,
        metadata: { requestId },
      });
      
      return res.status(200).send('<Response></Response>');
    }
    
    const profile = profileResponse.data;
    console.log(`[Webhook] ${requestId} - User found: ${profile.full_name} (${profile.id})`);
    console.log(`[Webhook] ${requestId} - Profile ID: ${profile.id}`);
    
    // 3. Check if user needs onboarding
    // Get full profile with onboarding fields from database
    console.log(`[Webhook] ${requestId} - Fetching full profile with onboarding fields from database...`);
    const [fullProfile] = await db.select({
      id: profiles.id,
      onboardingState: profiles.onboardingState,
      onboardingData: profiles.onboardingData,
      onboardingCompletedAt: profiles.onboardingCompletedAt,
    })
      .from(profiles)
      .where(eq(profiles.id, profile.id))
      .limit(1);
    
    console.log(`[Webhook] ${requestId} - Full profile query result:`, {
      found: !!fullProfile,
      profileId: fullProfile?.id,
      onboardingState: fullProfile?.onboardingState,
      onboardingCompletedAt: fullProfile?.onboardingCompletedAt,
      hasOnboardingData: !!fullProfile?.onboardingData,
    });
    
    if (!fullProfile) {
      console.error(`[WhatsApp Webhook] ${requestId} - Profile not found in database: ${profile.id}`);
      return res.status(200).send('<Response></Response>');
    }
    
    console.log(`[Webhook] ${requestId} - Checking if user needs onboarding...`);
    const needsOnboardingCheck = await needsOnboarding(profile.id);
    console.log(`[Webhook] ${requestId} - needsOnboarding() result: ${needsOnboardingCheck}`);
    
    const onboardingState = {
      state: fullProfile.onboardingState as string | null,
      data: (fullProfile.onboardingData as any) || {},
      completedAt: fullProfile.onboardingCompletedAt,
    };
    
    console.log(`[Webhook] ${requestId} - Onboarding state details:`, {
      state: onboardingState.state,
      completedAt: onboardingState.completedAt,
      hasCompletedAt: !!onboardingState.completedAt,
      isCompleted: onboardingState.state === 'completed',
    });
    
    // Check if onboarding is needed (no completion timestamp or state is not 'completed')
    const shouldOnboard = !onboardingState.completedAt && 
      (needsOnboardingCheck || onboardingState.state !== 'completed');
    
    console.log(`[Webhook] ${requestId} - Should start onboarding: ${shouldOnboard}`, {
      noCompletedAt: !onboardingState.completedAt,
      needsOnboardingCheck,
      stateNotCompleted: onboardingState.state !== 'completed',
    });
    
    if (shouldOnboard) {
      console.log(`[WhatsApp Webhook] ${requestId} - ✅ User needs onboarding, state: ${onboardingState.state || 'null'}`);
      
      // Handle onboarding flow
      console.log(`[Webhook] ${requestId} - Calling handleOnboardingFlow with:`, {
        userId: profile.id,
        whatsappNumber: data.From,
        message: messageBody.substring(0, 50),
        currentState: onboardingState.state,
        hasOnboardingData: !!onboardingState.data,
      });
      
      const onboardingHandled = await handleOnboardingFlow(
        profile.id,
        data.From,
        messageBody,
        mediaUrl,
        onboardingState.state,
        onboardingState.data,
        requestId
      );
      
      console.log(`[Webhook] ${requestId} - handleOnboardingFlow returned: ${onboardingHandled}`);
      
      if (onboardingHandled) {
        console.log(`[Webhook] ${requestId} - ✅ Onboarding handled successfully, logging message...`);
        // Mark message as processed
        const incomingMessage = await logWhatsAppMessage({
          userId: profile.id,
          whatsappMessageId: data.MessageSid || null,
          direction: 'inbound',
          messageBody: messageBody || null,
          mediaUrl: mediaUrl || null,
          intent: 'onboarding',
          processed: true,
          aiUsed: false,
          errorMessage: null,
          receivedAt: new Date(),
          processedAt: new Date(),
        });
        
        console.log(`[Webhook] ${requestId} - ✅ Onboarding complete, returning TwiML response`);
        return res.status(200).send('<Response></Response>');
      } else {
        console.log(`[Webhook] ${requestId} - ⚠️ Onboarding flow returned false, continuing with normal processing...`);
      }
    } else {
      console.log(`[Webhook] ${requestId} - User does NOT need onboarding:`, {
        hasCompletedAt: !!onboardingState.completedAt,
        completedAt: onboardingState.completedAt,
        state: onboardingState.state,
        needsOnboardingCheck,
      });
    }
    
    // 4. Log incoming message
    const incomingMessage = await logWhatsAppMessage({
      userId: profile.id,
      whatsappMessageId: data.MessageSid || null,
      direction: 'inbound',
      messageBody: messageBody || null,
      mediaUrl: mediaUrl || null,
      intent: 'pending',
      processed: false,
      aiUsed: false,
      errorMessage: null,
      receivedAt: new Date(),
      processedAt: null,
    });
    
    console.log(`[WhatsApp Webhook] ${requestId} - Message logged: ${incomingMessage.id}`);
    
    // 5. Use AI for natural language processing (Phase 2)
    // For now, fallback to rule-based parser if AI is not available
    let parsed;
    let useAI = process.env.USE_AI_PARSING === 'true' && aiService.isConfigured();
    
    if (useAI) {
      console.log(`[WhatsApp Webhook] ${requestId} - Using AI for natural language processing...`);
      const aiParsed = await parseUpdateWithAI(profile.id, messageBody, mediaUrl);
      
      // Convert AI parsed result to intent parser format for compatibility
      parsed = {
        intent: aiParsed.type === 'expense' ? 'log_expense' 
          : aiParsed.type === 'task' ? 'create_task'
          : aiParsed.type === 'unknown' ? 'unknown'
          : 'unknown',
        confidence: aiParsed.confidence / 100, // Convert 0-100 to 0-1
        originalMessage: messageBody,
        amount: aiParsed.value,
        description: aiParsed.notes,
        currency: 'UGX',
      };
      
      // If requires clarification, send clarification message
      if (aiParsed.requiresClarification) {
        const clarificationMsg = generateClarificationMessage(aiParsed);
        await sendInteractiveButtons(data.From, clarificationMsg, [
          { id: 'btn_yes', title: 'Yes' },
          { id: 'btn_no', title: 'No' },
        ]);
        
        await db.update(whatsappMessages)
          .set({ 
            processed: true, 
            processedAt: new Date(),
            aiUsed: true,
          })
          .where(eq(whatsappMessages.id, incomingMessage.id));
        
        return res.status(200).send('<Response></Response>');
      }
    } else {
      // Fallback to rule-based parser
      parsed = parseIntent(messageBody, mediaUrl);
    }
    
    logWhatsAppInteraction({
      phoneNumber,
      userId: profile.id,
      direction: 'inbound',
      messageBody,
      intent: parsed.intent,
      confidence: parsed.confidence,
      action: 'Intent parsed',
      success: true,
      metadata: {
        requestId,
        messageId: incomingMessage.id,
        parsedData: {
          amount: parsed.amount,
          description: parsed.description,
          title: parsed.title,
        },
      },
    });
    
    // Update message with detected intent
    await db.update(whatsappMessages)
      .set({ 
        intent: parsed.intent,
        aiUsed: useAI || false,
      })
      .where(eq(whatsappMessages.id, incomingMessage.id));
    
    // 6. Validate intent and check confidence
    if (!isValidIntent(parsed)) {
      console.log(`[WhatsApp Webhook] ${requestId} - Invalid intent or missing required fields`);
      const reply = await handleUnknown(profile.id, parsed, incomingMessage.id, data.From, requestId);
      
      console.log(`[WhatsApp Webhook] ${requestId} - Sending help message for invalid intent...`);
      const sendResult = await sendWhatsAppMessage(data.From, reply);
      
      if (sendResult.success) {
        console.log(`[WhatsApp Webhook] ${requestId} - ✅ Help message sent: ${sendResult.messageSid}`);
      } else {
        console.error(`[WhatsApp Webhook] ${requestId} - ❌ Failed to send help message:`, sendResult.error);
      }
      
      logWhatsAppInteraction({
        phoneNumber,
        userId: profile.id,
        direction: 'outbound',
        messageBody: reply,
        intent: 'unknown',
        action: 'Sent help message',
        success: sendResult.success,
        error: sendResult.error,
        metadata: { requestId, messageId: incomingMessage.id, messageSid: sendResult.messageSid },
      });
      
      // Mark message as processed
      await db.update(whatsappMessages)
        .set({ 
          processed: true, 
          processedAt: new Date(),
        })
        .where(eq(whatsappMessages.id, incomingMessage.id));
      
      return res.status(200).send('<Response></Response>');
    }
    
    if (!meetsConfidenceThreshold(parsed)) {
      console.log(`[WhatsApp Webhook] ${requestId} - Low confidence (${parsed.confidence}), using unknown handler`);
      const reply = await handleUnknown(profile.id, parsed, incomingMessage.id, data.From, requestId);
      
      console.log(`[WhatsApp Webhook] ${requestId} - Sending help message for low confidence...`);
      const sendResult = await sendWhatsAppMessage(data.From, reply);
      
      if (sendResult.success) {
        console.log(`[WhatsApp Webhook] ${requestId} - ✅ Help message sent: ${sendResult.messageSid}`);
      } else {
        console.error(`[WhatsApp Webhook] ${requestId} - ❌ Failed to send help message:`, sendResult.error);
      }
      
      logWhatsAppInteraction({
        phoneNumber,
        userId: profile.id,
        direction: 'outbound',
        messageBody: reply,
        intent: 'unknown',
        action: 'Sent help message (low confidence)',
        success: sendResult.success,
        error: sendResult.error,
        metadata: { requestId, messageId: incomingMessage.id, confidence: parsed.confidence, messageSid: sendResult.messageSid },
      });
      
      // Mark message as processed
      await db.update(whatsappMessages)
        .set({ 
          processed: true, 
          processedAt: new Date(),
        })
        .where(eq(whatsappMessages.id, incomingMessage.id));
      
      return res.status(200).send('<Response></Response>');
    }
    
    // 7. Route to appropriate intent handler
    let replyMessage: string;
    let handlerSuccess = false;
    let handlerError: string | undefined;
    
    try {
    switch (parsed.intent) {
      case 'log_expense':
          replyMessage = await handleLogExpense(profile.id, parsed, data.From, requestId);
          handlerSuccess = true;
        break;
      
      case 'create_task':
          replyMessage = await handleCreateTask(profile.id, parsed, data.From, requestId);
          handlerSuccess = true;
        break;
      
      case 'set_budget':
          replyMessage = await handleSetBudget(profile.id, parsed, data.From, requestId);
          handlerSuccess = true;
        break;
      
      case 'query_expenses':
          replyMessage = await handleQueryExpenses(profile.id, data.From, requestId);
          handlerSuccess = true;
        break;
      
      case 'log_image':
          replyMessage = await handleLogImage(profile.id, parsed, data.From, requestId);
          handlerSuccess = true;
        break;
      
      case 'unknown':
      default:
          replyMessage = await handleUnknown(profile.id, parsed, incomingMessage.id, data.From, requestId);
          handlerSuccess = true;
        break;
      }
    } catch (error: any) {
      handlerError = error.message || 'Unknown error';
      console.error(`[WhatsApp Webhook] ${requestId} - Handler error:`, error);
      replyMessage = `❌ Sorry, something went wrong processing your request. Please try again or contact support at ${DASHBOARD_URL}`;
    }
    
    logWhatsAppInteraction({
      phoneNumber,
      userId: profile.id,
      direction: 'outbound',
      messageBody: replyMessage,
      intent: parsed.intent,
      action: `Handled ${parsed.intent}`,
      success: handlerSuccess,
      error: handlerError,
      metadata: {
        requestId,
        messageId: incomingMessage.id,
        processingTime: Date.now() - startTime,
      },
    });
    
    // 7. Send reply message via Twilio
    console.log(`[WhatsApp Webhook] ${requestId} - Sending reply message...`);
    let messageSent = false;
    let messageSid: string | null = null;
    
    try {
      const sendResult = await sendWhatsAppMessage(data.From, replyMessage);
      
      if (sendResult.success && sendResult.messageSid) {
        messageSent = true;
        messageSid = sendResult.messageSid;
        console.log(`[WhatsApp Webhook] ${requestId} - ✅ Reply sent successfully: ${messageSid}`);
      } else {
        console.error(`[WhatsApp Webhook] ${requestId} - ❌ Failed to send reply:`, sendResult.error);
        handlerError = sendResult.error || 'Failed to send WhatsApp message';
      }
    } catch (sendError: any) {
      console.error(`[WhatsApp Webhook] ${requestId} - ❌ Exception sending reply:`, {
        error: sendError,
        message: sendError?.message,
        stack: sendError?.stack,
      });
      handlerError = sendError.message || 'Failed to send WhatsApp message';
    }
    
    // 8. Mark message as processed
    await db.update(whatsappMessages)
      .set({ 
        processed: true, 
        processedAt: new Date(),
        errorMessage: handlerError || null,
      })
      .where(eq(whatsappMessages.id, incomingMessage.id));
    
    // 9. Log outbound reply
    await logWhatsAppMessage({
      userId: profile.id,
      whatsappMessageId: messageSid || null,
      direction: 'outbound',
      messageBody: replyMessage,
      mediaUrl: null,
      intent: 'reply',
      processed: messageSent,
      aiUsed: false,
      errorMessage: handlerError || null,
      receivedAt: new Date(),
      processedAt: new Date(),
    });
    
    console.log(`[WhatsApp Webhook] ${requestId} - Request processed successfully in ${Date.now() - startTime}ms`);
    console.log(`[WhatsApp Webhook] ${requestId} - Reply sent: ${messageSent ? '✅ YES' : '❌ NO'}`);
    
    // 10. Return TwiML response (Twilio expects this even if we send via API)
    return res.status(200).send('<Response></Response>');
    
  } catch (error: any) {
    console.error(`[WhatsApp Webhook] Error:`, error);
    
    logWhatsAppInteraction({
      phoneNumber: req.body?.From?.replace('whatsapp:', '') || 'unknown',
      direction: 'inbound',
      action: 'Webhook error',
      success: false,
      error: error.message || 'Unknown error',
      metadata: {
        requestId,
        errorType: error.name,
        stack: error.stack,
      },
    });
    
    if (error.name === 'ZodError') {
      console.error('[WhatsApp Webhook] Validation error:', error.errors);
      return res.status(400).send('<Response></Response>');
    }
    
    return res.status(500).send('<Response></Response>');
  }
});

// ============================================================================
// INTENT HANDLERS
// ============================================================================

/**
 * Handle expense logging with professional response
 */
async function handleLogExpense(
  userId: string, 
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string,
  requestId: string
): Promise<string> {
  try {
    console.log(`[handleLogExpense] ${requestId} - User: ${userId}, Amount: ${parsed.amount}, Description: ${parsed.description}`);
    
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first:\n${DASHBOARD_URL}`;
    }
    
    const categoryId = await findMatchingCategory(userId, parsed.description || '');
    
    const newExpense: InsertExpense = {
      userId,
      projectId: project.id,
      categoryId: categoryId || null,
      description: parsed.description || 'Expense',
      amount: parsed.amount!.toString(),
      currency: parsed.currency || 'UGX',
      source: 'whatsapp',
      expenseDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const [expense] = await db.insert(expenses).values(newExpense).returning();
    
    const formattedAmount = formatAmount(parsed.amount!, parsed.currency || 'UGX');
    const totalSpent = await calculateProjectTotal(project.id);
    const budget = parseFloat(project.budgetAmount);
    const remaining = budget - totalSpent;
    const percentUsed = (totalSpent / budget) * 100;
    
    // Get today's spending
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySpent = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.projectId, project.id),
          sql`${expenses.expenseDate} >= ${todayStart}`,
          isNull(expenses.deletedAt)
        )
      );
    
    const formattedTodaySpent = formatAmount(parseFloat(todaySpent[0].total.toString()), 'UGX');
    const formattedRemaining = formatAmount(remaining, 'UGX');
    
    console.log(`[handleLogExpense] ${requestId} - Expense created: ${expense.id}`);
    
    // Professional response format
    return `✅ *Expense Logged*\n\n` +
           `📝 *${parsed.description}*\n` +
           `💰 *${formattedAmount}*\n` +
           `📊 Project: ${project.name}\n\n` +
           `📈 *Today's Total:* ${formattedTodaySpent}\n` +
           `💵 *Remaining Budget:* ${formattedRemaining}\n` +
           `📊 *Budget Used:* ${percentUsed.toFixed(1)}%`;
    
  } catch (error: any) {
    console.error(`[handleLogExpense] ${requestId} - Error:`, error);
    return `❌ Failed to log expense. Please try again or contact support at ${DASHBOARD_URL}`;
  }
}

/**
 * Handle task creation with professional response
 */
async function handleCreateTask(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string,
  requestId: string
): Promise<string> {
  try {
    console.log(`[handleCreateTask] ${requestId} - User: ${userId}, Title: ${parsed.title}`);
    
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first:\n${DASHBOARD_URL}`;
    }
    
    const newTask: InsertTask = {
      userId,
      projectId: project.id,
      title: parsed.title || 'Task',
      description: parsed.description || null,
      status: 'pending',
      priority: parsed.priority || 'medium',
      dueDate: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const [task] = await db.insert(tasks).values(newTask).returning();
    
    const pendingCount = await db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.projectId, project.id),
          eq(tasks.status, 'pending'),
          isNull(tasks.deletedAt)
        )
      );
    
    console.log(`[handleCreateTask] ${requestId} - Task created: ${task.id}`);
    
    return `✅ *Task Added*\n\n` +
           `📋 *${parsed.title}*\n` +
           `📊 Project: ${project.name}\n` +
           `⚡ Priority: ${parsed.priority || 'medium'}\n` +
           `📝 Status: Pending\n\n` +
           `📌 You have *${pendingCount[0].count}* pending tasks`;
    
  } catch (error: any) {
    console.error(`[handleCreateTask] ${requestId} - Error:`, error);
    return `❌ Failed to create task. Please try again or contact support at ${DASHBOARD_URL}`;
  }
}

/**
 * Handle budget setting with professional response
 */
async function handleSetBudget(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string,
  requestId: string
): Promise<string> {
  try {
    console.log(`[handleSetBudget] ${requestId} - User: ${userId}, Amount: ${parsed.amount}`);
    
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first:\n${DASHBOARD_URL}`;
    }
    
    await db.update(projects)
      .set({ 
        budgetAmount: parsed.amount!.toString(),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id));
    
    const formattedBudget = formatAmount(parsed.amount!, 'UGX');
    const totalSpent = await calculateProjectTotal(project.id);
    const formattedSpent = formatAmount(totalSpent, 'UGX');
    const remaining = parsed.amount! - totalSpent;
    const formattedRemaining = formatAmount(remaining, 'UGX');
    const percentUsed = (totalSpent / parsed.amount!) * 100;
    
    console.log(`[handleSetBudget] ${requestId} - Budget updated for project: ${project.id}`);
    
    return `✅ *Budget Updated*\n\n` +
           `📊 Project: ${project.name}\n` +
           `💰 *New Budget:* ${formattedBudget}\n` +
           `💵 *Already Spent:* ${formattedSpent}\n` +
           `💸 *Remaining:* ${formattedRemaining}\n` +
           `📊 *Used:* ${percentUsed.toFixed(1)}%`;
    
  } catch (error: any) {
    console.error(`[handleSetBudget] ${requestId} - Error:`, error);
    return `❌ Failed to set budget. Please try again or contact support at ${DASHBOARD_URL}`;
  }
}

/**
 * Handle expense queries with professional response
 */
async function handleQueryExpenses(
  userId: string,
  phoneNumber: string,
  requestId: string
): Promise<string> {
  try {
    console.log(`[handleQueryExpenses] ${requestId} - User: ${userId}`);
    
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first:\n${DASHBOARD_URL}`;
    }
    
    const totalSpent = await calculateProjectTotal(project.id);
    const budget = parseFloat(project.budgetAmount);
    const remaining = budget - totalSpent;
    const percentUsed = (totalSpent / budget) * 100;
    
    const expenseCount = await db.select({ count: sql<number>`count(*)` })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.projectId, project.id),
          isNull(expenses.deletedAt)
        )
      );
    
    const topCategories = await db.select({
      categoryName: expenseCategories.name,
      total: sql<number>`SUM(CAST(${expenses.amount} AS DECIMAL))`,
    })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.projectId, project.id),
          isNull(expenses.deletedAt)
        )
      )
      .groupBy(expenseCategories.name)
      .orderBy(desc(sql`SUM(CAST(${expenses.amount} AS DECIMAL))`))
      .limit(3);
    
    console.log(`[handleQueryExpenses] ${requestId} - Total spent: ${totalSpent}`);
    
    let message = `📊 *${project.name} - Expense Report*\n\n`;
    message += `💰 *Budget:* ${formatAmount(budget, 'UGX')}\n`;
    message += `💵 *Spent:* ${formatAmount(totalSpent, 'UGX')} (${percentUsed.toFixed(1)}%)\n`;
    message += `💸 *Remaining:* ${formatAmount(remaining, 'UGX')}\n`;
    message += `📝 *Total Expenses:* ${expenseCount[0].count}\n\n`;
    
    if (topCategories.length > 0) {
      message += `🔝 *Top Categories:*\n`;
      topCategories.forEach((cat, idx) => {
        const catName = cat.categoryName || 'Uncategorized';
        const catAmount = formatAmount(parseFloat(cat.total.toString()), 'UGX');
        message += `${idx + 1}. ${catName}: ${catAmount}\n`;
      });
    }
    
    if (remaining < 0) {
      message += `\n⚠️ *Warning:* You're over budget by ${formatAmount(Math.abs(remaining), 'UGX')}!`;
    } else if (percentUsed >= 80) {
      message += `\n⚠️ *Warning:* You've used ${percentUsed.toFixed(1)}% of your budget.`;
    }
    
    return message;
    
  } catch (error: any) {
    console.error(`[handleQueryExpenses] ${requestId} - Error:`, error);
    return `❌ Failed to retrieve expenses. Please try again or contact support at ${DASHBOARD_URL}`;
  }
}

/**
 * Handle image uploads
 */
async function handleLogImage(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string,
  requestId: string
): Promise<string> {
  try {
    console.log(`[handleLogImage] ${requestId} - User: ${userId}, Caption: ${parsed.caption}`);
    
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first:\n${DASHBOARD_URL}`;
    }
    
    const fileName = parsed.mediaUrl?.split('/').pop() || 'whatsapp-image.jpg';
    
    const newImage: InsertImage = {
      userId,
      projectId: project.id,
      expenseId: null,
      storagePath: parsed.mediaUrl!,
      fileName: fileName,
      fileSizeBytes: null,
      mimeType: 'image/jpeg',
      caption: parsed.caption || null,
      source: 'whatsapp',
      createdAt: new Date(),
    };
    
    const [image] = await db.insert(images).values(newImage).returning();
    
    console.log(`[handleLogImage] ${requestId} - Image created: ${image.id}`);
    
    return `✅ *Image Received*\n\n` +
           `📸 ${parsed.caption || 'No caption provided'}\n` +
           `📊 Project: ${project.name}\n\n` +
           `💡 *Tip:* Send an expense amount to link this image to an expense.\n` +
           `Example: "spent 50000 on cement"`;
    
  } catch (error: any) {
    console.error(`[handleLogImage] ${requestId} - Error:`, error);
    return `❌ Failed to save image. Please try again or contact support at ${DASHBOARD_URL}`;
  }
}

/**
 * Handle unknown intents with helpful response
 */
async function handleUnknown(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  messageId: string,
  phoneNumber: string,
  requestId: string
): Promise<string> {
  try {
    console.log(`[handleUnknown] ${requestId} - User: ${userId}, Original: ${parsed.originalMessage}`);
    
    const helpMessage = 
      `🤖 *I didn't quite understand that.*\n\n` +
      `Here's what I can help with:\n\n` +
      `💰 *Log Expenses:*\n` +
      `"spent 500000 on cement"\n` +
      `"paid 200000 for bricks"\n` +
      `"nimaze 300 ku sand" (Luganda)\n\n` +
      `📋 *Create Tasks:*\n` +
      `"task: inspect foundation"\n` +
      `"todo: buy materials"\n\n` +
      `💵 *Set Budget:*\n` +
      `"set budget 5000000"\n\n` +
      `📊 *Check Expenses:*\n` +
      `"how much did I spend?"\n` +
      `"show expenses"\n` +
      `"ssente zmeka" (Luganda)\n\n` +
      `Need help? Visit ${DASHBOARD_URL}`;
    
    await sendWhatsAppMessage(phoneNumber, helpMessage);
    
    return helpMessage;
    
  } catch (error: any) {
    console.error(`[handleUnknown] ${requestId} - Error:`, error);
    return `❌ Something went wrong. Please try again later.`;
  }
}

/**
 * Log message from unregistered user
 */
async function logUnregisteredUserMessage(
  phoneNumber: string,
  messageBody: string,
  messageSid?: string
): Promise<void> {
  try {
    await logWhatsAppMessage({
      userId: null,
      whatsappMessageId: messageSid || null,
      direction: 'inbound',
      messageBody: messageBody || null,
      mediaUrl: null,
      intent: 'registration_required',
      processed: true,
      aiUsed: false,
      errorMessage: `Unregistered user: ${phoneNumber}`,
      receivedAt: new Date(),
      processedAt: new Date(),
    });
  } catch (error) {
    console.error('[logUnregisteredUserMessage] Error:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find matching expense category based on description keywords
 */
async function findMatchingCategory(userId: string, description: string): Promise<string | null> {
  try {
    const lowerDesc = description.toLowerCase();
    
    const userCategories = await db.select()
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.userId, userId),
          isNull(expenseCategories.deletedAt)
        )
      );
    
    const keywords: Record<string, string[]> = {
      'Materials': ['cement', 'sand', 'bricks', 'steel', 'iron', 'timber', 'wood', 'stone', 'gravel', 'aggregate'],
      'Labor': ['worker', 'labour', 'labor', 'mason', 'carpenter', 'plumber', 'electrician', 'painter', 'wages', 'salary'],
      'Equipment': ['equipment', 'tools', 'machine', 'excavator', 'mixer', 'generator', 'scaffolding'],
      'Transport': ['transport', 'delivery', 'fuel', 'petrol', 'diesel', 'lorry', 'truck', 'vehicle'],
      'Miscellaneous': ['misc', 'other', 'sundry'],
    };
    
    for (const category of userCategories) {
      const categoryKeywords = keywords[category.name] || [];
      
      for (const keyword of categoryKeywords) {
        if (lowerDesc.includes(keyword)) {
          return category.id;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[findMatchingCategory] Error:', error);
    return null;
  }
}

/**
 * Calculate total expenses for a project
 */
async function calculateProjectTotal(projectId: string): Promise<number> {
  try {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
    })
      .from(expenses)
      .where(
        and(
          eq(expenses.projectId, projectId),
          isNull(expenses.deletedAt)
        )
      );
    
    return parseFloat(result[0].total.toString());
  } catch (error) {
    console.error('[calculateProjectTotal] Error:', error);
    return 0;
  }
}

/**
 * Format amount with currency and commas
 */
function formatAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
  return `${currency} ${formatted}`;
}

// ============================================================================
// DEBUG ENDPOINT - Get WhatsApp logs
// ============================================================================

/**
 * GET /webhook/debug
 * Get recent WhatsApp interaction logs
 */
router.get('/webhook/debug', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const recentLogs = whatsappLogs.slice(-limit);
    
    res.json({
      success: true,
      total: whatsappLogs.length,
      logs: recentLogs,
    });
  } catch (error: any) {
    console.error('[WhatsApp Debug] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export default router;
export { whatsappLogs, logWhatsAppInteraction };
