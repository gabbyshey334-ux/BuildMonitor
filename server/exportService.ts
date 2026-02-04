import { Response } from 'express';
import { storage } from './storage';

export interface ExportOptions {
  projectId: string;
  format: 'csv' | 'json';
  dataTypes: ('financial' | 'tasks' | 'inventory' | 'milestones' | 'all')[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

// Helper function to escape CSV values
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convert array of objects to CSV
function arrayToCsv(data: any[], filename: string): string {
  if (data.length === 0) return `# ${filename}\n# No data available\n\n`;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    `# ${filename}`,
    `# Generated on ${new Date().toISOString()}`,
    '',
    headers.join(','),
    ...data.map(row => headers.map(header => escapeCsv(row[header])).join(','))
  ].join('\n');
  
  return csvContent + '\n\n';
}

export class ExportService {
  async exportProjectData(options: ExportOptions): Promise<{ content: string; filename: string; mimeType: string }> {
    const { projectId, format, dataTypes, dateRange } = options;
    
    // Get project details
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const sanitizedProjectName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${sanitizedProjectName}_export_${timestamp}.${format}`;

    let exportData: any = {};

    // Export project basic info
    exportData.project = {
      id: project.id,
      name: project.name,
      description: project.description,
      budget: project.budget,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      exportedAt: new Date().toISOString()
    };

    // Export financial data
    if (dataTypes.includes('financial') || dataTypes.includes('all')) {
      // Daily ledgers
      const dailyLedgers = await storage.getDailyLedgers(projectId);
      exportData.dailyLedgers = dailyLedgers.map(ledger => ({
        id: ledger.id,
        date: ledger.date,
        openingCash: ledger.openingCash,
        closingCash: ledger.closingCash,
        totalCashSpent: ledger.totalCashSpent,
        totalSupplierSpent: ledger.totalSupplierSpent,
        notes: ledger.notes,
        submittedAt: ledger.submittedAt,
        lineItemsCount: ledger.lines.length
      }));

      // Daily ledger lines (detailed expenses)
      const allLedgerLines = dailyLedgers.flatMap(ledger => 
        ledger.lines.map(line => ({
          ledgerDate: ledger.date,
          item: line.item,
          category: line.category,
          amount: line.amount,
          paymentMethod: line.paymentMethod,
          quantity: line.quantity,
          unit: line.unit,
          supplierId: line.supplierId,
          note: line.note
        }))
      );
      exportData.expenseDetails = allLedgerLines;

      // Cash deposits
      const cashDeposits = await storage.getCashDeposits(projectId);
      exportData.cashDeposits = cashDeposits.map(deposit => ({
        id: deposit.id,
        amount: deposit.amount,
        date: deposit.date,
        method: deposit.method,
        reference: deposit.reference,
        note: deposit.note
      }));

      // Financial summary
      const analytics = await storage.getProjectAnalytics(projectId);
      exportData.financialSummary = {
        totalBudget: project.budget,
        totalSpent: analytics.totalSpent,
        totalCashSpent: analytics.totalCashSpent,
        totalSupplierSpent: analytics.totalSupplierSpent,
        cashBalance: analytics.cashBalance,
        budgetUtilization: analytics.totalSpent / parseFloat(project.budget)
      };
    }

    // Export tasks
    if (dataTypes.includes('tasks') || dataTypes.includes('all')) {
      const tasks = await storage.getTasks(projectId);
      exportData.tasks = tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        completed: task.completed,
        dueDate: task.dueDate,
        location: task.location,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }));
    }

    // Export inventory
    if (dataTypes.includes('inventory') || dataTypes.includes('all')) {
      const inventory = await storage.getInventory(projectId);
      exportData.inventory = inventory.map(item => ({
        id: item.id,
        item: item.item,
        quantity: item.quantity,
        used: item.used,
        remaining: item.remaining,
        deliveryDate: item.deliveryDate,
        createdAt: item.createdAt
      }));
    }

    // Export milestones
    if (dataTypes.includes('milestones') || dataTypes.includes('all')) {
      const milestones = await storage.getMilestones(projectId);
      exportData.milestones = milestones.map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        completed: milestone.completed,
        progress: milestone.progress,
        targetDate: milestone.targetDate,
        createdAt: milestone.createdAt
      }));
    }

    // Format output
    if (format === 'json') {
      return {
        content: JSON.stringify(exportData, null, 2),
        filename,
        mimeType: 'application/json'
      };
    } else {
      // CSV format - multiple files combined
      let csvContent = `# JengaTrack Uganda - Project Export\n`;
      csvContent += `# Project: ${project.name}\n`;
      csvContent += `# Exported: ${new Date().toISOString()}\n`;
      csvContent += `# Format: CSV\n\n`;

      // Add each section as CSV
      if (exportData.dailyLedgers) {
        csvContent += arrayToCsv(exportData.dailyLedgers, 'Daily Ledgers Summary');
      }
      
      if (exportData.expenseDetails) {
        csvContent += arrayToCsv(exportData.expenseDetails, 'Expense Line Items');
      }
      
      if (exportData.cashDeposits) {
        csvContent += arrayToCsv(exportData.cashDeposits, 'Cash Deposits');
      }
      
      if (exportData.tasks) {
        csvContent += arrayToCsv(exportData.tasks, 'Tasks');
      }
      
      if (exportData.inventory) {
        csvContent += arrayToCsv(exportData.inventory, 'Inventory');
      }
      
      if (exportData.milestones) {
        csvContent += arrayToCsv(exportData.milestones, 'Milestones');
      }

      if (exportData.financialSummary) {
        csvContent += arrayToCsv([exportData.financialSummary], 'Financial Summary');
      }

      return {
        content: csvContent,
        filename,
        mimeType: 'text/csv'
      };
    }
  }

  async exportAllProjects(): Promise<{ content: string; filename: string; mimeType: string }> {
    const projects = await storage.getProjects(''); // Get all projects
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `all_projects_summary_${timestamp}.json`;

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalProjects: projects.length,
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        budget: project.budget,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        ownerId: project.ownerId,
        createdAt: project.createdAt
      }))
    };

    return {
      content: JSON.stringify(exportData, null, 2),
      filename,
      mimeType: 'application/json'
    };
  }
}

export const exportService = new ExportService();