// Unit tests for authentication service (without database)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../services/auth.js';

// Mock PrismaClient for unit testing
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  userAuth: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  gDPRConsent: {
    create: vi.fn()
  },
  $transaction: vi.fn()
} as any;

describe('AuthService Unit Tests', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(hash.startsWith('$2a$')).toBe(true);
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
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
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
      expect(decoded.isActive).toBe(user.isActive);
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

    it('should reject malformed tokens', () => {
      expect(() => {
        authService.verifyAccessToken('not.a.jwt');
      }).toThrow('Invalid or expired access token');

      expect(() => {
        authService.verifyRefreshToken('');
      }).toThrow('Invalid or expired refresh token');
    });
  });

  describe('Token Expiry Parsing', () => {
    it('should parse expiry strings correctly', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      // Test with different expiry formats by creating new service instances
      process.env.JWT_ACCESS_EXPIRY = '30s';
      let testAuthService = new AuthService(mockPrisma);
      let tokens = testAuthService.generateTokens(user);
      expect(tokens.expiresIn).toBe(30);

      process.env.JWT_ACCESS_EXPIRY = '5m';
      testAuthService = new AuthService(mockPrisma);
      tokens = testAuthService.generateTokens(user);
      expect(tokens.expiresIn).toBe(300);

      process.env.JWT_ACCESS_EXPIRY = '1h';
      testAuthService = new AuthService(mockPrisma);
      tokens = testAuthService.generateTokens(user);
      expect(tokens.expiresIn).toBe(3600);

      process.env.JWT_ACCESS_EXPIRY = '1d';
      testAuthService = new AuthService(mockPrisma);
      tokens = testAuthService.generateTokens(user);
      expect(tokens.expiresIn).toBe(86400);

      // Reset to default
      process.env.JWT_ACCESS_EXPIRY = '15m';
    });
  });

  describe('Security Features', () => {
    it('should use secure JWT configuration', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      const tokens = authService.generateTokens(user);
      const decoded = authService.verifyAccessToken(tokens.accessToken);
      
      // Verify JWT includes security claims
      expect(decoded.iss).toBe('community-lending-platform');
      expect(decoded.aud).toBe('community-lending-users');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should include proper JWT claims', () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      const tokens = authService.generateTokens(user);
      const accessDecoded = authService.verifyAccessToken(tokens.accessToken);
      const refreshDecoded = authService.verifyRefreshToken(tokens.refreshToken);
      
      // Access token should have full user info
      expect(accessDecoded.userId).toBe(user.id);
      expect(accessDecoded.email).toBe(user.email);
      expect(accessDecoded.isActive).toBe(user.isActive);
      
      // Refresh token should have minimal info
      expect(refreshDecoded.userId).toBe(user.id);
      expect(refreshDecoded.email).toBeUndefined();
    });

    it('should use strong password hashing', async () => {
      const password = 'TestPassword123!';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      // Each hash should be different (salt is random)
      expect(hash1).not.toBe(hash2);
      
      // Both should verify correctly
      expect(await authService.verifyPassword(password, hash1)).toBe(true);
      expect(await authService.verifyPassword(password, hash2)).toBe(true);
      
      // Hash should be bcrypt format with appropriate rounds
      expect(hash1.startsWith('$2a$12$')).toBe(true);
      expect(hash2.startsWith('$2a$12$')).toBe(true);
    });
  });
});