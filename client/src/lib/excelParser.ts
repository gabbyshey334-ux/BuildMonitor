import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedExcelData {
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
  sheetName?: string;
}

export interface ColumnMapping {
  [excelColumn: string]: string; // Maps Excel column name to our field name
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Supported file extensions
export const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// Common column name variations for auto-detection
export const COLUMN_MAPPINGS = {
  date: ['date', 'Date', 'DATE', 'transaction date', 'Transaction Date', 'entry date', 'Entry Date'],
  description: ['description', 'Description', 'DESCRIPTION', 'item', 'Item', 'ITEM', 'expense', 'Expense', 'details', 'Details'],
  amount: ['amount', 'Amount', 'AMOUNT', 'cost', 'Cost', 'COST', 'price', 'Price', 'PRICE', 'value', 'Value'],
  category: ['category', 'Category', 'CATEGORY', 'type', 'Type', 'TYPE', 'expense type', 'Expense Type'],
  quantity: ['quantity', 'Quantity', 'QUANTITY', 'qty', 'Qty', 'QTY', 'units', 'Units'],
  unit: ['unit', 'Unit', 'UNIT', 'units', 'Units', 'measurement', 'Measurement'],
  paymentMethod: ['payment method', 'Payment Method', 'PAYMENT METHOD', 'payment', 'Payment', 'method', 'Method'],
  supplier: ['supplier', 'Supplier', 'SUPPLIER', 'vendor', 'Vendor', 'VENDOR', 'company', 'Company'],
  phase: ['phase', 'Phase', 'PHASE', 'construction phase', 'Construction Phase', 'project phase', 'Project Phase'],
  note: ['note', 'Note', 'NOTE', 'notes', 'Notes', 'NOTES', 'comments', 'Comments', 'remarks', 'Remarks']
};

/**
 * Check if a file is a supported Excel/CSV format
 */
export function isSupportedFile(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(extension);
}

/**
 * Validate file size and type
 */
export function validateFile(file: File): ValidationResult {
  const errors: string[] = [];
  
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push('File size must be less than 10MB');
  }
  
  // Check file extension
  if (!isSupportedFile(file)) {
    errors.push('File must be an Excel (.xlsx, .xls) or CSV (.csv) file');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
function parseExcelFile(file: File): Promise<ParsedExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (!jsonData.length) {
          reject(new Error('Excel file appears to be empty'));
          return;
        }
        
        const headers = (jsonData[0] as (string | number)[]).map(h => String(h).trim()).filter(h => h);
        const rows = jsonData.slice(1) as (string | number)[][];
        
        // Filter out completely empty rows
        const filteredRows = rows.filter(row => 
          row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
        );
        
        resolve({
          headers,
          rows: filteredRows,
          fileName: file.name,
          sheetName
        });
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsBinaryString(file);
  });
}

/**
 * Parse CSV file
 */
function parseCSVFile(file: File): Promise<ParsedExcelData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            const errorMessages = results.errors.map(e => e.message).join(', ');
            reject(new Error(`CSV parsing errors: ${errorMessages}`));
            return;
          }
          
          const data = results.data as (string | number)[][];
          
          if (!data.length) {
            reject(new Error('CSV file appears to be empty'));
            return;
          }
          
          const headers = (data[0] as (string | number)[]).map(h => String(h).trim()).filter(h => h);
          const rows = data.slice(1);
          
          // Filter out completely empty rows
          const filteredRows = rows.filter(row => 
            row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
          );
          
          resolve({
            headers,
            rows: filteredRows,
            fileName: file.name
          });
        } catch (error) {
          reject(new Error(`Failed to process CSV data: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV file: ${error.message}`));
      },
      header: false,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim()
    });
  });
}

/**
 * Parse uploaded file (Excel or CSV)
 */
export async function parseFile(file: File): Promise<ParsedExcelData> {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (extension === '.csv') {
    return parseCSVFile(file);
  } else if (['.xlsx', '.xls'].includes(extension)) {
    return parseExcelFile(file);
  } else {
    throw new Error('Unsupported file format');
  }
}

/**
 * Automatically detect column mappings based on header names
 */
export function detectColumnMappings(headers: string[]): ColumnMapping {
  const mappings: ColumnMapping = {};
  
  for (const header of headers) {
    const cleanHeader = header.trim();
    
    // Find the best match for each field
    for (const [fieldName, variations] of Object.entries(COLUMN_MAPPINGS)) {
      for (const variation of variations) {
        if (cleanHeader.toLowerCase() === variation.toLowerCase()) {
          mappings[cleanHeader] = fieldName;
          break;
        }
      }
      
      // If we found a match, don't look for more matches for this header
      if (mappings[cleanHeader]) {
        break;
      }
    }
    
    // If no exact match found, try partial matching
    if (!mappings[cleanHeader]) {
      for (const [fieldName, variations] of Object.entries(COLUMN_MAPPINGS)) {
        for (const variation of variations) {
          if (cleanHeader.toLowerCase().includes(variation.toLowerCase()) || 
              variation.toLowerCase().includes(cleanHeader.toLowerCase())) {
            mappings[cleanHeader] = fieldName;
            break;
          }
        }
        if (mappings[cleanHeader]) {
          break;
        }
      }
    }
  }
  
  return mappings;
}

