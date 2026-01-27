/**
 * WhatsApp Intent Parser
 * 
 * Rule-based natural language parser for detecting user intent from WhatsApp messages.
 * Supports English and Luganda languages.
 * 
 * Intents supported:
 * - log_expense: Extract expense amount and description
 * - create_task: Extract task title and description
 * - set_budget: Extract budget amount
 * - query_expenses: User asking about expenses
 * - log_image: Image with optional caption
 * - unknown: Cannot determine intent
 */

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export interface ParsedIntent {
  intent: 'log_expense' | 'create_task' | 'set_budget' | 'query_expenses' | 'log_image' | 'unknown';
  confidence: number; // 0-1 score
  originalMessage: string;
  
  // Expense-specific fields
  amount?: number;
  description?: string;
  currency?: string;
  
  // Task-specific fields
  title?: string;
  priority?: 'low' | 'medium' | 'high';
  
  // Image-specific fields
  caption?: string;
  mediaUrl?: string;
}

interface PatternMatch {
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => Partial<ParsedIntent>;
}

// ============================================================================
// EXPENSE PATTERNS (English & Luganda)
// ============================================================================

const EXPENSE_PATTERNS: PatternMatch[] = [
  // English patterns
  {
    // "spent 500 on cement", "paid 200 for bricks"
    pattern: /(?:spent|paid|used)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:on|for)\s+(.+)/i,
    extractor: (match) => ({
      intent: 'log_expense',
      amount: parseAmount(match[1]),
      description: cleanDescription(match[2]),
      confidence: 0.95,
    }),
  },
  {
    // "bought sand 150", "purchased cement 500"
    pattern: /(?:bought|purchased)\s+(.+?)\s+(?:for\s+)?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    extractor: (match) => ({
      intent: 'log_expense',
      amount: parseAmount(match[2]),
      description: cleanDescription(match[1]),
      confidence: 0.95,
    }),
  },
  {
    // "500 for cement", "200 bricks"
    pattern: /^(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:for\s+)?(.+)/i,
    extractor: (match) => ({
      intent: 'log_expense',
      amount: parseAmount(match[1]),
      description: cleanDescription(match[2]),
      confidence: 0.85,
    }),
  },
  {
    // "cement 500 bags", "sand 200"
    pattern: /^([a-z\s]+?)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    extractor: (match) => ({
      intent: 'log_expense',
      amount: parseAmount(match[2]),
      description: cleanDescription(match[1]),
      confidence: 0.80,
    }),
  },
  
  // Luganda patterns
  {
    // "nimaze 300 ku sand" (I spent 300 on sand)
    pattern: /(?:nimaze|nasasudde)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:ku|pa)\s+(.+)/i,
    extractor: (match) => ({
      intent: 'log_expense',
      amount: parseAmount(match[1]),
      description: cleanDescription(match[2]),
      confidence: 0.95,
    }),
  },
  {
    // "naguze cement 500" (I bought cement 500)
    pattern: /(?:naguze|natundidde)\s+(.+?)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    extractor: (match) => ({
      intent: 'log_expense',
      amount: parseAmount(match[2]),
      description: cleanDescription(match[1]),
      confidence: 0.95,
    }),
  },
  {
    // "omaze 500" (you spent 500) - common in Luganda
    pattern: /(?:omaze|wasasudde)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:ku\s+)?(.+)?/i,
    extractor: (match) => ({
      intent: 'log_expense',
      amount: parseAmount(match[1]),
      description: match[2] ? cleanDescription(match[2]) : 'Expense',
      confidence: 0.90,
    }),
  },
];

// ============================================================================
// TASK PATTERNS
// ============================================================================

const TASK_PATTERNS: PatternMatch[] = [
  {
    // "add task: inspect foundation", "task: buy cement"
    pattern: /(?:add\s+)?task\s*[:]\s*(.+)/i,
    extractor: (match) => ({
      intent: 'create_task',
      title: cleanDescription(match[1]),
      confidence: 0.95,
    }),
  },
  {
    // "todo: check workers", "to do: visit site"
    pattern: /(?:todo|to\s+do)\s*[:]\s*(.+)/i,
    extractor: (match) => ({
      intent: 'create_task',
      title: cleanDescription(match[1]),
      confidence: 0.95,
    }),
  },
  {
    // "remind me to [task]", "need to [task]"
    pattern: /(?:remind\s+me\s+to|need\s+to|have\s+to)\s+(.+)/i,
    extractor: (match) => ({
      intent: 'create_task',
      title: cleanDescription(match[1]),
      confidence: 0.90,
    }),
  },
  {
    // Priority indicators: "urgent: [task]", "important: [task]"
    pattern: /(?:urgent|important|priority)\s*[:]\s*(.+)/i,
    extractor: (match) => ({
      intent: 'create_task',
      title: cleanDescription(match[1]),
      priority: 'high',
      confidence: 0.95,
    }),
  },
];

