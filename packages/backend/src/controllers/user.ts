// User management controllers for profile management and GDPR compliance

import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserService } from '../services/user.js';
import type { UpdateUserProfileData, UpdateGDPRConsentData } from '../services/user.js';
import type { APIResponse } from '../types/index.js';
import { APIError, ErrorCodes } from '../types/index.js';
import { z } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  dateOfBirth: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional()
  }).optional(),
  languages: z.array(z.string()).optional(),
  digitalLiteracyLevel: z.number().min(1).max(5).optional(),
  phoneNumber: z.string().optional(),
  occupation: z.string().optional(),
  monthlyIncome: z.number().positive().optional(),
  employmentStatus: z.string().optional(),
  bio: z.string().max(500).optional(),
  preferredLoanTypes: z.array(z.string()).optional(),
  maxLoanAmount: z.number().positive().optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional()
});

const updateGDPRConsentSchema = z.object({
  dataProcessingConsent: z.boolean().optional(),
  aiAnalysisConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  dataRetentionPeriod: z.number().min(30).max(2555).optional()
});

export class UserController {
  private userService: UserService;

  constructor(prisma: PrismaClient) {
    this.userService = new UserService(prisma);
  }

  /**
   * Get user profile
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId || req.user?.id;
      
      if (!userId) {
        const error = new APIError({
          code: ErrorCodes.INVALID_INPUT,
          message: 'User ID is required',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(400).json({ success: false, error });
        return;
      }

      const userProfile = await this.userService.getUserProfile(userId, req.user?.id);

      if (!userProfile) {
        const error = new APIError({
          code: ErrorCodes.NOT_FOUND,
          message: 'User not found',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(404).json({ success: false, error });
        return;
      }

      const response: APIResponse = {
        success: true,
        data: { user: userProfile },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get profile failed', { error, requestId: req.requestId });

      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to get user profile',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });
      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
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

      // Validate request body
      const validationResult = updateProfileSchema.safeParse(req.body);
      if (!validationResult.success) {
        const error = new APIError({
          code: ErrorCodes.INVALID_INPUT,
          message: 'Validation failed',
          details: validationResult.error.errors,
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(400).json({ success: false, error });
        return;
      }

      const updateData: UpdateUserProfileData = validationResult.data;
      const userId = req.params.userId || req.user.id;

      // Get client IP and user agent for audit trail
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const updatedUser = await this.userService.updateUserProfile(
        userId,
        updateData,
        req.user.id,
        ipAddress,
        userAgent
      );

      const response: APIResponse = {
        success: true,
        data: { user: updatedUser },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      logger.info('User profile updated', { 
        userId, 
        updatedBy: req.user.id,
        requestId: req.requestId 
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Update profile failed', { error, requestId: req.requestId });

      if (error instanceof APIError) {
        const statusCode = error.code === ErrorCodes.FORBIDDEN ? 403 : 
                          error.code === ErrorCodes.NOT_FOUND ? 404 : 400;
        res.status(statusCode).json({ success: false, error });
      } else {
        const apiError = new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Failed to update user profile',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(500).json({ success: false, error: apiError });
      }
    }
  };

  /**
   * Update GDPR consent settings
   */
  updateGDPRConsent = async (req: Request, res: Response): Promise<void> => {
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

      // Validate request body
      const validationResult = updateGDPRConsentSchema.safeParse(req.body);
      if (!validationResult.success) {
        const error = new APIError({
          code: ErrorCodes.INVALID_INPUT,
          message: 'Validation failed',
          details: validationResult.error.errors,
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(400).json({ success: false, error });
        return;
      }

      const consentData: UpdateGDPRConsentData = validationResult.data;
      const userId = req.params.userId || req.user.id;

      // Get client IP and user agent for audit trail
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const updatedConsent = await this.userService.updateGDPRConsent(
        userId,
        consentData,
        req.user.id,
        ipAddress,
        userAgent
      );

      const response: APIResponse = {
        success: true,
        data: { gdprConsent: updatedConsent },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      logger.info('GDPR consent updated', { 
        userId, 
        updatedBy: req.user.id,
        requestId: req.requestId 
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Update GDPR consent failed', { error, requestId: req.requestId });

      if (error instanceof APIError) {
        const statusCode = error.code === ErrorCodes.FORBIDDEN ? 403 : 
                          error.code === ErrorCodes.NOT_FOUND ? 404 : 400;
        res.status(statusCode).json({ success: false, error });
      } else {
        const apiError = new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Failed to update GDPR consent',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(500).json({ success: false, error: apiError });
      }
    }
  };

  /**
   * Delete user account
   */
  deleteAccount = async (req: Request, res: Response): Promise<void> => {
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

      const userId = req.params.userId || req.user.id;

      // Get client IP and user agent for audit trail
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      await this.userService.deleteUserAccount(
        userId,
        req.user.id,
        ipAddress,
        userAgent
      );

      const response: APIResponse = {
        success: true,
        data: { message: 'Account deleted successfully' },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      logger.info('User account deleted', { 
        userId, 
        deletedBy: req.user.id,
        requestId: req.requestId 
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Delete account failed', { error, requestId: req.requestId });

      if (error instanceof APIError) {
        const statusCode = error.code === ErrorCodes.FORBIDDEN ? 403 : 
                          error.code === ErrorCodes.NOT_FOUND ? 404 :
                          error.code === ErrorCodes.CONFLICT ? 409 : 400;
        res.status(statusCode).json({ success: false, error });
      } else {
        const apiError = new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Failed to delete account',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(500).json({ success: false, error: apiError });
      }
    }
  };

  /**
   * Get user audit trail
   */
  getAuditTrail = async (req: Request, res: Response): Promise<void> => {
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

      const userId = req.params.userId || req.user.id;

      const auditTrail = await this.userService.getUserAuditTrail(userId, req.user.id);

      const response: APIResponse = {
        success: true,
        data: { auditTrail },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get audit trail failed', { error, requestId: req.requestId });

      if (error instanceof APIError) {
        const statusCode = error.code === ErrorCodes.FORBIDDEN ? 403 : 
                          error.code === ErrorCodes.NOT_FOUND ? 404 : 400;
        res.status(statusCode).json({ success: false, error });
      } else {
        const apiError = new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Failed to get audit trail',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(500).json({ success: false, error: apiError });
      }
    }
  };

  /**
   * Export user data (GDPR compliance)
   */
  exportUserData = async (req: Request, res: Response): Promise<void> => {
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

      const userId = req.params.userId || req.user.id;

      // Verify user can export this data
      if (userId !== req.user.id) {
        const error = new APIError({
          code: ErrorCodes.FORBIDDEN,
          message: 'Cannot export another user\'s data',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(403).json({ success: false, error });
        return;
      }

      // Get comprehensive user data
      const userProfile = await this.userService.getUserProfile(userId, req.user.id);
      const auditTrail = await this.userService.getUserAuditTrail(userId, req.user.id);

      const exportData = {
        user: userProfile,
        auditTrail,
        exportDate: new Date(),
        exportedBy: req.user.id
      };

      const response: APIResponse = {
        success: true,
        data: exportData,
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      logger.info('User data exported', { 
        userId, 
        exportedBy: req.user.id,
        requestId: req.requestId 
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Export user data failed', { error, requestId: req.requestId });

      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to export user data',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });
      res.status(500).json({ success: false, error: apiError });
    }
  };
}