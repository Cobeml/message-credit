// Authentication routes

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthController } from '../controllers/auth.js';
import { AuthMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

// Rate limiting configurations
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
      timestamp: new Date()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for general endpoints
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      timestamp: new Date()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export function createAuthRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const authController = new AuthController(prisma);
  const authMiddleware = new AuthMiddleware(prisma);

  // Health check endpoint
  router.get('/health', generalRateLimit, authController.healthCheck);

  // Public authentication endpoints with strict rate limiting
  router.post('/register', authRateLimit, authController.register);
  router.post('/login', authRateLimit, authController.login);
  router.post('/refresh', authRateLimit, authController.refreshToken);

  // Protected endpoints
  router.get('/profile', generalRateLimit, authMiddleware.authenticate, authController.getProfile);
  router.post('/logout', generalRateLimit, authMiddleware.authenticate, authController.logout);

  return router;
}