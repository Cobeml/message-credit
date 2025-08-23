// Database utility functions and query helpers

import { PrismaClient, Prisma } from '@prisma/client';
import { db } from './connection.js';
import { APIError, ErrorCodes } from '../types/index.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
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

/**
 * Generic pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Database query utilities
 */
export class DatabaseUtils {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = db.getPrisma();
  }

  /**
   * Execute a paginated query
   */
  async paginate<T>(
    model: any,
    params: PaginationParams & { where?: any; include?: any; select?: any }
  ): Promise<PaginatedResponse<T>> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      model.findMany({
        where: params.where,
        include: params.include,
        select: params.select,
        skip,
        take: limit,
        orderBy: params.sortBy ? {
          [params.sortBy]: params.sortOrder || 'desc'
        } : undefined
      }),
      model.count({ where: params.where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Safe user lookup with privacy controls
   */
  async findUserById(userId: string, includePrivateData: boolean = false) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        profile: true,
        communityMemberships: {
          where: { isActive: true },
          include: {
            community: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        },
        gdprConsent: true,
        ...(includePrivateData && {
          aiAnalyses: {
            where: { isActive: true },
            orderBy: { analysisDate: 'desc' },
            take: 1
          },
          zkProofs: {
            where: { isActive: true },
            orderBy: { generatedAt: 'desc' }
          }
        })
      }
    });

    if (!user) {
      throw new APIError({
        code: ErrorCodes.NOT_FOUND,
        message: 'User not found',
        timestamp: new Date(),
        requestId: 'db-utils'
      });
    }

    return user;
  }

  /**
   * Get user's active trust score
   */
  async getUserTrustScore(userId: string) {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { analysisDate: 'desc' }
    });

    return analysis ? {
      score: Number(analysis.trustworthinessScore),
      traits: {
        conscientiousness: Number(analysis.conscientiousness),
        neuroticism: Number(analysis.neuroticism),
        agreeableness: Number(analysis.agreeableness),
        openness: Number(analysis.openness),
        extraversion: Number(analysis.extraversion),
        confidence: Number(analysis.confidenceLevel)
      },
      confidenceLevel: Number(analysis.confidenceLevel),
      lastUpdated: analysis.analysisDate,
      expiresAt: analysis.expiresAt
    } : null;
  }

  /**
   * Get community with member statistics
   */
  async getCommunityWithStats(communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId, isActive: true },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: {
                  select: {
                    profilePictureUrl: true
                  }
                }
              }
            }
          }
        },
        loans: {
          where: {
            status: { in: ['active', 'completed'] }
          },
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!community) {
      throw new APIError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Community not found',
        timestamp: new Date(),
        requestId: 'db-utils'
      });
    }

    // Calculate community statistics
    const totalLoanAmount = community.loans.reduce((sum, loan) => sum + Number(loan.amount), 0);
    const activeLoanCount = community.loans.filter(loan => loan.status === 'active').length;
    const completedLoanCount = community.loans.filter(loan => loan.status === 'completed').length;
    const averageReputationScore = community.memberships.length > 0 
      ? community.memberships.reduce((sum, m) => sum + Number(m.reputationScore), 0) / community.memberships.length
      : 0;

    return {
      ...community,
      stats: {
        totalLoanAmount,
        activeLoanCount,
        completedLoanCount,
        averageReputationScore,
        memberCount: community.memberships.length
      }
    };
  }

  /**
   * Search loans with filters
   */
  async searchLoans(filters: {
    communityId?: string;
    status?: string[];
    minAmount?: number;
    maxAmount?: number;
    borrowerId?: string;
    lenderId?: string;
  }, pagination: PaginationParams) {
    const where: Prisma.LoanWhereInput = {};

    if (filters.communityId) {
      where.communityId = filters.communityId;
    }

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) {
        where.amount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.amount.lte = filters.maxAmount;
      }
    }

    if (filters.borrowerId) {
      where.borrowerId = filters.borrowerId;
    }

    if (filters.lenderId) {
      where.lenderId = filters.lenderId;
    }

    return this.paginate(this.prisma.loan, {
      ...pagination,
      where,
      include: {
        borrower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        lender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                profilePictureUrl: true
              }
            }
          }
        },
        community: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * Get user's loan history with statistics
   */
  async getUserLoanHistory(userId: string) {
    const [borrowedLoans, lendedLoans] = await Promise.all([
      this.prisma.loan.findMany({
        where: { borrowerId: userId },
        include: {
          lender: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          community: {
            select: {
              id: true,
              name: true
            }
          },
          repaymentSchedule: {
            select: {
              isPaid: true,
              totalAmount: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.loan.findMany({
        where: { lenderId: userId },
        include: {
          borrower: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          community: {
            select: {
              id: true,
              name: true
            }
          },
          repaymentSchedule: {
            select: {
              isPaid: true,
              totalAmount: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Calculate statistics
    const borrowedStats = {
      totalLoans: borrowedLoans.length,
      totalAmount: borrowedLoans.reduce((sum, loan) => sum + Number(loan.amount), 0),
      activeLoans: borrowedLoans.filter(loan => loan.status === 'active').length,
      completedLoans: borrowedLoans.filter(loan => loan.status === 'completed').length,
      defaultedLoans: borrowedLoans.filter(loan => loan.status === 'defaulted').length
    };

    const lendedStats = {
      totalLoans: lendedLoans.length,
      totalAmount: lendedLoans.reduce((sum, loan) => sum + Number(loan.amount), 0),
      activeLoans: lendedLoans.filter(loan => loan.status === 'active').length,
      completedLoans: lendedLoans.filter(loan => loan.status === 'completed').length,
      defaultedLoans: lendedLoans.filter(loan => loan.status === 'defaulted').length
    };

    return {
      borrowed: {
        loans: borrowedLoans,
        stats: borrowedStats
      },
      lended: {
        loans: lendedLoans,
        stats: lendedStats
      }
    };
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(entry: {
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          ...entry,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to create audit log', { error, entry });
      // Don't throw - audit log failures shouldn't break the main operation
    }
  }

  /**
   * Cleanup expired records
   */
  async cleanupExpiredRecords() {
    try {
      const now = new Date();
      
      // Deactivate expired AI analyses
      const expiredAnalyses = await this.prisma.aiAnalysis.updateMany({
        where: {
          expiresAt: { lt: now },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Deactivate expired ZK proofs
      const expiredProofs = await this.prisma.zkProof.updateMany({
        where: {
          expiresAt: { lt: now },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      logger.info('Cleanup completed', {
        expiredAnalyses: expiredAnalyses.count,
        expiredProofs: expiredProofs.count
      });

      return {
        expiredAnalyses: expiredAnalyses.count,
        expiredProofs: expiredProofs.count
      };
    } catch (error) {
      logger.error('Cleanup failed', { error });
      throw error;
    }
  }

  /**
   * Get database health metrics
   */
  async getHealthMetrics() {
    try {
      const [
        userCount,
        activeUserCount,
        communityCount,
        activeLoanCount,
        pendingLoanCount
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.community.count({ where: { isActive: true } }),
        this.prisma.loan.count({ where: { status: 'active' } }),
        this.prisma.loan.count({ where: { status: 'pending' } })
      ]);

      return {
        users: {
          total: userCount,
          active: activeUserCount
        },
        communities: {
          total: communityCount
        },
        loans: {
          active: activeLoanCount,
          pending: pendingLoanCount
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get health metrics', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const dbUtils = new DatabaseUtils();