/**
 * Parse Excel date values (handles serial numbers and various formats)
 */
function parseExcelDate(dateValue: any): string {
  // If it's already a Date object
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  }
  
  // If it's a string
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    
    // Try parsing common formats
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,        // YYYY-MM-DD
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,  // M/D/YYYY or MM/DD/YYYY
      /^\d{1,2}\/\d{1,2}\/\d{2}$/,  // M/D/YY or MM/DD/YY
      /^\d{1,2}-\d{1,2}-\d{4}$/,    // M-D-YYYY or MM-DD-YYYY
      /^\d{1,2}-\d{1,2}-\d{2}$/,    // M-D-YY or MM-DD-YY
    ];
    
    for (const format of formats) {
      if (format.test(trimmed)) {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }
    }
  }
  
  // If it's a number (Excel serial date)
  if (typeof dateValue === 'number' && dateValue > 0 && dateValue < 100000) {
    // Excel epoch is Jan 1, 1900 (but Excel incorrectly treats 1900 as a leap year)
    const excelEpoch = new Date(1900, 0, 1);
    // Add the days (accounting for Excel's leap year bug)
    const jsDate = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
    
    // Validate the result
    if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
      return jsDate.toISOString().split('T')[0];
    }
  }
  
  // If all else fails, try JavaScript's Date constructor
  const fallback = new Date(dateValue);
  if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1900 && fallback.getFullYear() < 2100) {
    return fallback.toISOString().split('T')[0];
  }
  
  // Return original value if we can't parse it (will be caught by validation)
  return String(dateValue);
}

/**
 * Convert parsed Excel data to expense records using column mappings
 */
export function convertToExpenseData(
  parsedData: ParsedExcelData, 
  columnMappings: ColumnMapping
): any[] {
  const { headers, rows } = parsedData;
  const expenses: any[] = [];
  
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const expense: any = {};
    let hasRequiredFields = false;
    
    // Map each cell in the row to the appropriate field
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      const mappedField = columnMappings[header];
      const cellValue = row[colIndex];
      
      if (mappedField && cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '') {
        let processedValue = String(cellValue).trim();
        
        // Special processing for different field types
        switch (mappedField) {
          case 'date':
            // Handle different date formats including Excel serial numbers
            expense[mappedField] = parseExcelDate(cellValue);
            hasRequiredFields = true;
            break;
          case 'amount':
            // Remove currency symbols and convert to number
            const cleanAmount = processedValue.replace(/[^\d.-]/g, '');
            if (!isNaN(parseFloat(cleanAmount))) {
              expense[mappedField] = cleanAmount;
              hasRequiredFields = true;
            }
            break;
          case 'quantity':
            const cleanQuantity = processedValue.replace(/[^\d.-]/g, '');
            if (!isNaN(parseFloat(cleanQuantity))) {
              expense[mappedField] = cleanQuantity;
            }
            break;
          default:
            expense[mappedField] = processedValue;
            if (mappedField === 'description') {
              hasRequiredFields = true;
            }
        }
      }
    }
    
    // Only include rows that have at least description or amount
    if (hasRequiredFields) {
      expense.rowNumber = rowIndex + 2; // +2 because Excel rows start at 1 and we skip header
      expenses.push(expense);
    }
  }
  
  return expenses;
}

/**
 * Validate expense data against required fields
 */
export function validateExpenseData(expenses: any[]): { validExpenses: any[], errors: string[] } {
  const validExpenses: any[] = [];
  const errors: string[] = [];
  
  expenses.forEach((expense, index) => {
    const rowErrors: string[] = [];
    const rowNumber = expense.rowNumber || index + 1;
    
    // Required fields validation
    if (!expense.description || String(expense.description).trim() === '') {
      rowErrors.push(`Row ${rowNumber}: Description is required`);
    }
    
    if (!expense.amount || isNaN(parseFloat(String(expense.amount)))) {
      rowErrors.push(`Row ${rowNumber}: Valid amount is required`);
    }
    
    if (!expense.date || String(expense.date).trim() === '') {
      rowErrors.push(`Row ${rowNumber}: Date is required`);
    } else {
      // Validate date format
      const dateStr = String(expense.date);
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        rowErrors.push(`Row ${rowNumber}: Invalid date format (${dateStr})`);
      }
    }
    
    if (rowErrors.length === 0) {
      validExpenses.push(expense);
    } else {
      errors.push(...rowErrors);
    }
  });
  
  return { validExpenses, errors };
}