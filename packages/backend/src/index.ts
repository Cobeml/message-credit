// Main entry point for the backend API server

import { PrismaClient } from '@prisma/client';
import { initializeDatabase, cleanupDatabase } from './database/init.js';
import { createApp } from './app.js';
import { CleanupService } from './services/cleanup.js';
import winston from 'winston';

// Configure logger
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

async function startServer() {
  try {
    logger.info('Starting Community P2P Lending Backend...');

    // Initialize database
    const prisma = await initializeDatabase();
    logger.info('Database initialized successfully');

    // Create Express application
    const app = createApp(prisma);
    
    // Initialize cleanup service
    const cleanupService = new CleanupService(prisma);
    cleanupService.start();
    logger.info('Cleanup service started');
    
    // Start server
    const port = process.env.PORT || 3001;
    const server = app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info('Authentication and user management services are ready');
      logger.info(`API documentation available at http://localhost:${port}/api`);
      logger.info(`Health check available at http://localhost:${port}/health`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        cleanupService.stop();
        logger.info('Cleanup service stopped');
        await cleanupDatabase();
        logger.info('Database connections closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();

export {};
