// Database initialization script

import { PrismaClient } from '@prisma/client';
import { db } from './connection.js';
import { MigrationManager } from './migrations.js';
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
 * Initialize the database with all required setup
 */
export async function initializeDatabase(): Promise<PrismaClient> {
  try {
    logger.info('Starting database initialization...');

    // Connect to database
    await db.connect();
    logger.info('Database connection established');

    // Get Prisma client
    const prisma = db.getPrisma();

    // Initialize migration manager
    const migrationManager = new MigrationManager(prisma);

    // Run migrations
    await migrationManager.runMigrations();
    logger.info('Database migrations completed');

    // Create indexes for performance
    await migrationManager.createIndexes();
    logger.info('Database indexes created');

    // Create functions and triggers
    await migrationManager.createFunctions();
    logger.info('Database functions and triggers created');

    // Validate schema
    const isValid = await migrationManager.validateSchema();
    if (!isValid) {
      throw new Error('Database schema validation failed');
    }
    logger.info('Database schema validation passed');

    // Health check
    const health = await db.healthCheck();
    if (!health.database || !health.redis) {
      throw new Error(`Health check failed: Database=${health.database}, Redis=${health.redis}`);
    }
    logger.info('Database health check passed', health);

    logger.info('Database initialization completed successfully');

    return prisma;

  } catch (error) {
    logger.error('Database initialization failed', { error });
    throw error;
  }
}

/**
 * Cleanup and disconnect from database
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    logger.info('Cleaning up database connections...');
    await db.disconnect();
    logger.info('Database cleanup completed');
  } catch (error) {
    logger.error('Database cleanup failed', { error });
    throw error;
  }
}

// Export database instance and utilities
export { db };
export { MigrationManager };