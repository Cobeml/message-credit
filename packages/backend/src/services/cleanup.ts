// Cleanup service for expired uploads and temporary files

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { MessageProcessingService } from './message-processing.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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

export class CleanupService {
  private messageService: MessageProcessingService;
  private isRunning: boolean = false;

  constructor(private prisma: PrismaClient) {
    this.messageService = new MessageProcessingService(prisma);
  }

  /**
   * Start the cleanup service with scheduled tasks
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Cleanup service is already running');
      return;
    }

    // Run cleanup every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        logger.error('Scheduled cleanup failed', { error });
      }
    });

    // Run cleanup every 6 hours for more thorough cleanup
    cron.schedule('0 */6 * * *', async () => {
      try {
        await this.runThoroughCleanup();
      } catch (error) {
        logger.error('Scheduled thorough cleanup failed', { error });
      }
    });

    this.isRunning = true;
    logger.info('Cleanup service started with scheduled tasks');
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Cleanup service stopped');
  }

  /**
   * Run basic cleanup tasks
   */
  async runCleanup(): Promise<void> {
    logger.info('Starting scheduled cleanup');

    try {
      // Clean up expired message uploads
      await this.messageService.cleanupExpiredUploads();

      // Clean up old audit logs (keep last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deletedAuditLogs = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: thirtyDaysAgo
          }
        }
      });

      logger.info('Basic cleanup completed', {
        deletedAuditLogs: deletedAuditLogs.count
      });

    } catch (error) {
      logger.error('Basic cleanup failed', { error });
      throw error;
    }
  }

  /**
   * Run thorough cleanup tasks
   */
  async runThoroughCleanup(): Promise<void> {
    logger.info('Starting thorough cleanup');

    try {
      // Run basic cleanup first
      await this.runCleanup();

      // Clean up expired AI analyses
      const expiredAnalyses = await this.prisma.aIAnalysis.updateMany({
        where: {
          expiresAt: {
            lt: new Date()
          },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Clean up expired ZK proofs
      const expiredProofs = await this.prisma.zKProof.updateMany({
        where: {
          expiresAt: {
            lt: new Date()
          },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Clean up inactive GDPR consents (withdrawn > 30 days ago)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const inactiveConsents = await this.prisma.gDPRConsent.updateMany({
        where: {
          withdrawalDate: {
            lt: thirtyDaysAgo
          },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      logger.info('Thorough cleanup completed', {
        expiredAnalyses: expiredAnalyses.count,
        expiredProofs: expiredProofs.count,
        inactiveConsents: inactiveConsents.count
      });

    } catch (error) {
      logger.error('Thorough cleanup failed', { error });
      throw error;
    }
  }

  /**
   * Run cleanup manually (for testing or admin purposes)
   */
  async runManualCleanup(): Promise<{
    expiredUploads: number;
    deletedAuditLogs: number;
    expiredAnalyses: number;
    expiredProofs: number;
    inactiveConsents: number;
  }> {
    logger.info('Starting manual cleanup');

    try {
      // Clean up expired message uploads
      const uploadsBefore = await this.prisma.messageUpload.count({
        where: {
          expiresAt: { lt: new Date() },
          status: { not: 'expired' }
        }
      });

      await this.messageService.cleanupExpiredUploads();

      const uploadsAfter = await this.prisma.messageUpload.count({
        where: {
          expiresAt: { lt: new Date() },
          status: { not: 'expired' }
        }
      });

      const expiredUploads = uploadsBefore - uploadsAfter;

      // Clean up old audit logs
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deletedAuditLogs = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: { lt: thirtyDaysAgo }
        }
      });

      // Clean up expired AI analyses
      const expiredAnalyses = await this.prisma.aIAnalysis.updateMany({
        where: {
          expiresAt: { lt: new Date() },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Clean up expired ZK proofs
      const expiredProofs = await this.prisma.zKProof.updateMany({
        where: {
          expiresAt: { lt: new Date() },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Clean up inactive GDPR consents
      const inactiveConsents = await this.prisma.gDPRConsent.updateMany({
        where: {
          withdrawalDate: { lt: thirtyDaysAgo },
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      const result = {
        expiredUploads,
        deletedAuditLogs: deletedAuditLogs.count,
        expiredAnalyses: expiredAnalyses.count,
        expiredProofs: expiredProofs.count,
        inactiveConsents: inactiveConsents.count
      };

      logger.info('Manual cleanup completed', result);
      return result;

    } catch (error) {
      logger.error('Manual cleanup failed', { error });
      throw error;
    }
  }
}