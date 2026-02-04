/**
 * WhatsApp Webhook Handler
 * 
 * Handles incoming messages from Twilio WhatsApp API
 * Parses user intent and routes to appropriate handlers
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { 
  getUserByWhatsApp, 
  getUserDefaultProject, 
  logWhatsAppMessage 
} from '../lib/supabase';
import { twilioClient, TWILIO_WHATSAPP_NUMBER, sendWhatsAppMessage } from '../twilio';
import { parseIntent, isValidIntent, meetsConfidenceThreshold } from '../services/intentParser';
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
} from '@shared/schema';

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
// WEBHOOK ENDPOINT
// ============================================================================

/**
 * POST /webhook
 * Main Twilio WhatsApp webhook endpoint
 */
router.post('/webhook', async (req: Request, res: Response) => {
  console.log('[WhatsApp Webhook] Received request');
  
  try {
    // 1. Validate incoming webhook data
    const data = twilioWebhookSchema.parse(req.body);
    console.log(`[WhatsApp Webhook] Message from ${data.From}`);
    
    // 2. Extract WhatsApp phone number (remove "whatsapp:" prefix)
    const phoneNumber = data.From.replace('whatsapp:', '');
    const messageBody = data.Body.trim();
    const mediaUrl = data.NumMedia > 0 ? data.MediaUrl0 : undefined;
    
    // 3. Look up user profile
    const profile = await getUserByWhatsApp(phoneNumber);
    
    if (!profile) {
      console.log(`[WhatsApp Webhook] User not found: ${phoneNumber}`);
      
      // Send registration prompt
      await sendWhatsAppMessage(
        data.From,
        `👋 Welcome to JengaTrack!\n\nPlease register at ${DASHBOARD_URL} to get started.\n\nOnce registered, you can track expenses, manage tasks, and monitor your construction projects via WhatsApp.`
      );
      
      // Log the interaction
      await logUnregisteredUserMessage(phoneNumber, messageBody, data.MessageSid);
      
      return res.status(200).send('<Response></Response>');
    }
    
    console.log(`[WhatsApp Webhook] User found: ${profile.fullName} (${profile.id})`);
    
    // 4. Log incoming message
    const incomingMessage = await logWhatsAppMessage({
      userId: profile.id,
      whatsappMessageId: data.MessageSid || null,
      direction: 'inbound',
      messageBody: messageBody || null,
      mediaUrl: mediaUrl || null,
      intent: 'pending', // Will be updated after parsing
      processed: false,
      aiUsed: false,
      errorMessage: null,
      receivedAt: new Date(),
      processedAt: null,
    });
    
    console.log(`[WhatsApp Webhook] Message logged: ${incomingMessage.id}`);
    
    // 5. Parse user intent
    const parsed = parseIntent(messageBody, mediaUrl);
    console.log(`[WhatsApp Webhook] Intent detected: ${parsed.intent} (confidence: ${parsed.confidence})`);
    
    // Update message with detected intent
    await db.update(whatsappMessages)
      .set({ intent: parsed.intent })
      .where(eq(whatsappMessages.id, incomingMessage.id));
    
    // 6. Validate intent and check confidence
    if (!isValidIntent(parsed)) {
      console.log('[WhatsApp Webhook] Invalid intent or missing required fields');
      await handleUnknown(profile.id, parsed, incomingMessage.id, data.From);
      return res.status(200).send('<Response></Response>');
    }
    
    if (!meetsConfidenceThreshold(parsed)) {
      console.log(`[WhatsApp Webhook] Low confidence (${parsed.confidence}), using unknown handler`);
      await handleUnknown(profile.id, parsed, incomingMessage.id, data.From);
      return res.status(200).send('<Response></Response>');
    }
    
    // 7. Route to appropriate intent handler
    let replyMessage: string;
    
    switch (parsed.intent) {
      case 'log_expense':
        replyMessage = await handleLogExpense(profile.id, parsed, data.From);
        break;
      
      case 'create_task':
        replyMessage = await handleCreateTask(profile.id, parsed, data.From);
        break;
      
      case 'set_budget':
        replyMessage = await handleSetBudget(profile.id, parsed, data.From);
        break;
      
      case 'query_expenses':
        replyMessage = await handleQueryExpenses(profile.id, data.From);
        break;
      
      case 'log_image':
        replyMessage = await handleLogImage(profile.id, parsed, data.From);
        break;
      
      case 'unknown':
      default:
        replyMessage = await handleUnknown(profile.id, parsed, incomingMessage.id, data.From);
        break;
    }
    
    // 8. Mark message as processed
    await db.update(whatsappMessages)
      .set({ 
        processed: true, 
        processedAt: new Date() 
      })
      .where(eq(whatsappMessages.id, incomingMessage.id));
    
    // 9. Log outbound reply
    await logWhatsAppMessage({
      userId: profile.id,
      whatsappMessageId: null, // Twilio generates new SID for outbound
      direction: 'outbound',
      messageBody: replyMessage,
      mediaUrl: null,
      intent: 'reply',
      processed: true,
      aiUsed: false,
      errorMessage: null,
      receivedAt: new Date(),
      processedAt: new Date(),
    });
    
    console.log('[WhatsApp Webhook] Request processed successfully');
    
    // 10. Return TwiML response
    return res.status(200).send('<Response></Response>');
    
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error:', error);
    
    // Log error but don't expose internal details to Twilio
    if (error.name === 'ZodError') {
      console.error('[WhatsApp Webhook] Validation error:', error.errors);
      return res.status(400).send('<Response></Response>');
    }
    
    // Send generic error response
    return res.status(500).send('<Response></Response>');
  }
});

