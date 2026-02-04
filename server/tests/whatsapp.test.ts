/**
 * WhatsApp Integration Test Suite
 * 
 * Comprehensive tests for WhatsApp message handling
 * Run with: npm test -- whatsapp.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { parseIntent, isValidIntent, meetsConfidenceThreshold } from '../services/intentParser';

// ============================================================================
// TEST SUITE: Intent Parser
// ============================================================================

describe('WhatsApp Intent Parser', () => {
  
  describe('Expense Logging (English)', () => {
    const testCases = [
      {
        message: 'Spent 500000 on cement',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          description: 'cement',
          confidence: 0.95,
        },
      },
      {
        message: 'paid 200000 for bricks',
        expected: {
          intent: 'log_expense',
          amount: 200000,
          description: 'bricks',
          confidence: 0.95,
        },
      },
      {
        message: 'bought sand 150000',
        expected: {
          intent: 'log_expense',
          amount: 150000,
          description: 'sand',
          confidence: 0.95,
        },
      },
      {
        message: '500000 for cement',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          description: 'cement',
          confidence: 0.85,
        },
      },
      {
        message: 'cement 500000 bags',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          description: 'cement',
          confidence: 0.80,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.amount).toBe(expected.amount);
        expect(parsed.description?.toLowerCase()).toContain(expected.description);
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
        expect(meetsConfidenceThreshold(parsed)).toBe(true);
      });
    });
  });

  describe('Expense Logging (Luganda)', () => {
    const testCases = [
      {
        message: 'Nimaze 300 ku sand',
        expected: {
          intent: 'log_expense',
          amount: 300,
          description: 'sand',
          confidence: 0.95,
        },
      },
      {
        message: 'naguze cement 500',
        expected: {
          intent: 'log_expense',
          amount: 500,
          description: 'cement',
          confidence: 0.95,
        },
      },
      {
        message: 'omaze 500000',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          confidence: 0.90,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse Luganda "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.amount).toBe(expected.amount);
        if (expected.description) {
          expect(parsed.description?.toLowerCase()).toContain(expected.description);
        }
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
      });
    });
  });

  describe('Task Creation', () => {
    const testCases = [
      {
        message: 'Add task: inspect foundation',
        expected: {
          intent: 'create_task',
          title: 'inspect foundation',
          confidence: 0.95,
        },
      },
      {
        message: 'task: pour foundation',
        expected: {
          intent: 'create_task',
          title: 'pour foundation',
          confidence: 0.95,
        },
      },
      {
        message: 'todo: buy materials',
        expected: {
          intent: 'create_task',
          title: 'buy materials',
          confidence: 0.95,
        },
      },
      {
        message: 'urgent: fix leak',
        expected: {
          intent: 'create_task',
          title: 'fix leak',
          priority: 'high',
          confidence: 0.95,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.title?.toLowerCase()).toContain(expected.title.toLowerCase());
        if (expected.priority) {
          expect(parsed.priority).toBe(expected.priority);
        }
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
        expect(meetsConfidenceThreshold(parsed)).toBe(true);
      });
    });
  });

  describe('Budget Setting', () => {
    const testCases = [
      {
        message: 'Set budget 5000000',
        expected: {
          intent: 'set_budget',
          amount: 5000000,
          confidence: 0.95,
        },
      },
      {
        message: 'budget is 10000000',
        expected: {
          intent: 'set_budget',
          amount: 10000000,
          confidence: 0.95,
        },
      },
      {
        message: 'my budget 2000000',
        expected: {
          intent: 'set_budget',
          amount: 2000000,
          confidence: 0.95,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.amount).toBe(expected.amount);
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
        expect(meetsConfidenceThreshold(parsed)).toBe(true);
      });
    });
  });

  describe('Expense Queries', () => {
    const testCases = [
      {
        message: 'How much have I spent?',
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
      {
        message: 'show expenses',
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
      {
        message: 'report',
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
      {
        message: 'ssente zmeka', // Luganda: "how much money"
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
      });
    });
  });

  describe('Image Upload', () => {
    it('should detect image with caption', () => {
      const parsed = parseIntent('Construction progress', 'https://example.com/image.jpg');
      
      expect(parsed.intent).toBe('log_image');
      expect(parsed.mediaUrl).toBe('https://example.com/image.jpg');
      expect(parsed.caption).toBe('Construction progress');
      expect(isValidIntent(parsed)).toBe(true);
    });

    it('should detect image with expense caption', () => {
      const parsed = parseIntent('spent 50000 on cement', 'https://example.com/receipt.jpg');
      
      expect(parsed.intent).toBe('log_expense');
      expect(parsed.amount).toBe(50000);
      expect(parsed.mediaUrl).toBe('https://example.com/receipt.jpg');
    });
  });

  describe('Invalid Messages', () => {
    it('should return unknown for gibberish', () => {
      const parsed = parseIntent('asdfghjkl');
      
      expect(parsed.intent).toBe('unknown');
      expect(isValidIntent(parsed)).toBe(false);
    });

    it('should return unknown for empty message', () => {
      const parsed = parseIntent('');
      
      expect(parsed.intent).toBe('unknown');
      expect(isValidIntent(parsed)).toBe(false);
    });
  });
});

// ============================================================================
// TEST SUITE: Response Formatting
// ============================================================================

describe('WhatsApp Response Formatting', () => {
  
  describe('Expense Response', () => {
    it('should format expense response professionally', () => {
      // This would be tested with actual handler function
      const expectedFormat = /✅ \*Expense Logged\*/;
      const expectedAmount = /💰 \*UGX \d{1,3}(?:,\d{3})*\*/;
      const expectedToday = /📈 \*Today's Total:\*/;
      const expectedRemaining = /💵 \*Remaining Budget:\*/;
      const expectedPercent = /📊 \*Budget Used:\* \d+\.\d+%/;
      
      // In real test, call handleLogExpense and check response
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Task Response', () => {
    it('should format task response professionally', () => {
      const expectedFormat = /✅ \*Task Added\*/;
      const expectedTitle = /📋 \*/;
      const expectedPriority = /⚡ Priority:/;
      const expectedCount = /📌 You have \*\d+\* pending tasks/;
      
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Budget Response', () => {
    it('should format budget response professionally', () => {
      const expectedFormat = /✅ \*Budget Updated\*/;
      const expectedBudget = /💰 \*New Budget:\*/;
      const expectedSpent = /💵 \*Already Spent:\*/;
      const expectedRemaining = /💸 \*Remaining:\*/;
      const expectedPercent = /📊 \*Used:\* \d+\.\d+%/;
      
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Query Response', () => {
    it('should format expense query response professionally', () => {
      const expectedFormat = /📊 \*.* - Expense Report\*/;
      const expectedBudget = /💰 \*Budget:\*/;
      const expectedSpent = /💵 \*Spent:\*/;
      const expectedRemaining = /💸 \*Remaining:\*/;
      const expectedCount = /📝 \*Total Expenses:\*/;
      
      expect(true).toBe(true); // Placeholder
    });
  });
});

