// User management service with privacy controls

import { PrismaClient } from '@prisma/client';
import { User, UserProfile, GDPRConsent, APIError, ErrorCodes, AuditLog } from '../types/index.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

export interface UpdateUserProfileData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  languages?: string[];
  digitalLiteracyLevel?: number;
  phoneNumber?: string;
  occupation?: string;
  monthlyIncome?: number;
  employmentStatus?: string;
  bio?: string;
  preferredLoanTypes?: string[];
  maxLoanAmount?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
}

export interface UpdateGDPRConsentData {
  dataProcessingConsent?: boolean;
  aiAnalysisConsent?: boolean;
  marketingConsent?: boolean;
  dataRetentionPeriod?: number;
}

export interface UserWithProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  location?: any;
  languages: string[];
  digitalLiteracyLevel: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile?: UserProfile;
  gdprConsent?: GDPRConsent;
}

export class UserService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get user profile with privacy controls
   */
  async getUserProfile(userId: string, requestingUserId?: string): Promise<UserWithProfile | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          gdprConsent: true
        }
      });

      if (!user || !user.isActive) {
        return null;
      }

      // Apply privacy controls based on who is requesting
      const isOwnProfile = userId === requestingUserId;
      
      if (!isOwnProfile) {
        // Remove sensitive information for other users
        return this.sanitizeUserProfile(user);
      }

      return this.mapUserWithProfile(user);
    } catch (error) {
      logger.error('Failed to get user profile', { error, userId });
      throw new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve user profile',
        timestamp: new Date(),
        requestId: ''
      });
    }
  }

  /**
   * Update user profile with audit logging
   */
  async updateUserProfile(
    userId: string, 
    updateData: UpdateUserProfileData,
    requestingUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserWithProfile> {
    try {
      // Verify user can update this profile
      if (userId !== requestingUserId) {
        throw new APIError({
          code: ErrorCodes.FORBIDDEN,
          message: 'Cannot update another user\'s profile',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Get current user data for audit trail
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true }
      });

      if (!currentUser) {
        throw new APIError({
          code: ErrorCodes.NOT_FOUND,
          message: 'User not found',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Prepare update data
      const userUpdateData: any = {};
      const profileUpdateData: any = {};

      // Separate user table updates from profile table updates
      if (updateData.firstName !== undefined) userUpdateData.firstName = updateData.firstName;
      if (updateData.lastName !== undefined) userUpdateData.lastName = updateData.lastName;
      if (updateData.dateOfBirth !== undefined) userUpdateData.dateOfBirth = updateData.dateOfBirth;
      if (updateData.location !== undefined) userUpdateData.location = updateData.location;
      if (updateData.languages !== undefined) userUpdateData.languages = updateData.languages;
      if (updateData.digitalLiteracyLevel !== undefined) userUpdateData.digitalLiteracyLevel = updateData.digitalLiteracyLevel;

      // Profile-specific updates
      if (updateData.phoneNumber !== undefined) profileUpdateData.phoneNumber = updateData.phoneNumber;
      if (updateData.occupation !== undefined) profileUpdateData.occupation = updateData.occupation;
      if (updateData.monthlyIncome !== undefined) profileUpdateData.monthlyIncome = updateData.monthlyIncome;
      if (updateData.employmentStatus !== undefined) profileUpdateData.employmentStatus = updateData.employmentStatus;
      if (updateData.bio !== undefined) profileUpdateData.bio = updateData.bio;
      if (updateData.preferredLoanTypes !== undefined) profileUpdateData.preferredLoanTypes = updateData.preferredLoanTypes;
      if (updateData.maxLoanAmount !== undefined) profileUpdateData.maxLoanAmount = updateData.maxLoanAmount;
      if (updateData.riskTolerance !== undefined) profileUpdateData.riskTolerance = updateData.riskTolerance;

      // Update in transaction with audit logging
      const updatedUser = await this.prisma.$transaction(async (tx) => {
        // Update user table if needed
        let user = currentUser;
        if (Object.keys(userUpdateData).length > 0) {
          user = await tx.user.update({
            where: { id: userId },
            data: userUpdateData,
            include: { profile: true }
          });
        }

        // Update or create profile if needed
        if (Object.keys(profileUpdateData).length > 0) {
          if (currentUser.profile) {
            await tx.userProfile.update({
              where: { userId },
              data: profileUpdateData
            });
          } else {
            await tx.userProfile.create({
              data: {
                userId,
                ...profileUpdateData
              }
            });
          }
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: requestingUserId,
            action: 'UPDATE_PROFILE',
            entityType: 'user',
            entityId: userId,
            oldValues: {
              user: currentUser,
              profile: currentUser.profile
            },
            newValues: {
              userUpdates: userUpdateData,
              profileUpdates: profileUpdateData
            },
            ipAddress,
            userAgent
          }
        });

        // Return updated user with profile
        return await tx.user.findUnique({
          where: { id: userId },
          include: {
            profile: true,
            gdprConsent: true
          }
        });
      });

      if (!updatedUser) {
        throw new APIError({
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Failed to update user profile',
          timestamp: new Date(),
          requestId: ''
        });
      }

      logger.info('User profile updated successfully', { userId, updatedFields: Object.keys(updateData) });

      return this.mapUserWithProfile(updatedUser);
    } catch (error) {
      logger.error('Failed to update user profile', { error, userId });
      throw error;
    }
  }

  /**
   * Update GDPR consent settings
   */
  async updateGDPRConsent(
    userId: string,
    consentData: UpdateGDPRConsentData,
    requestingUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<GDPRConsent> {
    try {
      // Verify user can update this consent
      if (userId !== requestingUserId) {
        throw new APIError({
          code: ErrorCodes.FORBIDDEN,
          message: 'Cannot update another user\'s GDPR consent',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Get current consent for audit trail
      const currentConsent = await this.prisma.gDPRConsent.findUnique({
        where: { userId }
      });

      if (!currentConsent) {
        throw new APIError({
          code: ErrorCodes.NOT_FOUND,
          message: 'GDPR consent record not found',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Update consent in transaction with audit logging
      const updatedConsent = await this.prisma.$transaction(async (tx) => {
        const consent = await tx.gDPRConsent.update({
          where: { userId },
          data: {
            ...consentData,
            lastUpdated: new Date()
          }
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: requestingUserId,
            action: 'UPDATE_GDPR_CONSENT',
            entityType: 'gdpr_consent',
            entityId: consent.id,
            oldValues: currentConsent,
            newValues: consentData,
            ipAddress,
            userAgent
          }
        });

        return consent;
      });

      logger.info('GDPR consent updated successfully', { userId, updatedFields: Object.keys(consentData) });

      return this.mapGDPRConsent(updatedConsent);
    } catch (error) {
      logger.error('Failed to update GDPR consent', { error, userId });
      throw error;
    }
  }

  /**
   * Delete user account with GDPR compliance
   */
  async deleteUserAccount(
    userId: string,
    requestingUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Verify user can delete this account
      if (userId !== requestingUserId) {
        throw new APIError({
          code: ErrorCodes.FORBIDDEN,
          message: 'Cannot delete another user\'s account',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Check for active loans
      const activeLoans = await this.prisma.loan.findMany({
        where: {
          OR: [
            { borrowerId: userId, status: { in: ['pending', 'funded', 'active'] } },
            { lenderId: userId, status: { in: ['pending', 'funded', 'active'] } }
          ]
        }
      });

      if (activeLoans.length > 0) {
        throw new APIError({
          code: ErrorCodes.CONFLICT,
          message: 'Cannot delete account with active loans',
          timestamp: new Date(),
          requestId: ''
        });
      }

      // Get user data for audit trail
      const userData = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          gdprConsent: true
        }
      });

      // Delete user account in transaction
      await this.prisma.$transaction(async (tx) => {
        // Create audit log before deletion
        await tx.auditLog.create({
          data: {
            userId: requestingUserId,
            action: 'DELETE_ACCOUNT',
            entityType: 'user',
            entityId: userId,
            oldValues: userData,
            newValues: null,
            ipAddress,
            userAgent
          }
        });

        // Soft delete by deactivating account
        await tx.user.update({
          where: { id: userId },
          data: {
            isActive: false,
            email: `deleted_${userId}@deleted.local`,
            firstName: 'DELETED',
            lastName: 'USER'
          }
        });

        // Update GDPR consent to mark as withdrawn
        await tx.gDPRConsent.update({
          where: { userId },
          data: {
            isActive: false,
            withdrawalDate: new Date()
          }
        });
      });

      logger.info('User account deleted successfully', { userId });
    } catch (error) {
      logger.error('Failed to delete user account', { error, userId });
      throw error;
    }
  }

  /**
   * Get user's audit trail
   */
  async getUserAuditTrail(userId: string, requestingUserId: string): Promise<AuditLog[]> {
    try {
      // Verify user can access this audit trail
      if (userId !== requestingUserId) {
        throw new APIError({
          code: ErrorCodes.FORBIDDEN,
          message: 'Cannot access another user\'s audit trail',
          timestamp: new Date(),
          requestId: ''
        });
      }

      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          OR: [
            { userId },
            { entityId: userId, entityType: 'user' }
          ]
        },
        orderBy: { timestamp: 'desc' },
        take: 100 // Limit to last 100 entries
      });

      return auditLogs.map(this.mapAuditLog);
    } catch (error) {
      logger.error('Failed to get user audit trail', { error, userId });
      throw error;
    }
  }

  /**
   * Sanitize user profile for public viewing
   */
  private sanitizeUserProfile(user: any): UserWithProfile {
    return {
      id: user.id,
      email: '', // Hide email from other users
      firstName: user.firstName,
      lastName: user.lastName.charAt(0) + '.', // Show only first letter of last name
      dateOfBirth: undefined, // Hide date of birth
      location: user.location ? {
        country: user.location.country,
        region: user.location.region
        // Hide city for privacy
      } : undefined,
      languages: user.languages,
      digitalLiteracyLevel: user.digitalLiteracyLevel,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile ? {
        ...user.profile,
        phoneNumber: undefined, // Hide phone number
        monthlyIncome: undefined, // Hide income
        employmentStatus: user.profile.employmentStatus,
        bio: user.profile.bio,
        // Hide other sensitive fields
        occupation: undefined,
        maxLoanAmount: undefined
      } : undefined,
      gdprConsent: undefined // Never show GDPR consent to other users
    };
  }

  /**
   * Map database user to UserWithProfile interface
   */
  private mapUserWithProfile(user: any): UserWithProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      location: user.location,
      languages: user.languages,
      digitalLiteracyLevel: user.digitalLiteracyLevel,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile ? this.mapUserProfile(user.profile) : undefined,
      gdprConsent: user.gdprConsent ? this.mapGDPRConsent(user.gdprConsent) : undefined
    };
  }

  /**
   * Map database UserProfile to interface
   */
  private mapUserProfile(profile: any): UserProfile {
    return {
      firstName: '', // This comes from User table
      lastName: '', // This comes from User table
      dateOfBirth: undefined, // This comes from User table
      location: undefined, // This comes from User table
      languages: [], // This comes from User table
      digitalLiteracyLevel: 0, // This comes from User table
      phoneNumber: profile.phoneNumber,
      occupation: profile.occupation,
      monthlyIncome: profile.monthlyIncome ? parseFloat(profile.monthlyIncome.toString()) : undefined,
      employmentStatus: profile.employmentStatus,
      bankAccountVerified: profile.bankAccountVerified,
      identityVerified: profile.identityVerified,
      profilePictureUrl: profile.profilePictureUrl,
      bio: profile.bio,
      preferredLoanTypes: profile.preferredLoanTypes,
      maxLoanAmount: profile.maxLoanAmount ? parseFloat(profile.maxLoanAmount.toString()) : undefined,
      riskTolerance: profile.riskTolerance as 'low' | 'medium' | 'high'
    };
  }

  /**
   * Map database GDPRConsent to interface
   */
  private mapGDPRConsent(consent: any): GDPRConsent {
    return {
      id: consent.id,
      userId: consent.userId,
      dataProcessingConsent: consent.dataProcessingConsent,
      aiAnalysisConsent: consent.aiAnalysisConsent,
      marketingConsent: consent.marketingConsent,
      dataRetentionPeriod: consent.dataRetentionPeriod,
      consentDate: consent.consentDate,
      lastUpdated: consent.lastUpdated,
      withdrawalDate: consent.withdrawalDate,
      isActive: consent.isActive
    };
  }

  /**
   * Map database AuditLog to interface
   */
  private mapAuditLog(log: any): AuditLog {
    return {
      id: log.id,
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValues: log.oldValues,
      newValues: log.newValues,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp
    };
  }
}