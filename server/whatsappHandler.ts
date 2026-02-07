import { Request, Response } from "express";
import { storage } from "./storage.js";
import { aiService, AIService } from "./aiService.js";
import { z } from "zod";

/**
 * WhatsApp Webhook Handler for n8n Integration
 * 
 * This endpoint receives messages from WhatsApp via n8n and:
 * 1. Identifies or creates users by WhatsApp number
 * 2. Stores messages in the database
 * 3. Links messages to projects when applicable
 * 4. Returns contextual replies for n8n to send back
 * 
 * Expected request body from n8n:
 * {
 *   "whatsappNumber": "+2567xxxxxxx",
 *   "messageType": "text | voice | image | pdf",
 *   "text": "User message or transcribed voice text",
 *   "mediaUrl": "https://example.com/path/to/media",
 *   "fileName": "optional-file-name.pdf",
 *   "projectId": "optional-project-id",
 *   "meta": {
 *     "messageId": "optional",
 *     "timestamp": "optional",
 *     "raw": {}
 *   }
 * }
 * 
 * Example response:
 * {
 *   "success": true,
 *   "replyText": "Thanks! Your update has been recorded.",
 *   "projectId": "project-uuid",
 *   "userId": "user-id",
 *   "messageId": "message-uuid"
 * }
 */

const whatsappMessageSchema = z.object({
  whatsappNumber: z.string().min(1, "WhatsApp number is required"),
  messageType: z.enum(['text', 'voice', 'image', 'pdf', 'document']).default('text'),
  text: z.string().optional(),
  mediaUrl: z.string().url().optional().or(z.literal('')),
  fileName: z.string().optional(),
  projectId: z.string().uuid().optional(),
  meta: z.object({
    messageId: z.string().optional(),
    timestamp: z.string().optional(),
    raw: z.any().optional(),
  }).optional(),
});

