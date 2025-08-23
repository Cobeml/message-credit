// Express application setup with authentication and user management

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { createAuthRoutes } from './routes/auth.js';
import { createUserRoutes } from './routes/user.js';
import { requestIdMiddleware, securityHeadersMiddleware } from './middleware/auth.js';
import { APIError, ErrorCodes } from './types/index.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export function createApp(prisma: PrismaClient): express.Application {
  const app = express();

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false // Allow embedding for development
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  }));

  // Request parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Custom middleware
  app.use(requestIdMiddleware);
  app.use(securityHeadersMiddleware);

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });
    next();
  });

  // API routes
  app.use('/api/auth', createAuthRoutes(prisma));
  app.use('/api/users', createUserRoutes(prisma));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'community-lending-backend',
        status: 'healthy',
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      },
      timestamp: new Date(),
      requestId: req.requestId
    });
  });

  // API documentation endpoint
  app.get('/api', (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        name: 'Community P2P Lending API',
        version: '1.0.0',
        description: 'Privacy-preserving peer-to-peer lending platform API',
        endpoints: {
          authentication: {
            'POST /api/auth/register': 'Register new user with GDPR consent',
            'POST /api/auth/login': 'User login',
            'POST /api/auth/refresh': 'Refresh access token',
            'GET /api/auth/profile': 'Get current user profile',
            'POST /api/auth/logout': 'User logout',
            'GET /api/auth/health': 'Authentication service health check'
          },
          userManagement: {
            'GET /api/users/profile': 'Get user profile',
            'PUT /api/users/profile': 'Update user profile',
            'PUT /api/users/gdpr-consent': 'Update GDPR consent settings',
            'GET /api/users/export': 'Export user data (GDPR compliance)',
            'GET /api/users/audit-trail': 'Get user audit trail',
            'DELETE /api/users/account': 'Delete user account'
          }
        },
        features: [
          'JWT-based authentication with refresh tokens',
          'GDPR compliance with consent management',
          'User profile management with privacy controls',
          'Audit trail for all user actions',
          'Rate limiting and security headers',
          'Password hashing with bcrypt',
          'Account lockout after failed login attempts'
        ]
      },
      timestamp: new Date(),
      requestId: req.requestId
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    const error = new APIError({
      code: ErrorCodes.NOT_FOUND,
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date(),
      requestId: req.requestId || ''
    });

    logger.warn('Route not found', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      requestId: req.requestId
    });

    res.status(404).json({ success: false, error });
  });

  // Global error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      requestId: req.requestId
    });

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const apiError = new APIError({
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: isDevelopment ? error.message : 'Internal server error',
      details: isDevelopment ? error.stack : undefined,
      timestamp: new Date(),
      requestId: req.requestId || ''
    });

    res.status(500).json({ success: false, error: apiError });
  });

  return app;
}