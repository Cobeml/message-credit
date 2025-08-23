// Message upload routes with authentication and rate limiting

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { MessageUploadController } from '../controllers/message-upload.js';
import { AuthMiddleware } from '../middleware/auth.js';

// Rate limiting for file uploads
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 uploads per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many upload attempts. Please try again later.',
      timestamp: new Date()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for progress checks
const progressRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many progress check requests. Please try again later.',
      timestamp: new Date()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export function createMessageUploadRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const controller = new MessageUploadController(prisma);
  const authMiddleware = new AuthMiddleware(prisma);

  /**
   * POST /api/message-upload/upload
   * Upload a message file for processing
   * 
   * Body (multipart/form-data):
   * - messageFile: File (required) - The message file to upload
   * - format: string (optional) - Message format hint (imessage, whatsapp, email, generic)
   * 
   * Response:
   * - uploadId: string - Unique identifier for tracking upload progress
   * - status: string - Current upload status
   * - filename: string - Original filename
   * - format: string - Detected or specified message format
   * - estimatedMessageCount: number - Estimated number of messages
   * - warnings: string[] - Any validation warnings
   */
  router.post('/upload', 
    uploadRateLimit,
    authMiddleware.authenticate,
    controller.getUploadMiddleware(),
    controller.uploadFile
  );

  /**
   * GET /api/message-upload/progress/:uploadId
   * Get upload processing progress
   * 
   * Response:
   * - uploadId: string - Upload identifier
   * - status: string - Current status (pending, processing, completed, failed, expired)
   * - progress: number - Progress percentage (0-100)
   * - currentStep: string - Description of current processing step
   * - estimatedTimeRemaining: number (optional) - Estimated time remaining in seconds
   * - errorMessage: string (optional) - Error message if processing failed
   */
  router.get('/progress/:uploadId',
    progressRateLimit,
    authMiddleware.authenticate,
    controller.getUploadProgress
  );

  /**
   * GET /api/message-upload/result/:uploadId
   * Get upload processing result (metadata only for privacy)
   * 
   * Response:
   * - uploadId: string - Upload identifier
   * - status: string - Upload status
   * - messageCount: number - Number of processed messages
   * - format: string - Message format
   * - processedAt: Date - When processing completed
   * - sanitizedMessageHash: string - Hash of sanitized message content
   */
  router.get('/result/:uploadId',
    authMiddleware.authenticate,
    controller.getUploadResult
  );

  /**
   * GET /api/message-upload/list
   * List user's message uploads
   * 
   * Response:
   * - uploads: Array of upload objects with metadata
   * - total: number - Total number of uploads
   */
  router.get('/list',
    authMiddleware.authenticate,
    controller.listUploads
  );

  /**
   * DELETE /api/message-upload/:uploadId
   * Delete an upload and its associated data
   * 
   * Response:
   * - message: string - Confirmation message
   */
  router.delete('/:uploadId',
    authMiddleware.authenticate,
    controller.deleteUpload
  );

  /**
   * GET /api/message-upload/formats
   * Get supported message formats and their descriptions
   * 
   * Response:
   * - formats: Array of supported format objects
   */
  router.get('/formats', (req, res) => {
    const formats = [
      {
        id: 'imessage',
        name: 'iMessage',
        description: 'Apple iMessage export in JSON format',
        fileTypes: ['.json'],
        example: 'Export from iPhone backup or third-party tools'
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        description: 'WhatsApp chat export in text format',
        fileTypes: ['.txt'],
        example: 'Export from WhatsApp > Settings > Chats > Export Chat'
      },
      {
        id: 'email',
        name: 'Email',
        description: 'Email export in mbox or similar format',
        fileTypes: ['.txt', '.mbox'],
        example: 'Export from email client or webmail service'
      },
      {
        id: 'generic',
        name: 'Generic',
        description: 'Generic message format in JSON or CSV',
        fileTypes: ['.json', '.csv'],
        example: 'Custom format with timestamp, sender, and content fields'
      }
    ];

    res.json({
      success: true,
      data: { formats },
      timestamp: new Date(),
      requestId: req.requestId || ''
    });
  });

  /**
   * GET /api/message-upload/health
   * Health check endpoint for message upload service
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'message-upload',
        status: 'healthy',
        features: [
          'Secure file upload with encryption',
          'Multiple message format support',
          'PII sanitization and privacy protection',
          'Progress tracking and status monitoring',
          'Automatic file cleanup and expiration',
          'Rate limiting and security validation'
        ],
        supportedFormats: ['iMessage', 'WhatsApp', 'Email', 'Generic JSON/CSV'],
        maxFileSize: `${parseInt(process.env.MAX_FILE_SIZE || '50')}MB`,
        retentionPeriod: '24 hours'
      },
      timestamp: new Date(),
      requestId: req.requestId || ''
    });
  });

  return router;
}