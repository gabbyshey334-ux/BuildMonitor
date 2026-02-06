/**
 * AI Update Parser Service
 * 
 * Uses OpenAI to parse natural language project updates from WhatsApp messages.
 * Replaces rule-based intent parsing with AI-powered understanding.
 */

import { aiService } from '../aiService';
import { db } from '../db';
import { projects, expenses, tasks } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

export interface ParsedUpdate {
  type: 'expense' | 'progress' | 'task' | 'issue' | 'photo' | 'unknown';
  category?: 'Materials' | 'Labor' | 'Equipment' | 'Transport' | 'Miscellaneous';
  value?: number;
  date?: string; // YYYY-MM-DD
  notes?: string;
  confidence: number; // 0-100
  requiresClarification?: boolean;
  clarificationQuestion?: string;
}

export interface ProjectContext {
  projectId: string;
  projectName: string;
  budget?: number;
  recentExpenses?: Array<{ description: string; amount: number; date: string }>;
  recentTasks?: Array<{ title: string; status: string }>;
}

/**
 * Get project context for AI prompt
 */
async function getProjectContext(userId: string, projectId?: string): Promise<ProjectContext | null> {
  try {
    // Get user's active project
    let project;
    if (projectId) {
      const [p] = await db.select()
        .from(projects)
        .where(and(
          eq(projects.id, projectId),
          eq(projects.userId, userId),
          isNull(projects.deletedAt)
        ))
        .limit(1);
      project = p;
    } else {
      // Get most recent active project
      const [p] = await db.select()
        .from(projects)
        .where(and(
          eq(projects.userId, userId),
          isNull(projects.deletedAt)
        ))
        .orderBy(desc(projects.updatedAt))
        .limit(1);
      project = p;
    }

    if (!project) {
      return null;
    }

    // Get recent expenses (last 5)
    const recentExpenses = await db.select({
      description: expenses.description,
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
    })
      .from(expenses)
      .where(and(
        eq(expenses.projectId, project.id),
        isNull(expenses.deletedAt)
      ))
      .orderBy(desc(expenses.expenseDate))
      .limit(5);

    // Get recent tasks (last 5)
    const recentTasks = await db.select({
      title: tasks.title,
      status: tasks.status,
    })
      .from(tasks)
      .where(and(
        eq(tasks.projectId, project.id),
        isNull(tasks.deletedAt)
      ))
      .orderBy(desc(tasks.createdAt))
      .limit(5);

    return {
      projectId: project.id,
      projectName: project.name,
      budget: project.budgetAmount ? parseFloat(project.budgetAmount) : undefined,
      recentExpenses: recentExpenses.map(e => ({
        description: e.description,
        amount: parseFloat(e.amount),
        date: e.expenseDate.toISOString().split('T')[0],
      })),
      recentTasks: recentTasks.map(t => ({
        title: t.title,
        status: t.status,
      })),
    };
  } catch (error) {
    console.error('[AI Update Parser] Error getting project context:', error);
    return null;
  }
}

/**
 * Parse user message using AI
 */
export async function parseUpdateWithAI(
  userId: string,
  message: string,
  mediaUrl?: string
): Promise<ParsedUpdate> {
  // Get project context
  const context = await getProjectContext(userId);

  // Build system prompt
  const systemPrompt = `You are JengaTrack, a helpful assistant for Uganda construction projects.

Project context: ${context ? JSON.stringify(context, null, 2) : 'No active project found'}

Your job is to parse user messages and extract structured data about:
- Expenses (materials, labor, equipment, transport, miscellaneous)
- Progress updates (percentage, milestones, completion status)
- Tasks (new tasks, reminders, to-dos)
- Issues (problems, delays, concerns)
- Photos (images with optional captions)

If the message is a valid update, extract JSON in this format:
{
  "type": "expense" | "progress" | "task" | "issue" | "photo" | "unknown",
  "category": "Materials" | "Labor" | "Equipment" | "Transport" | "Miscellaneous" (only for expenses),
  "value": number (amount for expenses, percentage for progress),
  "date": "YYYY-MM-DD" (default to today if not specified),
  "notes": string (description, title, or notes),
  "confidence": 0-100,
  "requiresClarification": boolean,
  "clarificationQuestion": string (if requiresClarification is true)
}

Guidelines:
- If confidence < 70, set requiresClarification: true and provide a Yes/No question
- Extract amounts in UGX (Ugandan Shillings)
- Default date to today if not specified
- For progress, extract percentage (0-100) as value
- For tasks, use "notes" as the task title
- Keep replies short, friendly, in English/Luganda mix if needed
- If message is off-topic or a question, return type: "unknown"

Respond ONLY with valid JSON, no other text.`;

  const userMessage = mediaUrl 
    ? `[Image attached] ${message || 'Photo from construction site'}`
    : message;

  try {
    const response = await aiService.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ], {
      model: 'gpt-4o-mini',
      temperature: 0.3, // Lower temperature for more consistent parsing
      maxTokens: 300,
    });

    if (!response.success || !response.message) {
      console.error('[AI Update Parser] AI service error:', response.error);
      return {
        type: 'unknown',
        confidence: 0,
      };
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(response.message.trim()) as ParsedUpdate;
      
      // Validate parsed data
      if (!parsed.type || !['expense', 'progress', 'task', 'issue', 'photo', 'unknown'].includes(parsed.type)) {
        return {
          type: 'unknown',
          confidence: 0,
        };
      }

      // Set default date to today if not provided
      if (!parsed.date && parsed.type !== 'unknown') {
        parsed.date = new Date().toISOString().split('T')[0];
      }

      return parsed;
    } catch (parseError) {
      console.error('[AI Update Parser] Failed to parse AI response as JSON:', parseError);
      console.error('[AI Update Parser] Raw response:', response.message);
      
      // Fallback: try to extract basic info
      return {
        type: 'unknown',
        confidence: 0,
      };
    }
  } catch (error) {
    console.error('[AI Update Parser] Error calling AI service:', error);
    return {
      type: 'unknown',
      confidence: 0,
    };
  }
}

/**
 * Generate clarification question with Yes/No buttons
 */
export function generateClarificationMessage(parsed: ParsedUpdate): string {
  if (!parsed.clarificationQuestion) {
    return "Could you clarify what you meant?";
  }
  
  return `${parsed.clarificationQuestion}\n\nReply with "Yes" or "No"`;
}