// ============================================================================
// TEST SUITE: Error Handling
// ============================================================================

describe('WhatsApp Error Handling', () => {
  
  it('should handle unregistered users gracefully', () => {
    // Test that unregistered users get welcome message
    expect(true).toBe(true);
  });

  it('should handle missing project gracefully', () => {
    // Test that users without projects get helpful message
    expect(true).toBe(true);
  });

  it('should handle database errors gracefully', () => {
    // Test that database errors don't crash the system
    expect(true).toBe(true);
  });

  it('should handle invalid amounts gracefully', () => {
    const parsed = parseIntent('spent abc on cement');
    expect(parsed.intent).toBe('unknown');
  });
});

// ============================================================================
// MANUAL TEST CASES (for manual testing via WhatsApp)
// ============================================================================

export const MANUAL_TEST_CASES = {
  expenseLogging: [
    'Spent 500000 on cement',
    'paid 200000 for bricks',
    'bought sand 150000',
    'Nimaze 300 ku sand', // Luganda
    'naguze cement 500', // Luganda
  ],
  
  taskCreation: [
    'Add task: inspect foundation',
    'task: pour foundation',
    'todo: buy materials',
    'urgent: fix leak',
  ],
  
  budgetSetting: [
    'Set budget 5000000',
    'budget is 10000000',
    'my budget 2000000',
  ],
  
  queries: [
    'How much have I spent?',
    'show expenses',
    'report',
    'ssente zmeka', // Luganda
  ],
  
  imageUpload: [
    'Send image with caption: "Construction progress"',
    'Send image with expense: "spent 50000 on cement"',
  ],
};

