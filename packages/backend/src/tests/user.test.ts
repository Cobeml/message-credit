// User management service tests

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { UserService, UpdateUserProfileData, UpdateGDPRConsentData } from '../services/user.js';
import { AuthService, RegisterUserData } from '../services/auth.js';

describe('UserService', () => {
  let prisma: PrismaClient;
  let userService: UserService;
  let authService: AuthService;
  let testUserId: string;

  beforeAll(async () => {
    // Use test database
    const testDatabaseUrl = process.env.DATABASE_URL_TEST || 
                           process.env.DATABASE_URL || 
                           'file:./test.db';
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testDatabaseUrl
        }
      }
    });
    
    await prisma.$connect();
    userService = new UserService(prisma);
    authService = new AuthService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany();
    await prisma.gDPRConsent.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.userAuth.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const userData: RegisterUserData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      gdprConsent: {
        dataProcessingConsent: true,
        aiAnalysisConsent: true,
        marketingConsent: false,
        dataRetentionPeriod: 365
      }
    };
    
    const result = await authService.registerUser(userData);
    testUserId = result.user.id;
  });

  describe('Get User Profile', () => {
    it('should return user profile for own profile', async () => {
      const profile = await userService.getUserProfile(testUserId, testUserId);
      
      expect(profile).toBeDefined();
      expect(profile?.id).toBe(testUserId);
      expect(profile?.email).toBe('test@example.com');
      expect(profile?.firstName).toBe('Test');
      expect(profile?.lastName).toBe('User');
      expect(profile?.gdprConsent).toBeDefined();
    });

    it('should return sanitized profile for other users', async () => {
      // Create another user
      const otherUserData: RegisterUserData = {
        email: 'other@example.com',
        password: 'TestPassword123!',
        firstName: 'Other',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      const otherUser = await authService.registerUser(otherUserData);
      
      // Get test user profile from other user's perspective
      const profile = await userService.getUserProfile(testUserId, otherUser.user.id);
      
      expect(profile).toBeDefined();
      expect(profile?.email).toBe(''); // Should be hidden
      expect(profile?.lastName).toBe('U.'); // Should be abbreviated
      expect(profile?.gdprConsent).toBeUndefined(); // Should be hidden
    });

    it('should return null for non-existent user', async () => {
      const profile = await userService.getUserProfile('non-existent-id', testUserId);
      expect(profile).toBeNull();
    });
  });

  describe('Update User Profile', () => {
    it('should update user profile successfully', async () => {
      const updateData: UpdateUserProfileData = {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'This is my updated bio',
        occupation: 'Software Developer',
        riskTolerance: 'medium'
      };

      const updatedUser = await userService.updateUserProfile(
        testUserId,
        updateData,
        testUserId,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.profile?.bio).toBe('This is my updated bio');
      expect(updatedUser.profile?.occupation).toBe('Software Developer');
      expect(updatedUser.profile?.riskTolerance).toBe('medium');

      // Verify audit log was created
      const auditLogs = await prisma.auditLog.findMany({
        where: { entityId: testUserId, action: 'UPDATE_PROFILE' }
      });
      expect(auditLogs).toHaveLength(1);
    });

    it('should reject updating another user\'s profile', async () => {
      // Create another user
      const otherUserData: RegisterUserData = {
        email: 'other@example.com',
        password: 'TestPassword123!',
        firstName: 'Other',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      const otherUser = await authService.registerUser(otherUserData);

      const updateData: UpdateUserProfileData = {
        firstName: 'Hacked'
      };

      await expect(
        userService.updateUserProfile(
          testUserId,
          updateData,
          otherUser.user.id,
          '127.0.0.1',
          'test-user-agent'
        )
      ).rejects.toThrow('Cannot update another user\'s profile');
    });

    it('should create profile if it doesn\'t exist', async () => {
      const updateData: UpdateUserProfileData = {
        phoneNumber: '+1234567890',
        occupation: 'Teacher'
      };

      const updatedUser = await userService.updateUserProfile(
        testUserId,
        updateData,
        testUserId,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(updatedUser.profile?.phoneNumber).toBe('+1234567890');
      expect(updatedUser.profile?.occupation).toBe('Teacher');
    });
  });

  describe('Update GDPR Consent', () => {
    it('should update GDPR consent successfully', async () => {
      const consentData: UpdateGDPRConsentData = {
        aiAnalysisConsent: false,
        marketingConsent: true,
        dataRetentionPeriod: 730
      };

      const updatedConsent = await userService.updateGDPRConsent(
        testUserId,
        consentData,
        testUserId,
        '127.0.0.1',
        'test-user-agent'
      );

      expect(updatedConsent.aiAnalysisConsent).toBe(false);
      expect(updatedConsent.marketingConsent).toBe(true);
      expect(updatedConsent.dataRetentionPeriod).toBe(730);

      // Verify audit log was created
      const auditLogs = await prisma.auditLog.findMany({
        where: { entityId: updatedConsent.id, action: 'UPDATE_GDPR_CONSENT' }
      });
      expect(auditLogs).toHaveLength(1);
    });

    it('should reject updating another user\'s GDPR consent', async () => {
      // Create another user
      const otherUserData: RegisterUserData = {
        email: 'other@example.com',
        password: 'TestPassword123!',
        firstName: 'Other',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      const otherUser = await authService.registerUser(otherUserData);

      const consentData: UpdateGDPRConsentData = {
        marketingConsent: true
      };

      await expect(
        userService.updateGDPRConsent(
          testUserId,
          consentData,
          otherUser.user.id,
          '127.0.0.1',
          'test-user-agent'
        )
      ).rejects.toThrow('Cannot update another user\'s GDPR consent');
    });
  });

  describe('Delete User Account', () => {
    it('should delete user account successfully', async () => {
      await userService.deleteUserAccount(
        testUserId,
        testUserId,
        '127.0.0.1',
        'test-user-agent'
      );

      // Verify user is deactivated
      const user = await prisma.user.findUnique({
        where: { id: testUserId }
      });
      expect(user?.isActive).toBe(false);
      expect(user?.email).toContain('deleted_');

      // Verify GDPR consent is withdrawn
      const gdprConsent = await prisma.gDPRConsent.findUnique({
        where: { userId: testUserId }
      });
      expect(gdprConsent?.isActive).toBe(false);
      expect(gdprConsent?.withdrawalDate).toBeDefined();

      // Verify audit log was created
      const auditLogs = await prisma.auditLog.findMany({
        where: { entityId: testUserId, action: 'DELETE_ACCOUNT' }
      });
      expect(auditLogs).toHaveLength(1);
    });

    it('should reject deleting another user\'s account', async () => {
      // Create another user
      const otherUserData: RegisterUserData = {
        email: 'other@example.com',
        password: 'TestPassword123!',
        firstName: 'Other',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      const otherUser = await authService.registerUser(otherUserData);

      await expect(
        userService.deleteUserAccount(
          testUserId,
          otherUser.user.id,
          '127.0.0.1',
          'test-user-agent'
        )
      ).rejects.toThrow('Cannot delete another user\'s account');
    });

    it('should reject deletion if user has active loans', async () => {
      // Create a mock active loan
      await prisma.loan.create({
        data: {
          borrowerId: testUserId,
          communityId: 'test-community',
          amount: 1000,
          interestRate: 5.0,
          duration: 30,
          purpose: 'Test loan',
          status: 'active'
        }
      });

      await expect(
        userService.deleteUserAccount(
          testUserId,
          testUserId,
          '127.0.0.1',
          'test-user-agent'
        )
      ).rejects.toThrow('Cannot delete account with active loans');
    });
  });

  describe('Get User Audit Trail', () => {
    beforeEach(async () => {
      // Create some audit log entries
      await prisma.auditLog.createMany({
        data: [
          {
            userId: testUserId,
            action: 'UPDATE_PROFILE',
            entityType: 'user',
            entityId: testUserId,
            oldValues: { firstName: 'Test' },
            newValues: { firstName: 'Updated' }
          },
          {
            userId: testUserId,
            action: 'UPDATE_GDPR_CONSENT',
            entityType: 'gdpr_consent',
            entityId: 'consent-id',
            oldValues: { marketingConsent: false },
            newValues: { marketingConsent: true }
          }
        ]
      });
    });

    it('should return audit trail for own account', async () => {
      const auditTrail = await userService.getUserAuditTrail(testUserId, testUserId);
      
      expect(auditTrail).toHaveLength(2);
      expect(auditTrail[0].action).toBe('UPDATE_GDPR_CONSENT'); // Most recent first
      expect(auditTrail[1].action).toBe('UPDATE_PROFILE');
    });

    it('should reject accessing another user\'s audit trail', async () => {
      // Create another user
      const otherUserData: RegisterUserData = {
        email: 'other@example.com',
        password: 'TestPassword123!',
        firstName: 'Other',
        lastName: 'User',
        gdprConsent: {
          dataProcessingConsent: true,
          aiAnalysisConsent: false,
          marketingConsent: false
        }
      };
      
      const otherUser = await authService.registerUser(otherUserData);

      await expect(
        userService.getUserAuditTrail(testUserId, otherUser.user.id)
      ).rejects.toThrow('Cannot access another user\'s audit trail');
    });
  });
});