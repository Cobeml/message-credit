// Database connection utilities with connection pooling

import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import winston from 'winston';
import { DatabaseConfig, RedisConfig } from '../types/index.js';

// Configure logger
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

// Prisma client singleton with connection pooling
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private prisma: PrismaClient;
  private redis: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    // Initialize Prisma with connection pooling configuration
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' }
      ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Set up Prisma logging
    this.prisma.$on('query', (e) => {
      logger.debug('Query executed', {
        query: e.query,
        params: e.params,
        duration: e.duration
      });
    });

    this.prisma.$on('error', (e) => {
      logger.error('Database error', { error: e });
    });

    this.prisma.$on('info', (e) => {
      logger.info('Database info', { message: e.message });
    });

    this.prisma.$on('warn', (e) => {
      logger.warn('Database warning', { message: e.message });
    });

    // Initialize Redis client
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      },
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    // Redis error handling
    this.redis.on('error', (err) => {
      logger.error('Redis client error', { error: err });
    });

    this.redis.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.redis.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.redis.on('end', () => {
      logger.info('Redis client connection ended');
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    try {
      // Test Prisma connection
      await this.prisma.$connect();
      logger.info('Database connected successfully');

      // Connect to Redis
      if (!this.redis.isOpen) {
        await this.redis.connect();
        logger.info('Redis connected successfully');
      }

      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected');

      if (this.redis.isOpen) {
        await this.redis.disconnect();
        logger.info('Redis disconnected');
      }

      this.isConnected = false;
    } catch (error) {
      logger.error('Error disconnecting from database', { error });
      throw error;
    }
  }

  public getPrisma(): PrismaClient {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  public getRedis(): RedisClientType {
    if (!this.redis.isOpen) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.redis;
  }

  public async healthCheck(): Promise<{ database: boolean; redis: boolean }> {
    const health = {
      database: false,
      redis: false
    };

    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      health.database = true;
    } catch (error) {
      logger.error('Database health check failed', { error });
    }

    try {
      // Test Redis connection
      await this.redis.ping();
      health.redis = true;
    } catch (error) {
      logger.error('Redis health check failed', { error });
    }

    return health;
  }

  public async executeTransaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(callback, {
      maxWait: 5000, // 5 seconds
      timeout: 10000, // 10 seconds
      isolationLevel: 'ReadCommitted'
    });
  }

  // Cache utilities
  public async cacheSet(
    key: string,
    value: any,
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.setEx(key, ttlSeconds, serializedValue);
    } catch (error) {
      logger.error('Cache set error', { key, error });
      // Don't throw - cache failures shouldn't break the application
    }
  }

  public async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  public async cacheDelete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }

  public async cacheDeletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
    }
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await db.disconnect();
  process.exit(0);
});

// Export types and utilities
export { DatabaseConnection };
export type { DatabaseConfig, RedisConfig };