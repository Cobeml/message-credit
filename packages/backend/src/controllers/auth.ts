// Authentication controllers for user registration, login, and token management

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService, RegisterUserData, LoginCredentials } from '../services/auth.js';
import { APIResponse, APIError, ErrorCodes } from '../types/index.js';
import { z } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  gdprConsent: z.object({
    dataProcessingConsent: z.boolean(),
    aiAnalysisConsent: z.boolean(),
    marketingConsent: z.boolean(),
    dataRetentionPeriod: z.number().min(30).max(2555).optional() // 30 days to 7 years
  })
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

export class AuthController {
  private authService: AuthService;

  constructor(prisma: PrismaClient) {
    this.authService = new AuthService(prisma);
  }

  /**
   * Register new user
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validationResult = registerSchema.safeParse(req.body);
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

      const userData: RegisterUserData = validationResult.data;

      // Register user
      const result = await this.authService.registerUser(userData);

      const response: APIResponse = {
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens
        },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      logger.info('User registered successfully', { 
        userId: result.user.id, 
        email: result.user.email,
        requestId: req.requestId 
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Registration failed', { error, requestId: req.requestId });

      if (error instanceof APIError) {
        res.status(error.code === ErrorCodes.CONFLICT ? 409 : 400).json({ 
          success: false, 
          error 
        });
      } else {
        const apiError = new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Registration failed',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(500).json({ success: false, error: apiError });
      }
    }
  };

  /**
   * User login
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validationResult = loginSchema.safeParse(req.body);
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

      const credentials: LoginCredentials = validationResult.data;

      // Authenticate user
      const result = await this.authService.loginUser(credentials);

      const response: APIResponse = {
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens
        },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      logger.info('User logged in successfully', { 
        userId: result.user.id, 
        email: result.user.email,
        requestId: req.requestId 
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Login failed', { error, requestId: req.requestId });

      if (error instanceof APIError) {
        res.status(401).json({ success: false, error });
      } else {
        const apiError = new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Login failed',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(500).json({ success: false, error: apiError });
      }
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const validationResult = refreshTokenSchema.safeParse(req.body);
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

      const { refreshToken } = validationResult.data;

      // Refresh tokens
      const tokens = await this.authService.refreshAccessToken(refreshToken);

      const response: APIResponse = {
        success: true,
        data: { tokens },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      logger.info('Token refreshed successfully', { requestId: req.requestId });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Token refresh failed', { error, requestId: req.requestId });

      if (error instanceof APIError) {
        res.status(401).json({ success: false, error });
      } else {
        const apiError = new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Token refresh failed',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(500).json({ success: false, error: apiError });
      }
    }
  };

  /**
   * Get current user profile
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
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

      const response: APIResponse = {
        success: true,
        data: { user: req.user },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Get profile failed', { error, requestId: req.requestId });

      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to get profile',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });
      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * Logout user (client-side token invalidation)
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // In a JWT-based system, logout is typically handled client-side
      // by removing the tokens from storage. However, we can log the event.
      
      if (req.user) {
        logger.info('User logged out', { 
          userId: req.user.id, 
          email: req.user.email,
          requestId: req.requestId 
        });
      }

      const response: APIResponse = {
        success: true,
        data: { message: 'Logged out successfully' },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Logout failed', { error, requestId: req.requestId });

      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Logout failed',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });
      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * Health check endpoint for authentication service
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const response: APIResponse = {
        success: true,
        data: {
          service: 'authentication',
          status: 'healthy',
          timestamp: new Date()
        },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Auth health check failed', { error, requestId: req.requestId });

      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Health check failed',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });
      res.status(500).json({ success: false, error: apiError });
    }
  };
}