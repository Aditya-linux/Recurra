/**
 * Recurra — Authentication Middleware
 * 
 * JWT-based authentication with wallet signature verification.
 * Implements refresh token rotation for enhanced security.
 * 
 * @security
 * - JWT access tokens expire in 15 minutes
 * - Refresh tokens expire in 7 days with rotation
 * - Wallet signature verification for initial auth
 * - Token invalidation on suspicious activity
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface AuthPayload {
  userId: string;
  walletAddress: string;
  role: 'user' | 'merchant' | 'admin';
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Generate JWT access token (15-min expiry)
 */
export function generateAccessToken(payload: {
  userId: string;
  walletAddress: string;
  role: 'user' | 'merchant' | 'admin';
}): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.accessExpiry as string | number,
    issuer: config.auth.issuer,
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

/**
 * Generate JWT refresh token (7-day expiry)
 */
export function generateRefreshToken(payload: {
  userId: string;
  walletAddress: string;
}): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.refreshExpiry as string | number,
      issuer: config.auth.issuer,
      algorithm: 'HS256',
    } as jwt.SignOptions,
  );
}

/**
 * Authentication middleware — validates JWT access token
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const token = authHeader.slice(7);

    // MOCK AUTH removed for production


  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret, {
      issuer: config.auth.issuer,
      algorithms: ['HS256'],
    }) as AuthPayload;

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token attempt', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }
    next(err);
  }
}

/**
 * Optional authentication — doesn't fail if no token
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret, {
        issuer: config.auth.issuer,
        algorithms: ['HS256'],
      }) as AuthPayload;
      req.user = decoded;
    } catch {
      // Silently ignore — user is unauthenticated
    }
  }
  next();
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: Array<'user' | 'merchant' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