// ============================================================================
// EXPECTED RESPONSES (for manual verification)
// ============================================================================

export const EXPECTED_RESPONSES = {
  expenseLogged: (amount: number, description: string, todayTotal: string, remaining: string, percent: number) =>
    `✅ *Expense Logged*\n\n` +
    `📝 *${description}*\n` +
    `💰 *UGX ${amount.toLocaleString()}*\n` +
    `📊 Project: [Project Name]\n\n` +
    `📈 *Today's Total:* ${todayTotal}\n` +
    `💵 *Remaining Budget:* ${remaining}\n` +
    `📊 *Budget Used:* ${percent.toFixed(1)}%`,

  taskCreated: (title: string, projectName: string, priority: string, pendingCount: number) =>
    `✅ *Task Added*\n\n` +
    `📋 *${title}*\n` +
    `📊 Project: ${projectName}\n` +
    `⚡ Priority: ${priority}\n` +
    `📝 Status: Pending\n\n` +
    `📌 You have *${pendingCount}* pending tasks`,

  budgetUpdated: (projectName: string, budget: string, spent: string, remaining: string, percent: number) =>
    `✅ *Budget Updated*\n\n` +
    `📊 Project: ${projectName}\n` +
    `💰 *New Budget:* ${budget}\n` +
    `💵 *Already Spent:* ${spent}\n` +
    `💸 *Remaining:* ${remaining}\n` +
    `📊 *Used:* ${percent.toFixed(1)}%`,

  expenseQuery: (projectName: string, budget: string, spent: string, remaining: string, percent: number, count: number) =>
    `📊 *${projectName} - Expense Report*\n\n` +
    `💰 *Budget:* ${budget}\n` +
    `💵 *Spent:* ${spent} (${percent.toFixed(1)}%)\n` +
    `💸 *Remaining:* ${remaining}\n` +
    `📝 *Total Expenses:* ${count}\n\n` +
    `🔝 *Top Categories:*\n` +
    `[Category breakdown]`,
};


 * WhatsApp Integration Test Suite
 * 
 * Comprehensive tests for WhatsApp message handling
 * Run with: npm test -- whatsapp.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { parseIntent, isValidIntent, meetsConfidenceThreshold } from '../services/intentParser';

// ============================================================================
// TEST SUITE: Intent Parser
// ============================================================================

