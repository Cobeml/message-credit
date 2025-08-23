// Authentication service with JWT and refresh token management

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { User, GDPRConsent, APIError, ErrorCodes } from '../types/index.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export interface RegisterUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gdprConsent: {
    dataProcessingConsent: boolean;
    aiAnalysisConsent: boolean;
    marketingConsent: boolean;
    dataRetentionPeriod?: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  private prisma: PrismaClient;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      logger.warn('JWT secrets not set in environment variables. Using default values (not secure for production)');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access and refresh tokens
   */
  generateTokens(user: AuthUser): AuthTokens {
    const payload = {
      userId: user.id,
      email: user.email,
      isActive: user.isActive
    };

    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'community-lending-platform',
      audience: 'community-lending-users'
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.refreshTokenSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'community-lending-platform',
        audience: 'community-lending-users'
      }
    );

    // Parse expiry time for response
    const expiresIn = this.parseExpiryToSeconds(this.accessTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        issuer: 'community-lending-platform',
        audience: 'community-lending-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify JWT refresh token
   */
  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'community-lending-platform',
        audience: 'community-lending-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Register new user with GDPR consent
   */
  async registerUser(userData: RegisterUserData): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        throw new APIError({
          code: ErrorCodes.CONFLICT,
          message: 'User with this email already exists',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Validate GDPR consent requirements
      if (!userData.gdprConsent.dataProcessingConsent) {
        throw new APIError({
          code: ErrorCodes.GDPR_COMPLIANCE_ERROR,
          message: 'Data processing consent is required for registration',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user, auth, and GDPR consent in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName
          }
        });

        // Create user authentication record
        await tx.userAuth.create({
          data: {
            userId: user.id,
            passwordHash: hashedPassword
          }
        });

        // Create GDPR consent record
        await tx.gDPRConsent.create({
          data: {
            userId: user.id,
            dataProcessingConsent: userData.gdprConsent.dataProcessingConsent,
            aiAnalysisConsent: userData.gdprConsent.aiAnalysisConsent,
            marketingConsent: userData.gdprConsent.marketingConsent,
            dataRetentionPeriod: userData.gdprConsent.dataRetentionPeriod || 365
          }
        });

        return user;
      });

      const authUser: AuthUser = {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        isActive: result.isActive
      };

      const tokens = this.generateTokens(authUser);

      logger.info('User registered successfully', { userId: result.id, email: result.email });

      return { user: authUser, tokens };
    } catch (error) {
      logger.error('User registration failed', { error, email: userData.email });
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  async loginUser(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    try {
      // Find user by email with auth data
      const user = await this.prisma.user.findUnique({
        where: { email: credentials.email },
        include: {
          auth: true,
          gdprConsent: true
        }
      });

      if (!user || !user.isActive || !user.auth) {
        throw new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Invalid credentials or inactive account',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Check for account lockout
      if (user.auth.lockedUntil && user.auth.lockedUntil > new Date()) {
        throw new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Account is temporarily locked due to failed login attempts',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(credentials.password, user.auth.passwordHash);

      if (!isValidPassword) {
        // Increment failed login attempts
        await this.handleFailedLogin(user.id);
        
        throw new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Invalid credentials',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Reset failed login attempts on successful login
      if (user.auth.failedLoginAttempts > 0) {
        await this.prisma.userAuth.update({
          where: { userId: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null
          }
        });
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive
      };

      const tokens = this.generateTokens(authUser);

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return { user: authUser, tokens };
    } catch (error) {
      logger.error('User login failed', { error, email: credentials.email });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || !user.isActive) {
        throw new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User not found or inactive',
          timestamp: new Date(),
          requestId: ''
        });
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive
      };

      return this.generateTokens(authUser);
    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw new APIError({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Invalid refresh token',
        timestamp: new Date(),
        requestId: ''
      });
    }
  }

  /**
   * Get user by ID for authentication middleware
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive
      };
    } catch (error) {
      logger.error('Failed to get user by ID', { error, userId });
      return null;
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900; // 15 minutes default
    }
  }

  /**
   * Handle failed login attempt with account lockout
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    const maxAttempts = 5;
    const lockoutDuration = 15 * 60 * 1000; // 15 minutes

    const userAuth = await this.prisma.userAuth.findUnique({
      where: { userId }
    });

    if (!userAuth) return;

    const newFailedAttempts = userAuth.failedLoginAttempts + 1;
    const shouldLock = newFailedAttempts >= maxAttempts;

    await this.prisma.userAuth.update({
      where: { userId },
      data: {
        failedLoginAttempts: newFailedAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + lockoutDuration) : null
      }
    });

    if (shouldLock) {
      logger.warn('Account locked due to failed login attempts', { userId, attempts: newFailedAttempts });
    }
  }
}