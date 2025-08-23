// Authentication and authorization middleware

import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.js';
import type { AuthUser } from '../services/auth.js';
import { PrismaClient } from '@prisma/client';
import { APIError, ErrorCodes } from '../types/index.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor(prisma: PrismaClient) {
    this.authService = new AuthService(prisma);
  }

  /**
   * Middleware to authenticate JWT token
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Authorization header missing or invalid',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(401).json({ success: false, error });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify token
      const decoded = this.authService.verifyAccessToken(token);
      
      // Get user from database
      const user = await this.authService.getUserById(decoded.userId);
      
      if (!user) {
        const error = new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User not found or inactive',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(401).json({ success: false, error });
        return;
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      logger.error('Authentication failed', { error, requestId: req.requestId });
      
      const apiError = new APIError({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid or expired token',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });
      
      res.status(401).json({ success: false, error: apiError });
    }
  };

  /**
   * Middleware to check if user is authenticated (optional authentication)
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without authentication
        next();
        return;
      }

      const token = authHeader.substring(7);
      
      try {
        const decoded = this.authService.verifyAccessToken(token);
        const user = await this.authService.getUserById(decoded.userId);
        
        if (user) {
          req.user = user;
        }
      } catch (error) {
        // Invalid token, but continue without authentication
        logger.debug('Optional auth failed, continuing without user', { error });
      }
      
      next();
    } catch (error) {
      // On any error, continue without authentication
      next();
    }
  };

  /**
   * Middleware to authorize specific roles or permissions
   */
  authorize = (requiredRoles: string[] = []) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          const error = new APIError({
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Authentication required',
            timestamp: new Date(),
            requestId: req.requestId || ''
          });
          res.status(401).json({ success: false, error });
          return;
        }

        // For now, we'll implement basic authorization
        // In the future, this can be extended with role-based access control
        if (requiredRoles.length > 0) {
          // TODO: Implement role checking when user roles are added to the system
          // For now, all authenticated users are authorized
          logger.debug('Role-based authorization not yet implemented', { 
            userId: req.user.id, 
            requiredRoles 
          });
        }

        next();
      } catch (error) {
        logger.error('Authorization failed', { error, userId: req.user?.id });
        
        const apiError = new APIError({
          code: ErrorCodes.FORBIDDEN,
          message: 'Insufficient permissions',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        
        res.status(403).json({ success: false, error: apiError });
      }
    };
  };

  /**
   * Middleware to check GDPR consent for data processing
   */
  requireGDPRConsent = (consentTypes: ('dataProcessing' | 'aiAnalysis' | 'marketing')[] = ['dataProcessing']) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          const error = new APIError({
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Authentication required',
            timestamp: new Date(),
            requestId: req.requestId || ''
          });
          res.status(401).json({ success: false, error });
          return;
        }

        // Check GDPR consent
        const prisma = new PrismaClient();
        const gdprConsent = await prisma.gDPRConsent.findUnique({
          where: { userId: req.user.id }
        });

        if (!gdprConsent || !gdprConsent.isActive) {
          const error = new APIError({
            code: ErrorCodes.GDPR_COMPLIANCE_ERROR,
            message: 'GDPR consent required',
            timestamp: new Date(),
            requestId: req.requestId || ''
          });
          res.status(403).json({ success: false, error });
          return;
        }

        // Check specific consent types
        for (const consentType of consentTypes) {
          let hasConsent = false;
          
          switch (consentType) {
            case 'dataProcessing':
              hasConsent = gdprConsent.dataProcessingConsent;
              break;
            case 'aiAnalysis':
              hasConsent = gdprConsent.aiAnalysisConsent;
              break;
            case 'marketing':
              hasConsent = gdprConsent.marketingConsent;
              break;
          }

          if (!hasConsent) {
            const error = new APIError({
              code: ErrorCodes.GDPR_COMPLIANCE_ERROR,
              message: `${consentType} consent required for this operation`,
              timestamp: new Date(),
              requestId: req.requestId || ''
            });
            res.status(403).json({ success: false, error });
            return;
          }
        }

        next();
      } catch (error) {
        logger.error('GDPR consent check failed', { error, userId: req.user?.id });
        
        const apiError = new APIError({
          code: ErrorCodes.GDPR_COMPLIANCE_ERROR,
          message: 'GDPR consent verification failed',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        
        res.status(500).json({ success: false, error: apiError });
      }
    };
  };
}

/**
 * Request ID middleware for tracking requests
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = req.headers['x-request-id'] as string || 
                  `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Security headers middleware
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  next();
};