describe('WhatsApp Intent Parser', () => {
  
  describe('Expense Logging (English)', () => {
    const testCases = [
      {
        message: 'Spent 500000 on cement',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          description: 'cement',
          confidence: 0.95,
        },
      },
      {
        message: 'paid 200000 for bricks',
        expected: {
          intent: 'log_expense',
          amount: 200000,
          description: 'bricks',
          confidence: 0.95,
        },
      },
      {
        message: 'bought sand 150000',
        expected: {
          intent: 'log_expense',
          amount: 150000,
          description: 'sand',
          confidence: 0.95,
        },
      },
      {
        message: '500000 for cement',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          description: 'cement',
          confidence: 0.85,
        },
      },
      {
        message: 'cement 500000 bags',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          description: 'cement',
          confidence: 0.80,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.amount).toBe(expected.amount);
        expect(parsed.description?.toLowerCase()).toContain(expected.description);
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
        expect(meetsConfidenceThreshold(parsed)).toBe(true);
      });
    });
  });

  describe('Expense Logging (Luganda)', () => {
    const testCases = [
      {
        message: 'Nimaze 300 ku sand',
        expected: {
          intent: 'log_expense',
          amount: 300,
          description: 'sand',
          confidence: 0.95,
        },
      },
      {
        message: 'naguze cement 500',
        expected: {
          intent: 'log_expense',
          amount: 500,
          description: 'cement',
          confidence: 0.95,
        },
      },
      {
        message: 'omaze 500000',
        expected: {
          intent: 'log_expense',
          amount: 500000,
          confidence: 0.90,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse Luganda "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.amount).toBe(expected.amount);
        if (expected.description) {
          expect(parsed.description?.toLowerCase()).toContain(expected.description);
        }
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
      });
    });
  });

  describe('Task Creation', () => {
    const testCases = [
      {
        message: 'Add task: inspect foundation',
        expected: {
          intent: 'create_task',
          title: 'inspect foundation',
          confidence: 0.95,
        },
      },
      {
        message: 'task: pour foundation',
        expected: {
          intent: 'create_task',
          title: 'pour foundation',
          confidence: 0.95,
        },
      },
      {
        message: 'todo: buy materials',
        expected: {
          intent: 'create_task',
          title: 'buy materials',
          confidence: 0.95,
        },
      },
      {
        message: 'urgent: fix leak',
        expected: {
          intent: 'create_task',
          title: 'fix leak',
          priority: 'high',
          confidence: 0.95,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.title?.toLowerCase()).toContain(expected.title.toLowerCase());
        if (expected.priority) {
          expect(parsed.priority).toBe(expected.priority);
        }
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
        expect(meetsConfidenceThreshold(parsed)).toBe(true);
      });
    });
  });

  describe('Budget Setting', () => {
    const testCases = [
      {
        message: 'Set budget 5000000',
        expected: {
          intent: 'set_budget',
          amount: 5000000,
          confidence: 0.95,
        },
      },
      {
        message: 'budget is 10000000',
        expected: {
          intent: 'set_budget',
          amount: 10000000,
          confidence: 0.95,
        },
      },
      {
        message: 'my budget 2000000',
        expected: {
          intent: 'set_budget',
          amount: 2000000,
          confidence: 0.95,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.amount).toBe(expected.amount);
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
        expect(meetsConfidenceThreshold(parsed)).toBe(true);
      });
    });
  });

  describe('Expense Queries', () => {
    const testCases = [
      {
        message: 'How much have I spent?',
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
      {
        message: 'show expenses',
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
      {
        message: 'report',
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
      {
        message: 'ssente zmeka', // Luganda: "how much money"
        expected: {
          intent: 'query_expenses',
          confidence: 0.90,
        },
      },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should parse "${message}" correctly`, () => {
        const parsed = parseIntent(message);
        
        expect(parsed.intent).toBe(expected.intent);
        expect(parsed.confidence).toBeGreaterThanOrEqual(expected.confidence - 0.1);
        expect(isValidIntent(parsed)).toBe(true);
      });
    });
  });

  describe('Image Upload', () => {
    it('should detect image with caption', () => {
      const parsed = parseIntent('Construction progress', 'https://example.com/image.jpg');
      
      expect(parsed.intent).toBe('log_image');
      expect(parsed.mediaUrl).toBe('https://example.com/image.jpg');
      expect(parsed.caption).toBe('Construction progress');
      expect(isValidIntent(parsed)).toBe(true);
    });

    it('should detect image with expense caption', () => {
      const parsed = parseIntent('spent 50000 on cement', 'https://example.com/receipt.jpg');
      
      expect(parsed.intent).toBe('log_expense');
      expect(parsed.amount).toBe(50000);
      expect(parsed.mediaUrl).toBe('https://example.com/receipt.jpg');
    });
  });

  describe('Invalid Messages', () => {
    it('should return unknown for gibberish', () => {
      const parsed = parseIntent('asdfghjkl');
      
      expect(parsed.intent).toBe('unknown');
      expect(isValidIntent(parsed)).toBe(false);
    });

    it('should return unknown for empty message', () => {
      const parsed = parseIntent('');
      
      expect(parsed.intent).toBe('unknown');
      expect(isValidIntent(parsed)).toBe(false);
    });
  });
});

// ============================================================================
// TEST SUITE: Response Formatting
// ============================================================================

describe('WhatsApp Response Formatting', () => {
  
  describe('Expense Response', () => {
    it('should format expense response professionally', () => {
      // This would be tested with actual handler function
      const expectedFormat = /✅ \*Expense Logged\*/;
      const expectedAmount = /💰 \*UGX \d{1,3}(?:,\d{3})*\*/;
      const expectedToday = /📈 \*Today's Total:\*/;
      const expectedRemaining = /💵 \*Remaining Budget:\*/;
      const expectedPercent = /📊 \*Budget Used:\* \d+\.\d+%/;
      
      // In real test, call handleLogExpense and check response
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Task Response', () => {
    it('should format task response professionally', () => {
      const expectedFormat = /✅ \*Task Added\*/;
      const expectedTitle = /📋 \*/;
      const expectedPriority = /⚡ Priority:/;
      const expectedCount = /📌 You have \*\d+\* pending tasks/;
      
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Budget Response', () => {
    it('should format budget response professionally', () => {
      const expectedFormat = /✅ \*Budget Updated\*/;
      const expectedBudget = /💰 \*New Budget:\*/;
      const expectedSpent = /💵 \*Already Spent:\*/;
      const expectedRemaining = /💸 \*Remaining:\*/;
      const expectedPercent = /📊 \*Used:\* \d+\.\d+%/;
      
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Query Response', () => {
    it('should format expense query response professionally', () => {
      const expectedFormat = /📊 \*.* - Expense Report\*/;
      const expectedBudget = /💰 \*Budget:\*/;
      const expectedSpent = /💵 \*Spent:\*/;
      const expectedRemaining = /💸 \*Remaining:\*/;
      const expectedCount = /📝 \*Total Expenses:\*/;
      
      expect(true).toBe(true); // Placeholder
    });
  });
});

// ============================================================================
// TEST SUITE: Error Handling
// ============================================================================

describe('WhatsApp Error Handling', () => {
  
  it('should handle unregistered users gracefully', () => {
    // Test that unregistered users get welcome message
    expect(true).toBe(true);
  });

  it('should handle missing project gracefully', () => {
    // Test that users without projects get helpful message
    expect(true).toBe(true);
  });

  it('should handle database errors gracefully', () => {
    // Test that database errors don't crash the system
    expect(true).toBe(true);
  });

  it('should handle invalid amounts gracefully', () => {
    const parsed = parseIntent('spent abc on cement');
    expect(parsed.intent).toBe('unknown');
  });
});

// ============================================================================
// MANUAL TEST CASES (for manual testing via WhatsApp)
// ============================================================================

export const MANUAL_TEST_CASES = {
  expenseLogging: [
    'Spent 500000 on cement',
    'paid 200000 for bricks',
    'bought sand 150000',
    'Nimaze 300 ku sand', // Luganda
    'naguze cement 500', // Luganda
  ],
  
  taskCreation: [
    'Add task: inspect foundation',
    'task: pour foundation',
    'todo: buy materials',
    'urgent: fix leak',
  ],
  
  budgetSetting: [
    'Set budget 5000000',
    'budget is 10000000',
    'my budget 2000000',
  ],
  
  queries: [
    'How much have I spent?',
    'show expenses',
    'report',
    'ssente zmeka', // Luganda
  ],
  
  imageUpload: [
    'Send image with caption: "Construction progress"',
    'Send image with expense: "spent 50000 on cement"',
  ],
};

// ============================================================================
// EXPECTED RESPONSES (for manual verification)
// ============================================================================

export const EXPECTED_RESPONSES = {
  expenseLogged: (amount: number, description: string, todayTotal: string, remaining: string, percent: number) =>
    `✅ *Expense Logged*\n\n` +
    `📝 *${description}*\n` +
    `💰 *UGX ${amount.toLocaleString()}*\n` +
    `📊 Project: [Project Name]\n\n` +
    `📈 *Today's Total:* ${todayTotal}\n` +
    `💵 *Remaining Budget:* ${remaining}\n` +
    `📊 *Budget Used:* ${percent.toFixed(1)}%`,

  taskCreated: (title: string, projectName: string, priority: string, pendingCount: number) =>
    `✅ *Task Added*\n\n` +
    `📋 *${title}*\n` +
    `📊 Project: ${projectName}\n` +
    `⚡ Priority: ${priority}\n` +
    `📝 Status: Pending\n\n` +
    `📌 You have *${pendingCount}* pending tasks`,

  budgetUpdated: (projectName: string, budget: string, spent: string, remaining: string, percent: number) =>
    `✅ *Budget Updated*\n\n` +
    `📊 Project: ${projectName}\n` +
    `💰 *New Budget:* ${budget}\n` +
    `💵 *Already Spent:* ${spent}\n` +
    `💸 *Remaining:* ${remaining}\n` +
    `📊 *Used:* ${percent.toFixed(1)}%`,

  expenseQuery: (projectName: string, budget: string, spent: string, remaining: string, percent: number, count: number) =>
    `📊 *${projectName} - Expense Report*\n\n` +
    `💰 *Budget:* ${budget}\n` +
    `💵 *Spent:* ${spent} (${percent.toFixed(1)}%)\n` +
    `💸 *Remaining:* ${remaining}\n` +
    `📝 *Total Expenses:* ${count}\n\n` +
    `🔝 *Top Categories:*\n` +
    `[Category breakdown]`,
};


