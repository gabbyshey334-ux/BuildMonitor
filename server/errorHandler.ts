import { Response } from 'express';
import { z } from 'zod';

interface ErrorResponse {
  message: string;
  details?: string;
  code?: string;
}

// Map common database errors to user-friendly messages
const DATABASE_ERROR_MESSAGES: Record<string, string> = {
  '23505': 'This record already exists. Please check your input.',
  '23502': 'Required information is missing. Please fill in all required fields.',
  '23503': 'Cannot delete this item because it is being used elsewhere.',
  '22001': 'The text you entered is too long. Please shorten it.',
  '23514': 'The data you entered is not valid. Please check your input.',
  'ECONNREFUSED': 'Database connection failed. Please try again later.',
  'ENOTFOUND': 'Database server is not available. Please try again later.',
};

// Map HTTP status codes to user-friendly messages
const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid information provided',
  401: 'You need to log in to access this feature',
  403: 'You do not have permission to perform this action',
  404: 'The requested item was not found',
  409: 'This action conflicts with existing data',
  422: 'The information provided is not valid',
  429: 'Too many requests. Please wait a moment and try again',
  500: 'Something went wrong on our end. Please try again later',
  502: 'Service is temporarily unavailable. Please try again later',
  503: 'Service is temporarily unavailable. Please try again later',
};

export function handleError(error: any, res: Response, context: string = 'operation') {
  console.error(`Error in ${context}:`, error);

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
    
    return res.status(400).json({
      message: 'Please check the information you entered',
      details: 'Some fields have invalid values',
      errors: validationErrors
    });
  }

  // Handle database constraint errors
  if (error.code && DATABASE_ERROR_MESSAGES[error.code]) {
    return res.status(400).json({
      message: DATABASE_ERROR_MESSAGES[error.code],
      code: error.code
    });
  }

  // Handle specific known errors
  if (error.message) {
    // Check for common error patterns
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        message: 'This item already exists. Please try a different name or value.',
        details: error.message
      });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        message: 'The requested item could not be found. It may have been deleted.',
        details: error.message
      });
    }
    
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action.',
        details: error.message
      });
    }
  }

  // Default server error
  return res.status(500).json({
    message: `Failed to complete ${context}. Please try again.`,
    details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
}

export function createSuccessResponse(data: any, message?: string) {
  return {
    success: true,
    data,
    message: message || 'Operation completed successfully'
  };
}

export function createErrorResponse(message: string, details?: string, code?: string): ErrorResponse {
  return {
    message,
    details,
    code
  };
}