export async function handleWhatsAppWebhook(req: Request, res: Response) {
  try {
    // Validate request body
    const payload = whatsappMessageSchema.parse(req.body);
    const { whatsappNumber, messageType, text, mediaUrl, fileName, projectId, meta } = payload;

    console.log(`[WhatsApp Webhook] Received ${messageType} message from ${whatsappNumber}`);

    // Step 1: Find or create user by WhatsApp number (with defensive retry for concurrent requests)
    let user = await storage.findUserByWhatsApp(whatsappNumber);
    
    if (!user) {
      console.log(`[WhatsApp Webhook] Creating new user for ${whatsappNumber}`);
      try {
        user = await storage.createWhatsAppUser(whatsappNumber);
      } catch (error: any) {
        // Handle race condition: another request may have created the user
        if (error.message?.includes('unique') || error.code === '23505') {
          console.log(`[WhatsApp Webhook] User already exists, retrying fetch`);
          user = await storage.findUserByWhatsApp(whatsappNumber);
          if (!user) {
            throw new Error('Failed to create or find WhatsApp user after concurrent creation');
          }
        } else {
          throw error;
        }
      }
    }

    // Step 2: Verify project if provided and check user has access
    let project = null;
    if (projectId) {
      project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          timestamp: new Date().toISOString(),
        });
      }
      
      // Security: Verify user owns this project
      if (project.ownerId !== user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to access this project.',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Step 3: Store the incoming message
    const storedMessage = await storage.storeWhatsAppMessage({
      userId: user.id,
      whatsappNumber,
      projectId: project?.id || null,
      direction: 'incoming',
      messageType,
      text: text || null,
      mediaUrl: mediaUrl || null,
      fileName: fileName || null,
      status: 'received',
      metadata: meta || {},
      replyText: null,
    });

    console.log(`[WhatsApp Webhook] Stored message ${storedMessage.id}`);

    // Step 4: Generate contextual reply
    let replyText: string;

    if (!text || text.trim().length === 0) {
      // No text content (image/file only)
      if (mediaUrl) {
        replyText = `Thank you! I received your ${messageType}${project ? ` for ${project.name}` : ''}.`;
      } else {
        replyText = "I received your message, but I couldn't find any content. Please try again.";
      }
    } else if (!project) {
      // Message received but no project linked
      replyText = "Thank you for your message! To help you better, please specify which project this is about, or I can help you create a new project.";
    } else {
      // Message received and project linked - confirm
      replyText = `Thanks! Your update for ${project.name} has been recorded.`;
    }

    // Step 5: Store the reply as an outgoing message
    await storage.storeWhatsAppMessage({
      userId: user.id,
      whatsappNumber,
      projectId: project?.id || null,
      direction: 'outgoing',
      messageType: 'text',
      text: null,
      mediaUrl: null,
      fileName: null,
      status: 'sent',
      metadata: { inReplyTo: storedMessage.id },
      replyText,
    });

    // Update incoming message status
    await storage.updateMessageStatus(storedMessage.id, 'replied');

    // Step 6: Return success response for n8n
    res.json({
      success: true,
      replyText,
      projectId: project?.id || null,
      projectName: project?.name || null,
      userId: user.id,
      messageId: storedMessage.id,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[WhatsApp Webhook Error]', error);

    // Handle validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process WhatsApp message',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * RAG Query Endpoint
 * 
 * Retrieves relevant context from project data for AI-powered question answering.
 * 
 * Expected request body:
 * {
 *   "projectId": "project-uuid",
 *   "query": "How much did we spend on cement last week?"
 * }
 * 
 * Example response:
 * {
 *   "success": true,
 *   "projectId": "project-uuid",
 *   "query": "How much did we spend on cement last week?",
 *   "context": "Combined text context from relevant docs/logs",
 *   "chunks": [
 *     {
 *       "sourceId": "expense-id",
 *       "excerpt": "Cement purchase: 50 bags for 500,000 UGX",
 *       "metadata": {
 *         "type": "expense",
 *         "category": "Materials",
 *         "amount": 500000,
 *         "date": "2025-01-10"
 *       }
 *     }
 *   ]
 * }
 */

const ragQuerySchema = z.object({
  projectId: z.string().uuid(),
  query: z.string().min(1, "Query is required"),
});

interface ContextChunk {
  sourceId: string;
  excerpt: string;
  metadata: {
    type: string;
    [key: string]: any;
  };
}

export async function handleRAGQuery(req: Request, res: Response) {
  try {
    // Validate request
    const { projectId, query } = ragQuerySchema.parse(req.body);

    console.log(`[RAG Query] Processing query for project ${projectId}: "${query}"`);

    // Verify project exists
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Security: RAG queries are scoped to the project
    // Additional auth can be added by requiring whatsappNumber or userId in request
    // and verifying they own the project

    const chunks: ContextChunk[] = [];
    const queryLower = query.toLowerCase();

    // Enforce limits to prevent memory exhaustion
    const MAX_RESULTS_PER_SOURCE = 10; // Reduced from 20 for safety

    // Determine what type of data to fetch based on query keywords
    const needsExpenses = /spend|spent|cost|expense|paid|payment|budget|money/i.test(query);
    const needsTasks = /task|work|job|progress|complete|doing|done/i.test(query);
    const needsInventory = /inventory|material|cement|sand|brick|stock|deliver/i.test(query);
    const needsSuppliers = /supplier|vendor|shop|hardware/i.test(query);
    const needsDailyLedgers = /today|yesterday|daily|ledger|cash|balance/i.test(query);

    // Fetch relevant data (limit to recent records for performance)
    const limit = 20;

    // 1. Fetch Historical Expenses
    if (needsExpenses) {
      const expenses = await storage.getHistoricalExpenses(projectId);
      expenses.slice(0, MAX_RESULTS_PER_SOURCE).forEach(expense => {
        const excerpt = `${expense.description}: ${parseFloat(expense.amount.toString()).toLocaleString()} UGX (${expense.category})`;
        chunks.push({
          sourceId: expense.id,
          excerpt,
          metadata: {
            type: 'expense',
            category: expense.category,
            amount: parseFloat(expense.amount.toString()),
            date: expense.date.toISOString().split('T')[0],
            paymentMethod: expense.paymentMethod,
          },
        });
      });
    }

    // 2. Fetch Tasks
    if (needsTasks) {
      const tasks = await storage.getTasks(projectId);
      tasks.slice(0, MAX_RESULTS_PER_SOURCE).forEach(task => {
        const status = task.completed ? 'Completed' : 'In Progress';
        const excerpt = `${task.title} - ${status}${task.description ? `: ${task.description}` : ''}`;
        chunks.push({
          sourceId: task.id,
          excerpt,
          metadata: {
            type: 'task',
            title: task.title,
            completed: task.completed,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString().split('T')[0] || null,
          },
        });
      });
    }

    // 3. Fetch Inventory
    if (needsInventory) {
      const inventory = await storage.getInventory(projectId);
      inventory.slice(0, MAX_RESULTS_PER_SOURCE).forEach(item => {
        const excerpt = `${item.item}: ${item.remaining} ${item.unit || 'units'} remaining (${item.used} used, ${item.quantity} total)`;
        chunks.push({
          sourceId: item.id,
          excerpt,
          metadata: {
            type: 'inventory',
            item: item.item,
            quantity: item.quantity,
            remaining: item.remaining,
            used: item.used,
            location: item.location,
          },
        });
      });
    }

    // 4. Fetch Daily Ledgers (if asking about recent spending)
    if (needsDailyLedgers) {
      const ledgers = await storage.getDailyLedgers(projectId);
      ledgers.slice(0, 5).forEach(ledger => {
        const excerpt = `Daily ledger ${ledger.date.toISOString().split('T')[0]}: Opening ${ledger.openingCash} UGX, Closing ${ledger.closingCash} UGX, Cash spent: ${ledger.totalCashSpent} UGX, Supplier spent: ${ledger.totalSupplierSpent} UGX`;
        chunks.push({
          sourceId: ledger.id,
          excerpt,
          metadata: {
            type: 'daily_ledger',
            date: ledger.date.toISOString().split('T')[0],
            openingCash: parseFloat(ledger.openingCash.toString()),
            closingCash: parseFloat(ledger.closingCash.toString()),
            totalSpent: parseFloat(ledger.totalCashSpent.toString()) + parseFloat(ledger.totalSupplierSpent.toString()),
          },
        });
      });
    }

    // 5. Fetch Suppliers (Security: These are global - filter by project if needed)
    if (needsSuppliers) {
      const suppliers = await storage.getSuppliers();
      // Note: Suppliers are not project-scoped in current schema
      // Consider filtering or adding project-supplier relationships for multi-tenant security
      suppliers.slice(0, MAX_RESULTS_PER_SOURCE).forEach(supplier => {
        const excerpt = `${supplier.name}: Balance ${parseFloat(supplier.currentBalance.toString()).toLocaleString()} UGX (Deposited: ${supplier.totalDeposited}, Spent: ${supplier.totalSpent})`;
        chunks.push({
          sourceId: supplier.id,
          excerpt,
          metadata: {
            type: 'supplier',
            name: supplier.name,
            balance: parseFloat(supplier.currentBalance.toString()),
            totalDeposited: parseFloat(supplier.totalDeposited.toString()),
            totalSpent: parseFloat(supplier.totalSpent.toString()),
          },
        });
      });
    }

    // If no specific keywords, fetch a bit of everything
    if (!needsExpenses && !needsTasks && !needsInventory && !needsSuppliers && !needsDailyLedgers) {
      const analytics = await storage.getProjectAnalytics(projectId);
      chunks.push({
        sourceId: projectId,
        excerpt: `Project ${project.name}: Budget ${analytics.totalBudget.toLocaleString()} UGX, Spent ${analytics.totalSpent.toLocaleString()} UGX`,
        metadata: {
          type: 'project_summary',
          totalBudget: analytics.totalBudget,
          totalSpent: analytics.totalSpent,
          cashBalance: analytics.cashBalance,
        },
      });
    }

    // Assemble context string
    const context = chunks.length > 0
      ? `Project: ${project.name}\n\n` + chunks.map(c => `- ${c.excerpt}`).join('\n')
      : `Project: ${project.name}\n\nNo relevant data found for this query.`;

    console.log(`[RAG Query] Retrieved ${chunks.length} context chunks`);

    res.json({
      success: true,
      projectId,
      query,
      context,
      chunks,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[RAG Query Error]', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process RAG query',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * AI Question-Answering Endpoint
 * 
 * Generates intelligent responses to user questions using OpenAI and RAG context.
 * 
 * Expected request body:
 * {
 *   "whatsappNumber": "+2567xxxxxxx",  // or userId
 *   "message": "How much cement do we have left?",
 *   "projectId": "optional-project-uuid"
 * }
 * 
 * Example response:
 * {
 *   "success": true,
 *   "answer": "Based on the inventory, you have 45 bags of cement remaining at the on-site location.",
 *   "projectId": "project-uuid",
 *   "aiUsage": {
 *     "model": "gpt-4",
 *     "totalTokens": 250
 *   }
 * }
 */

const aiAnswerSchema = z.object({
  whatsappNumber: z.string().optional(),
  userId: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  projectId: z.string().uuid().optional(),
}).refine(data => data.whatsappNumber || data.userId, {
  message: "Either whatsappNumber or userId must be provided",
});

export async function handleAIAnswer(req: Request, res: Response) {
  try {
    // Validate request
    const { whatsappNumber, userId, message, projectId } = aiAnswerSchema.parse(req.body);

    console.log(`[AI Answer] Processing question: "${message}"`);

    // Step 1: Find user (security: only allow known users, don't auto-create for AI queries)
    let user;
    if (whatsappNumber) {
      user = await storage.findUserByWhatsApp(whatsappNumber);
      if (!user) {
        return res.status(403).json({
          success: false,
          error: 'WhatsApp number not recognized. Please send a message first to register.',
          timestamp: new Date().toISOString(),
        });
      }
    } else if (userId) {
      user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Step 1b: Verify project access if projectId is provided
    if (projectId) {
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          timestamp: new Date().toISOString(),
        });
      }
      // Security: Verify user owns this project
      if (project.ownerId !== user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not have permission to access this project.',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Step 2: Fetch conversation history
    const messageHistory = whatsappNumber
      ? await storage.getMessageHistory(whatsappNumber, 10)
      : await storage.getUserMessages(user!.id, 10);

    // Step 3: Get RAG context if project is specified
    let context = '';
    if (projectId) {
      try {
        // Fetch RAG context
        const ragQuerySchema = z.object({
          projectId: z.string().uuid(),
          query: z.string(),
        });

        const ragPayload = { projectId, query: message };
        const ragResponse = await handleRAGQueryInternal(ragPayload);
        
        if (ragResponse.success && ragResponse.context) {
          context = ragResponse.context;
        }
      } catch (error) {
        console.warn('[AI Answer] Failed to fetch RAG context:', error);
        // Continue without context
      }
    }

    // Step 4: Format conversation history for AI
    const conversationHistory = AIService.formatConversationHistory(messageHistory);

    // Step 5: Generate AI response
    const aiResponse = await aiService.generateProjectAssistantResponse(
      message,
      context,
      conversationHistory
    );

    if (!aiResponse.success) {
      return res.status(500).json({
        success: false,
        error: aiResponse.error || 'Failed to generate AI response',
        timestamp: new Date().toISOString(),
      });
    }

    // Step 6: Store the interaction
    if (whatsappNumber && user) {
      await storage.storeWhatsAppMessage({
        userId: user.id,
        whatsappNumber,
        projectId: projectId || null,
        direction: 'incoming',
        messageType: 'text',
        text: message,
        mediaUrl: null,
        fileName: null,
        status: 'processed',
        metadata: {},
        replyText: null,
      });

      await storage.storeWhatsAppMessage({
        userId: user.id,
        whatsappNumber,
        projectId: projectId || null,
        direction: 'outgoing',
        messageType: 'text',
        text: null,
        mediaUrl: null,
        fileName: null,
        status: 'sent',
        metadata: { aiGenerated: true },
        replyText: aiResponse.message,
      });
    }

    console.log(`[AI Answer] Generated response using ${aiResponse.model}`);

    // Step 7: Return response
    res.json({
      success: true,
      answer: aiResponse.message,
      projectId: projectId || null,
      userId: user?.id || null,
      aiUsage: {
        model: aiResponse.model,
        totalTokens: aiResponse.usage?.totalTokens || 0,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[AI Answer Error]', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process AI answer request',
      timestamp: new Date().toISOString(),
    });
  }
}

// Internal helper for RAG query (used by AI answer)
async function handleRAGQueryInternal(payload: { projectId: string; query: string }) {
  const { projectId, query } = payload;

  const project = await storage.getProject(projectId);
  if (!project) {
    return { success: false, context: null };
  }

  const chunks: ContextChunk[] = [];

  // Fetch relevant data based on query
  const expenses = await storage.getHistoricalExpenses(projectId);
  expenses.slice(0, 10).forEach(expense => {
    chunks.push({
      sourceId: expense.id,
      excerpt: `${expense.description}: ${parseFloat(expense.amount.toString()).toLocaleString()} UGX`,
      metadata: { type: 'expense', category: expense.category, amount: parseFloat(expense.amount.toString()) },
    });
  });

  const context = `Project: ${project.name}\n\n` + chunks.map(c => `- ${c.excerpt}`).join('\n');

  return { success: true, context, chunks };
}
