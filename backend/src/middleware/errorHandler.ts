/**
 * Recurra — Global Error Handler
 * 
 * Centralized error handling middleware.
 * Ensures no stack traces leak in production.
 * 
 * @security Error details are logged but never exposed to clients in production.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Custom application error with status code and error code
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factories
export const errors = {
  notFound: (resource: string) =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  unauthorized: (message = 'Unauthorized') =>
    new AppError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message = 'Forbidden') =>
    new AppError(message, 403, 'FORBIDDEN'),
  badRequest: (message: string) =>
    new AppError(message, 400, 'BAD_REQUEST'),
  conflict: (message: string) =>
    new AppError(message, 409, 'CONFLICT'),
  tooManyRequests: (message = 'Too many requests') =>
    new AppError(message, 429, 'RATE_LIMITED'),
  internal: (message = 'Internal server error') =>
    new AppError(message, 500, 'INTERNAL_ERROR', false),
};

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors,
    });
    return;
  }

  // Handle known application errors
  if (err instanceof AppError) {
    // Log operational errors as warnings, programming errors as errors
    if (err.isOperational) {
      logger.warn(err.message, {
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.error(err.message, {
        code: err.code,
        statusCode: err.statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
    }

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      // Never include stack traces in production
      ...(config.app.isProduction ? {} : { stack: err.stack }),
    });
    return;
  }

  // Handle unknown errors — NEVER leak details in production
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    error: config.app.isProduction
      ? 'An unexpected error occurred'
      : err.message,
    code: 'INTERNAL_ERROR',
    ...(config.app.isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
}