// ============================================================================
// INTENT HANDLERS
// ============================================================================

/**
 * Handle expense logging
 * Inserts expense record into database
 */
async function handleLogExpense(
  userId: string, 
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string
): Promise<string> {
  try {
    console.log(`[handleLogExpense] User: ${userId}, Amount: ${parsed.amount}, Description: ${parsed.description}`);
    
    // Get user's default project
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first: ${DASHBOARD_URL}`;
    }
    
    // Try to auto-categorize based on description
    const categoryId = await findMatchingCategory(userId, parsed.description || '');
    
    // Insert expense
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
    
    // Format amount with commas
    const formattedAmount = formatAmount(parsed.amount!, parsed.currency || 'UGX');
    
    // Calculate new project total
    const totalSpent = await calculateProjectTotal(project.id);
    const remaining = parseFloat(project.budgetAmount) - totalSpent;
    const formattedRemaining = formatAmount(remaining, 'UGX');
    
    console.log(`[handleLogExpense] Expense created: ${expense.id}`);
    
    return `✅ Expense recorded!\n\n` +
           `📝 ${parsed.description}\n` +
           `💰 ${formattedAmount}\n` +
           `📊 Project: ${project.name}\n\n` +
           `💵 Remaining budget: ${formattedRemaining}`;
    
  } catch (error: any) {
    console.error('[handleLogExpense] Error:', error);
    return `❌ Failed to log expense. Please try again or contact support.`;
  }
}

/**
 * Handle task creation
 * Inserts task record into database
 */
async function handleCreateTask(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string
): Promise<string> {
  try {
    console.log(`[handleCreateTask] User: ${userId}, Title: ${parsed.title}`);
    
    // Get user's default project
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first: ${DASHBOARD_URL}`;
    }
    
    // Insert task
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
    
    console.log(`[handleCreateTask] Task created: ${task.id}`);
    
    // Get pending task count
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
    
    return `✅ Task created!\n\n` +
           `📋 ${parsed.title}\n` +
           `📊 Project: ${project.name}\n` +
           `⚡ Priority: ${parsed.priority || 'medium'}\n\n` +
           `📝 You have ${pendingCount[0].count} pending tasks.`;
    
  } catch (error: any) {
    console.error('[handleCreateTask] Error:', error);
    return `❌ Failed to create task. Please try again or contact support.`;
  }
}

/**
 * Handle budget setting
 * Updates project budget_amount
 */
async function handleSetBudget(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string
): Promise<string> {
  try {
    console.log(`[handleSetBudget] User: ${userId}, Amount: ${parsed.amount}`);
    
    // Get user's default project
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first: ${DASHBOARD_URL}`;
    }
    
    // Update project budget
    await db.update(projects)
      .set({ 
        budgetAmount: parsed.amount!.toString(),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id));
    
    const formattedBudget = formatAmount(parsed.amount!, 'UGX');
    
    // Calculate current spending
    const totalSpent = await calculateProjectTotal(project.id);
    const formattedSpent = formatAmount(totalSpent, 'UGX');
    const remaining = parsed.amount! - totalSpent;
    const formattedRemaining = formatAmount(remaining, 'UGX');
    
    console.log(`[handleSetBudget] Budget updated for project: ${project.id}`);
    
    return `✅ Budget updated!\n\n` +
           `📊 Project: ${project.name}\n` +
           `💰 New budget: ${formattedBudget}\n` +
           `💵 Already spent: ${formattedSpent}\n` +
           `💸 Remaining: ${formattedRemaining}`;
    
  } catch (error: any) {
    console.error('[handleSetBudget] Error:', error);
    return `❌ Failed to set budget. Please try again or contact support.`;
  }
}

/**
 * Handle expense queries
 * Returns summary of expenses
 */
async function handleQueryExpenses(
  userId: string,
  phoneNumber: string
): Promise<string> {
  try {
    console.log(`[handleQueryExpenses] User: ${userId}`);
    
    // Get user's default project
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first: ${DASHBOARD_URL}`;
    }
    
    // Calculate totals
    const totalSpent = await calculateProjectTotal(project.id);
    const budget = parseFloat(project.budgetAmount);
    const remaining = budget - totalSpent;
    const percentUsed = (totalSpent / budget) * 100;
    
    // Get expense count
    const expenseCount = await db.select({ count: sql<number>`count(*)` })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          eq(expenses.projectId, project.id),
          isNull(expenses.deletedAt)
        )
      );
    
    // Get top categories
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
    
    console.log(`[handleQueryExpenses] Total spent: ${totalSpent}`);
    
    // Build response message
    let message = `📊 *${project.name}* Expense Report\n\n`;
    message += `💰 Budget: ${formatAmount(budget, 'UGX')}\n`;
    message += `💵 Spent: ${formatAmount(totalSpent, 'UGX')} (${percentUsed.toFixed(1)}%)\n`;
    message += `💸 Remaining: ${formatAmount(remaining, 'UGX')}\n`;
    message += `📝 Total expenses: ${expenseCount[0].count}\n\n`;
    
    if (topCategories.length > 0) {
      message += `🔝 Top Categories:\n`;
      topCategories.forEach((cat, idx) => {
        const catName = cat.categoryName || 'Uncategorized';
        const catAmount = formatAmount(parseFloat(cat.total.toString()), 'UGX');
        message += `${idx + 1}. ${catName}: ${catAmount}\n`;
      });
    }
    
    // Add warning if over budget
    if (remaining < 0) {
      message += `\n⚠️ *Warning:* You're over budget by ${formatAmount(Math.abs(remaining), 'UGX')}!`;
    }
    
    return message;
    
  } catch (error: any) {
    console.error('[handleQueryExpenses] Error:', error);
    return `❌ Failed to retrieve expenses. Please try again or contact support.`;
  }
}

