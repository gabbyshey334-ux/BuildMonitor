import fetch from 'node-fetch';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIServiceOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  timestamp: string;
}

/**
 * AI Service for OpenAI Integration
 * Handles all AI-related operations with proper error handling and retry logic
 */
export class AIService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || OPENAI_API_KEY;
    
    if (!this.apiKey) {
      console.warn('[AI Service] Warning: OPENAI_API_KEY not configured. AI features will not work.');
    }
  }

  /**
   * Check if AI service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Generate a chat completion with OpenAI
   * @param messages - Array of conversation messages
   * @param options - Optional configuration (model, temperature, etc.)
   * @returns AI response with generated message
   */
  async generateChatCompletion(
    messages: AIMessage[],
    options: AIServiceOptions = {}
  ): Promise<AIResponse> {
    if (!this.isConfigured()) {
      console.error('[AI Service] OpenAI API key not configured');
      return {
        success: false,
        error: 'AI service not configured. Please set OPENAI_API_KEY environment variable.',
        timestamp: new Date().toISOString(),
      };
    }

    const model = options.model || DEFAULT_MODEL;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 500;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();
        
        const response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        const responseData: any = await response.json();
        const duration = Date.now() - startTime;

        if (!response.ok) {
          const errorMessage = responseData.error?.message || 'Unknown OpenAI API error';
          
          // Handle rate limiting
          if (response.status === 429) {
            console.warn(`[AI Service] Rate limited (attempt ${attempt}/${MAX_RETRIES}). Retrying...`);
            
            if (attempt < MAX_RETRIES) {
              await this.delay(RETRY_DELAY * attempt);
              continue;
            }
          }

          // Handle other errors
          console.error(`[AI Service] OpenAI API error (${response.status}):`, errorMessage);
          return {
            success: false,
            error: `OpenAI API error: ${errorMessage}`,
            timestamp: new Date().toISOString(),
          };
        }

        const generatedMessage = responseData.choices?.[0]?.message?.content;

        if (!generatedMessage) {
          console.error('[AI Service] No message in OpenAI response:', responseData);
          return {
            success: false,
            error: 'No response generated from OpenAI',
            timestamp: new Date().toISOString(),
          };
        }

        console.log(`[AI Service] Successfully generated response (${duration}ms, ${responseData.usage?.total_tokens || 0} tokens)`);

        return {
          success: true,
          message: generatedMessage,
          usage: {
            promptTokens: responseData.usage?.prompt_tokens || 0,
            completionTokens: responseData.usage?.completion_tokens || 0,
            totalTokens: responseData.usage?.total_tokens || 0,
          },
          model,
          timestamp: new Date().toISOString(),
        };

      } catch (error: any) {
        lastError = error;
        console.error(`[AI Service] Request failed (attempt ${attempt}/${MAX_RETRIES}):`, error.message);

        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY * attempt);
          continue;
        }
      }
    }

    return {
      success: false,
      error: `Failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate a response for a construction project assistant
   * @param userMessage - The user's question or statement
   * @param context - Optional project context for RAG
   * @param conversationHistory - Previous messages for continuity
   * @returns AI response tailored for construction management
   */
  async generateProjectAssistantResponse(
    userMessage: string,
    context?: string,
    conversationHistory: AIMessage[] = []
  ): Promise<AIResponse> {
    const systemPrompt = `You are a helpful construction project management assistant for a Ugandan construction company. You help site managers and project owners by:

1. Answering questions about project expenses, budgets, and spending
2. Providing information about inventory, materials, and suppliers
3. Helping track tasks, milestones, and project progress
4. Explaining financial data in simple, everyday language
5. Offering practical construction management advice

${context ? `Here is relevant project information to help answer the user's question:\n\n${context}\n\n` : ''}

Guidelines:
- Be concise and helpful
- Use everyday language (avoid technical jargon)
- If you don't have enough information, ask clarifying questions
- When discussing money, use UGX (Ugandan Shillings) format
- Be culturally aware (you're assisting in Uganda)
- If the user asks about something not in the provided context, let them know you need more information`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-5), // Include last 5 messages for context
      { role: 'user', content: userMessage },
    ];

    return await this.generateChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 400,
    });
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format conversation history for AI context
   */
  static formatConversationHistory(messages: Array<{ direction: string; text: string | null; replyText: string | null }>): AIMessage[] {
    const formattedMessages: AIMessage[] = [];
    
    for (const msg of messages) {
      if (msg.direction === 'incoming' && msg.text) {
        formattedMessages.push({ role: 'user', content: msg.text });
      } else if (msg.direction === 'outgoing' && msg.replyText) {
        formattedMessages.push({ role: 'assistant', content: msg.replyText });
      }
    }
    
    return formattedMessages.reverse(); // Oldest first
  }
}

// Export singleton instance
export const aiService = new AIService();
