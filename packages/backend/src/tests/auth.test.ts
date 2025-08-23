// Authentication service tests

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AuthService, RegisterUserData, LoginCredentials } from '../services/auth.js';
import { ErrorCodes } from '../types/index.js';

describe('AuthService', () => {
  let prisma: PrismaClient;
  let authService: AuthService;

  beforeAll(async () => {
    // Use test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
        }
      }
    });
    
    await prisma.$connect();
    authService = new AuthService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.gDPRConsent.deleteMany();
    await prisma.userAuth.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await authService.verifyPassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Token Generation and Verification', () => {
    it('should generate valid JWT tokens', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      const tokens = authService.generateTokens(user);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should verify access token correctly', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      const tokens = authService.generateTokens(user);
      const decoded = authService.verifyAccessToken(tokens.accessToken);
      
      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);
    });

    it('should verify refresh token correctly', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      const tokens = authService.generateTokens(user);
      const decoded = authService.verifyRefreshToken(tokens.refreshToken);
      
      expect(decoded.userId).toBe(user.id);
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        authService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid or expired access token');

      expect(() => {
        authService.verifyRefreshToken('invalid-token');
      }).toThrow('Invalid or expired refresh token');
    });
  });

  describe('User Registration', () => {
    it('should register user successfully with valid data', async () => {
      const userData: RegisterUserData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false,
          dataRetentionPeriod: 365
        }
      };

      const result = await authService.registerUser(userData);
      
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      // Verify user was created in database
      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email },
        include: { auth: true, gdprConsent: true }
      });
      
      expect(dbUser).toBeDefined();
      expect(dbUser?.auth).toBeDefined();
      expect(dbUser?.gdprConsent).toBeDefined();
      expect(dbUser?.gdprConsent?.dataProcessingConsent).toBe(true);
    });

    it('should reject registration without GDPR consent', async () => {
      const userData: RegisterUserData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: false,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };

      await expect(authService.registerUser(userData)).rejects.toThrow();
    });

    it('should reject duplicate email registration', async () => {
      const userData: RegisterUserData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };

      // Register first user
      await authService.registerUser(userData);

      // Try to register with same email
      await expect(authService.registerUser(userData)).rejects.toThrow();
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create test user
      const userData: RegisterUserData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      await authService.registerUser(userData);
    });

    it('should login successfully with valid credentials', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const result = await authService.loginUser(credentials);
      
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(credentials.email);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const credentials: LoginCredentials = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      await expect(authService.loginUser(credentials)).rejects.toThrow();
    });

    it('should reject login with invalid password', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      await expect(authService.loginUser(credentials)).rejects.toThrow();
    });

    it('should handle account lockout after failed attempts', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authService.loginUser(credentials);
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th attempt should be locked
      await expect(authService.loginUser(credentials)).rejects.toThrow();
      
      // Even with correct password, should still be locked
      const correctCredentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };
      
      await expect(authService.loginUser(correctCredentials)).rejects.toThrow();
    });
  });

  describe('Token Refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create test user and get tokens
      const userData: RegisterUserData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      const result = await authService.registerUser(userData);
      refreshToken = result.tokens.refreshToken;
    });

    it('should refresh tokens successfully with valid refresh token', async () => {
      const newTokens = await authService.refreshAccessToken(refreshToken);
      
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.expiresIn).toBeGreaterThan(0);
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow();
    });
  });

  describe('Get User By ID', () => {
    let userId: string;

    beforeEach(async () => {
      // Create test user
      const userData: RegisterUserData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      const result = await authService.registerUser(userData);
      userId = result.user.id;
    });

    it('should return user for valid ID', async () => {
      const user = await authService.getUserById(userId);
      
      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
      expect(user?.email).toBe('test@example.com');
    });

    it('should return null for invalid ID', async () => {
      const user = await authService.getUserById('invalid-id');
      expect(user).toBeNull();
    });

    it('should return null for inactive user', async () => {
      // Deactivate user
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      });

      const user = await authService.getUserById(userId);
      expect(user).toBeNull();
    });
  });
});