/**
 * Handle image uploads
 * Stores image metadata
 */
async function handleLogImage(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  phoneNumber: string
): Promise<string> {
  try {
    console.log(`[handleLogImage] User: ${userId}, Caption: ${parsed.caption}`);
    
    // Get user's default project
    const project = await getUserDefaultProject(userId);
    
    if (!project) {
      return `❌ No active project found.\n\nPlease create a project in the dashboard first: ${DASHBOARD_URL}`;
    }
    
    // Extract filename from URL
    const fileName = parsed.mediaUrl?.split('/').pop() || 'whatsapp-image.jpg';
    
    // Insert image record
    const newImage: InsertImage = {
      userId,
      projectId: project.id,
      expenseId: null, // Can be linked later
      storagePath: parsed.mediaUrl!,
      fileName: fileName,
      fileSizeBytes: null, // Unknown from Twilio
      mimeType: 'image/jpeg', // Assume JPEG
      caption: parsed.caption || null,
      source: 'whatsapp',
      createdAt: new Date(),
    };
    
    const [image] = await db.insert(images).values(newImage).returning();
    
    console.log(`[handleLogImage] Image created: ${image.id}`);
    
    return `✅ Image received!\n\n` +
           `📸 ${parsed.caption || 'No caption'}\n` +
           `📊 Project: ${project.name}\n\n` +
           `💡 Tip: Send expense amount to link this image to an expense.`;
    
  } catch (error: any) {
    console.error('[handleLogImage] Error:', error);
    return `❌ Failed to save image. Please try again or contact support.`;
  }
}

/**
 * Handle unknown intents
 * Fallback when intent cannot be determined or confidence is low
 */
async function handleUnknown(
  userId: string,
  parsed: ReturnType<typeof parseIntent>,
  messageId: string,
  phoneNumber: string
): Promise<string> {
  try {
    console.log(`[handleUnknown] User: ${userId}, Original: ${parsed.originalMessage}`);
    
    // TODO: Integrate OpenAI for AI-powered fallback
    // For now, send helpful instructions
    
    const helpMessage = 
      `🤖 I didn't quite understand that.\n\n` +
      `Here's what I can help with:\n\n` +
      `💰 *Log Expenses:*\n` +
      `"spent 500 on cement"\n` +
      `"paid 200 for bricks"\n\n` +
      `📋 *Create Tasks:*\n` +
      `"task: inspect foundation"\n` +
      `"todo: buy materials"\n\n` +
      `💵 *Set Budget:*\n` +
      `"set budget 1000000"\n\n` +
      `📊 *Check Expenses:*\n` +
      `"how much did I spend?"\n` +
      `"show expenses"\n\n` +
      `Need help? Visit ${DASHBOARD_URL}`;
    
    await sendWhatsAppMessage(phoneNumber, helpMessage);
    
    return helpMessage;
    
  } catch (error: any) {
    console.error('[handleUnknown] Error:', error);
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
      userId: null, // No user yet
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
    
    // Get all user categories
    const userCategories = await db.select()
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.userId, userId),
          isNull(expenseCategories.deletedAt)
        )
      );
    
    // Simple keyword matching
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
// EXPORTS
// ============================================================================

export default router;

