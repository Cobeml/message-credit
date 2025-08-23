// User management routes

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserController } from '../controllers/user.js';
import { AuthMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

// Rate limiting configurations
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

const sensitiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit sensitive operations
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many sensitive operations, please try again later',
      timestamp: new Date()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export function createUserRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const userController = new UserController(prisma);
  const authMiddleware = new AuthMiddleware(prisma);

  // All user routes require authentication
  router.use(authMiddleware.authenticate);

  // Profile management routes
  router.get('/profile', generalRateLimit, userController.getProfile);
  router.get('/:userId/profile', generalRateLimit, userController.getProfile);
  router.put('/profile', generalRateLimit, userController.updateProfile);
  router.put('/:userId/profile', generalRateLimit, userController.updateProfile);

  // GDPR compliance routes
  router.put('/gdpr-consent', 
    generalRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.updateGDPRConsent
  );
  
  router.put('/:userId/gdpr-consent', 
    generalRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.updateGDPRConsent
  );

  // Data export (GDPR right to data portability)
  router.get('/export', 
    sensitiveRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.exportUserData
  );
  
  router.get('/:userId/export', 
    sensitiveRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.exportUserData
  );

  // Audit trail access
  router.get('/audit-trail', 
    generalRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.getAuditTrail
  );
  
  router.get('/:userId/audit-trail', 
    generalRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.getAuditTrail
  );

  // Account deletion (GDPR right to erasure)
  router.delete('/account', 
    sensitiveRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.deleteAccount
  );
  
  router.delete('/:userId/account', 
    sensitiveRateLimit, 
    authMiddleware.requireGDPRConsent(['dataProcessing']), 
    userController.deleteAccount
  );

  return router;
}