// ============================================================================
// BUDGET PATTERNS
// ============================================================================

const BUDGET_PATTERNS: PatternMatch[] = [
  {
    // "set budget 1000000", "budget is 500000"
    pattern: /(?:set\s+)?budget(?:\s+is)?\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    extractor: (match) => ({
      intent: 'set_budget',
      amount: parseAmount(match[1]),
      confidence: 0.95,
    }),
  },
  {
    // "my budget [amount]", "project budget [amount]"
    pattern: /(?:my|project)\s+budget\s+(?:is\s+)?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    extractor: (match) => ({
      intent: 'set_budget',
      amount: parseAmount(match[1]),
      confidence: 0.95,
    }),
  },
  {
    // Luganda: "budget yange [amount]"
    pattern: /budget\s+(?:yange|yaffe)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    extractor: (match) => ({
      intent: 'set_budget',
      amount: parseAmount(match[1]),
      confidence: 0.90,
    }),
  },
];

// ============================================================================
// QUERY PATTERNS
// ============================================================================

const QUERY_PATTERNS: RegExp[] = [
  // English queries
  /(?:how\s+much|total|what.*spent|show.*expenses|list.*expenses)/i,
  /(?:report|summary|balance|remaining)/i,
  /(?:spent\s+today|spent\s+this\s+week|spent\s+this\s+month)/i,
  /(?:where.*money|how.*much.*left|budget\s+status)/i,
  
  // Luganda queries
  /(?:ssente\s+zmeka|omaze\s+meka|ensimbi\s+zmeka)/i, // "how much money"
  /(?:lipoota|okebera|balance)/i, // "report, check, balance"
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse amount string to number
 * Handles: "1000", "1,000", "1000.50", "1,000.50"
 */
function parseAmount(amountStr: string): number {
  // Remove commas and parse as float
  const cleaned = amountStr.replace(/,/g, '');
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount) || amount < 0) {
    return 0;
  }
  
  return amount;
}

/**
 * Clean and normalize description text
 */
function cleanDescription(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[,.]$/, '') // Remove trailing punctuation
    .substring(0, 255); // Limit length
}

/**
 * Extract currency if present (UGX, USH, KSH, etc.)
 */
function extractCurrency(text: string): string | undefined {
  const currencyMatch = text.match(/\b(UGX|USH|KSH|TZS|USD|EUR|GBP)\b/i);
  return currencyMatch ? currencyMatch[1].toUpperCase() : undefined;
}

/**
 * Check if message contains a number that could be an amount
 */
function hasNumericAmount(text: string): boolean {
  return /\d+(?:,\d{3})*(?:\.\d{2})?/.test(text);
}

// ============================================================================
// MAIN PARSER FUNCTION
// ============================================================================

/**
 * Parse WhatsApp message to detect user intent
 * 
 * @param messageBody - The text message from user
 * @param mediaUrl - Optional media URL if image/document attached
 * @returns Parsed intent with extracted data
 * 
 * @example
 * parseIntent("spent 500 on cement")
 * // => { intent: 'log_expense', amount: 500, description: 'cement', ... }
 * 
 * parseIntent("task: inspect foundation")
 * // => { intent: 'create_task', title: 'inspect foundation', ... }
 */
