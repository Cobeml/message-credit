// Message file upload controller with security and privacy features

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { MessageProcessingService } from '../services/message-processing.js';
import { 
  APIResponse, 
  APIError, 
  ErrorCodes, 
  MessageFormat,
  FileUploadStatus 
} from '../types/index.js';
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

// Configure multer for memory storage (we'll encrypt and store manually)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '50') * 1024 * 1024, // 50MB default
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/json',
      'text/csv',
      'text/plain',
      'application/zip',
      'text/x-csv'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

export class MessageUploadController {
  private messageService: MessageProcessingService;

  constructor(private prisma: PrismaClient) {
    this.messageService = new MessageProcessingService(prisma);
  }

  /**
   * Upload message file endpoint
   */
  uploadFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const error = new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User authentication required',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(401).json({ success: false, error });
        return;
      }

      if (!req.file) {
        const error = new APIError({
          code: ErrorCodes.INVALID_INPUT,
          message: 'No file uploaded',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(400).json({ success: false, error });
        return;
      }

      const { buffer, originalname, size, mimetype } = req.file;
      const { format } = req.body;

      // Validate file
      const validation = await this.messageService.validateFile(
        originalname,
        size,
        mimetype,
        buffer
      );

      if (!validation.isValid) {
        const error = new APIError({
          code: ErrorCodes.INVALID_INPUT,
          message: 'File validation failed',
          details: { errors: validation.errors, warnings: validation.warnings },
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(400).json({ success: false, error });
        return;
      }

      // Use detected format or provided format
      const messageFormat = format || validation.detectedFormat || MessageFormat.GENERIC;

      // Create upload record
      const upload = await this.messageService.createUpload(
        userId,
        `upload_${Date.now()}_${originalname}`,
        originalname,
        size,
        mimetype,
        messageFormat,
        buffer
      );

      // Start processing asynchronously
      this.processFileAsync(upload.id).catch(error => {
        logger.error('Async file processing failed', { uploadId: upload.id, error });
      });

      const response: APIResponse = {
        success: true,
        data: {
          uploadId: upload.id,
          status: upload.status,
          filename: upload.originalFilename,
          format: upload.format,
          estimatedMessageCount: validation.estimatedMessageCount,
          warnings: validation.warnings
        },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.status(201).json(response);

      logger.info('File upload initiated', {
        uploadId: upload.id,
        userId,
        filename: originalname,
        size,
        format: messageFormat
      });

    } catch (error) {
      logger.error('File upload failed', { error, userId: req.user?.id });
      
      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Upload failed',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });

      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * Get upload progress
   */
  getUploadProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        const error = new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User authentication required',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(401).json({ success: false, error });
        return;
      }

      // Verify upload belongs to user
      const upload = await this.prisma.messageUpload.findFirst({
        where: {
          id: uploadId,
          userId
        }
      });

      if (!upload) {
        const error = new APIError({
          code: ErrorCodes.NOT_FOUND,
          message: 'Upload not found',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(404).json({ success: false, error });
        return;
      }

      const progress = await this.messageService.getUploadProgress(uploadId);

      const response: APIResponse = {
        success: true,
        data: progress,
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.json(response);

    } catch (error) {
      logger.error('Failed to get upload progress', { error, uploadId: req.params.uploadId });
      
      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Failed to get progress',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });

      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * Get upload result
   */
  getUploadResult = async (req: Request, res: Response): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        const error = new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User authentication required',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(401).json({ success: false, error });
        return;
      }

      // Verify upload belongs to user and is completed
      const upload = await this.prisma.messageUpload.findFirst({
        where: {
          id: uploadId,
          userId
        }
      });

      if (!upload) {
        const error = new APIError({
          code: ErrorCodes.NOT_FOUND,
          message: 'Upload not found',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(404).json({ success: false, error });
        return;
      }

      if (upload.status !== FileUploadStatus.COMPLETED) {
        const error = new APIError({
          code: ErrorCodes.INVALID_INPUT,
          message: `Upload not completed. Current status: ${upload.status}`,
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(400).json({ success: false, error });
        return;
      }

      // For privacy, we don't return the actual messages, just metadata
      const response: APIResponse = {
        success: true,
        data: {
          uploadId: upload.id,
          status: upload.status,
          messageCount: upload.messageCount,
          format: upload.format,
          processedAt: upload.processedAt,
          sanitizedMessageHash: upload.sanitizedMessageHash
        },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.json(response);

    } catch (error) {
      logger.error('Failed to get upload result', { error, uploadId: req.params.uploadId });
      
      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Failed to get result',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });

      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * List user uploads
   */
  listUploads = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        const error = new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User authentication required',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(401).json({ success: false, error });
        return;
      }

      const uploads = await this.messageService.getUserUploads(userId);

      // Filter sensitive information
      const sanitizedUploads = uploads.map(upload => ({
        id: upload.id,
        originalFilename: upload.originalFilename,
        fileSize: upload.fileSize,
        format: upload.format,
        status: upload.status,
        messageCount: upload.messageCount,
        processingProgress: upload.processingProgress,
        uploadedAt: upload.uploadedAt,
        processedAt: upload.processedAt,
        expiresAt: upload.expiresAt,
        errorMessage: upload.errorMessage
      }));

      const response: APIResponse = {
        success: true,
        data: {
          uploads: sanitizedUploads,
          total: uploads.length
        },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.json(response);

    } catch (error) {
      logger.error('Failed to list uploads', { error, userId: req.user?.id });
      
      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Failed to list uploads',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });

      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * Delete upload
   */
  deleteUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        const error = new APIError({
          code: ErrorCodes.UNAUTHORIZED,
          message: 'User authentication required',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(401).json({ success: false, error });
        return;
      }

      // Verify upload belongs to user
      const upload = await this.prisma.messageUpload.findFirst({
        where: {
          id: uploadId,
          userId
        }
      });

      if (!upload) {
        const error = new APIError({
          code: ErrorCodes.NOT_FOUND,
          message: 'Upload not found',
          timestamp: new Date(),
          requestId: req.requestId || ''
        });
        res.status(404).json({ success: false, error });
        return;
      }

      // Delete the upload record
      await this.prisma.messageUpload.delete({
        where: { id: uploadId }
      });

      const response: APIResponse = {
        success: true,
        data: { message: 'Upload deleted successfully' },
        timestamp: new Date(),
        requestId: req.requestId || ''
      };

      res.json(response);

      logger.info('Upload deleted', { uploadId, userId });

    } catch (error) {
      logger.error('Failed to delete upload', { error, uploadId: req.params.uploadId });
      
      const apiError = new APIError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Failed to delete upload',
        timestamp: new Date(),
        requestId: req.requestId || ''
      });

      res.status(500).json({ success: false, error: apiError });
    }
  };

  /**
   * Process file asynchronously
   */
  private async processFileAsync(uploadId: string): Promise<void> {
    try {
      await this.messageService.processMessageFile(uploadId);
      logger.info('File processing completed', { uploadId });
    } catch (error) {
      logger.error('File processing failed', { uploadId, error });
    }
  }

  /**
   * Get multer middleware
   */
  getUploadMiddleware() {
    return upload.single('messageFile');
  }
}