export function parseIntent(
  messageBody: string,
  mediaUrl?: string
): ParsedIntent {
  const trimmedMessage = messageBody.trim();
  const lowerMessage = trimmedMessage.toLowerCase();
  
  // Handle empty message
  if (!trimmedMessage) {
    if (mediaUrl) {
      return {
        intent: 'log_image',
        caption: '',
        mediaUrl,
        originalMessage: '',
        confidence: 0.95,
      };
    }
    
    return {
      intent: 'unknown',
      originalMessage: '',
      confidence: 0,
    };
  }
  
  // ========================================
  // 1. HANDLE IMAGE WITH CAPTION
  // ========================================
  if (mediaUrl) {
    // Check if caption looks like an expense
    if (hasNumericAmount(trimmedMessage)) {
      // Try to parse as expense
      for (const { pattern, extractor } of EXPENSE_PATTERNS) {
        const match = trimmedMessage.match(pattern);
        if (match) {
          const result = extractor(match);
          return {
            ...result,
            intent: 'log_expense',
            mediaUrl,
            originalMessage: trimmedMessage,
            confidence: (result.confidence || 0.8) * 0.95, // Slightly lower confidence for image captions
          } as ParsedIntent;
        }
      }
    }
    
    // Default image with caption
    return {
      intent: 'log_image',
      caption: trimmedMessage,
      mediaUrl,
      originalMessage: trimmedMessage,
      confidence: 0.90,
    };
  }
  
  // ========================================
  // 2. CHECK FOR EXPENSE PATTERNS
  // ========================================
  for (const { pattern, extractor } of EXPENSE_PATTERNS) {
    const match = trimmedMessage.match(pattern);
    if (match) {
      const result = extractor(match);
      const currency = extractCurrency(trimmedMessage);
      
      return {
        ...result,
        intent: 'log_expense',
        currency: currency || 'UGX',
        originalMessage: trimmedMessage,
      } as ParsedIntent;
    }
  }
  
  // ========================================
  // 3. CHECK FOR TASK PATTERNS
  // ========================================
  for (const { pattern, extractor } of TASK_PATTERNS) {
    const match = trimmedMessage.match(pattern);
    if (match) {
      const result = extractor(match);
      
      return {
        ...result,
        intent: 'create_task',
        originalMessage: trimmedMessage,
      } as ParsedIntent;
    }
  }
  
  // ========================================
  // 4. CHECK FOR BUDGET PATTERNS
  // ========================================
  for (const { pattern, extractor } of BUDGET_PATTERNS) {
    const match = trimmedMessage.match(pattern);
    if (match) {
      const result = extractor(match);
      
      return {
        ...result,
        intent: 'set_budget',
        originalMessage: trimmedMessage,
      } as ParsedIntent;
    }
  }
  
  // ========================================
  // 5. CHECK FOR QUERY PATTERNS
  // ========================================
  for (const pattern of QUERY_PATTERNS) {
    if (pattern.test(lowerMessage)) {
      return {
        intent: 'query_expenses',
        originalMessage: trimmedMessage,
        confidence: 0.90,
      };
    }
  }
  
  // ========================================
  // 6. FALLBACK: TRY SIMPLE NUMBER EXTRACTION
  // ========================================
  // If message has a number, assume it might be an expense
  const simpleNumberMatch = trimmedMessage.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (simpleNumberMatch) {
    const amount = parseAmount(simpleNumberMatch[1]);
    
    // Extract description (everything that's not the number)
    const description = trimmedMessage
      .replace(simpleNumberMatch[0], '')
      .trim()
      .replace(/^(?:for|on|ku|pa)\s+/i, ''); // Remove common prepositions
    
    if (description.length > 0) {
      return {
        intent: 'log_expense',
        amount,
        description: cleanDescription(description) || 'Expense',
        currency: extractCurrency(trimmedMessage) || 'UGX',
        originalMessage: trimmedMessage,
        confidence: 0.60, // Lower confidence for fallback
      };
    }
  }
  
  // ========================================
  // 7. UNKNOWN INTENT
  // ========================================
  return {
    intent: 'unknown',
    originalMessage: trimmedMessage,
    confidence: 0,
  };
}

// ============================================================================
// UTILITY FUNCTIONS FOR EXTERNAL USE
// ============================================================================

/**
 * Validate parsed intent has required fields
 */
export function isValidIntent(parsed: ParsedIntent): boolean {
  switch (parsed.intent) {
    case 'log_expense':
      return !!(parsed.amount && parsed.amount > 0 && parsed.description);
    
    case 'create_task':
      return !!(parsed.title && parsed.title.length > 0);
    
    case 'set_budget':
      return !!(parsed.amount && parsed.amount > 0);
    
    case 'query_expenses':
      return true; // No required fields
    
    case 'log_image':
      return !!parsed.mediaUrl;
    
    case 'unknown':
      return false;
    
    default:
      return false;
  }
}

/**
 * Get confidence threshold for each intent type
 */
export function getConfidenceThreshold(intent: string): number {
  switch (intent) {
    case 'log_expense':
      return 0.70; // Require 70% confidence for expenses
    case 'create_task':
      return 0.85; // Higher confidence for tasks
    case 'set_budget':
      return 0.90; // Very high confidence for budget changes
    case 'query_expenses':
      return 0.80;
    case 'log_image':
      return 0.85;
    default:
      return 0.50;
  }
}

/**
 * Check if intent confidence meets threshold
 */
export function meetsConfidenceThreshold(parsed: ParsedIntent): boolean {
  const threshold = getConfidenceThreshold(parsed.intent);
  return parsed.confidence >= threshold;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  parseIntent,
  isValidIntent,
  meetsConfidenceThreshold,
  getConfidenceThreshold,
};


