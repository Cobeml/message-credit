// Tests for message file upload and processing system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MessageProcessingService } from '../services/message-processing.js';
import { MessageFormat, FileUploadStatus } from '../types/index.js';
import fs from 'fs/promises';
import path from 'path';

// Mock Prisma client
const mockPrisma = {
  messageUpload: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  auditLog: {
    deleteMany: vi.fn()
  },
  aIAnalysis: {
    updateMany: vi.fn()
  },
  zKProof: {
    updateMany: vi.fn()
  },
  gDPRConsent: {
    updateMany: vi.fn()
  }
} as unknown as PrismaClient;

describe('MessageProcessingService', () => {
  let service: MessageProcessingService;
  const testUploadDir = './test-uploads';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set test environment variables
    process.env.UPLOAD_DIR = testUploadDir;
    process.env.MAX_FILE_SIZE = '10'; // 10MB for testing
    process.env.FILE_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex
    
    service = new MessageProcessingService(mockPrisma);
    
    // Ensure test upload directory exists
    try {
      await fs.access(testUploadDir);
    } catch {
      await fs.mkdir(testUploadDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(testUploadDir);
      for (const file of files) {
        await fs.unlink(path.join(testUploadDir, file));
      }
      await fs.rmdir(testUploadDir);
    } catch {
      // Directory might not exist or be empty
    }
  });

  describe('validateFile', () => {
    it('should validate a valid JSON file', async () => {
      const content = JSON.stringify([
        { text: 'Hello world', sender: 'user1', timestamp: new Date().toISOString() }
      ]);
      const buffer = Buffer.from(content);

      const result = await service.validateFile(
        'messages.json',
        buffer.length,
        'application/json',
        buffer
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.detectedFormat).toBe(MessageFormat.GENERIC);
      expect(result.estimatedMessageCount).toBe(1);
    });

    it('should reject files that are too large', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const buffer = Buffer.from(largeContent);

      const result = await service.validateFile(
        'large.txt',
        buffer.length,
        'text/plain',
        buffer
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('exceeds maximum allowed size'))).toBe(true);
    });

    it('should reject unsupported file types', async () => {
      const buffer = Buffer.from('test content');

      const result = await service.validateFile(
        'test.exe',
        buffer.length,
        'application/x-executable',
        buffer
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('not allowed'))).toBe(true);
    });

    it('should detect suspicious content patterns', async () => {
      const suspiciousContent = '<script>alert("xss")</script>';
      const buffer = Buffer.from(suspiciousContent);

      const result = await service.validateFile(
        'suspicious.txt',
        buffer.length,
        'text/plain',
        buffer
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File contains suspicious content patterns');
    });

    it('should detect WhatsApp format', async () => {
      const whatsappContent = `12/25/23, 10:30 AM - John Doe: Hello there
12/25/23, 10:31 AM - Jane Smith: Hi John!`;
      const buffer = Buffer.from(whatsappContent);

      const result = await service.validateFile(
        'whatsapp_chat.txt',
        buffer.length,
        'text/plain',
        buffer
      );

      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe(MessageFormat.WHATSAPP);
      expect(result.estimatedMessageCount).toBe(2);
    });

    it('should detect iMessage format', async () => {
      const imessageContent = JSON.stringify([
        {
          text: 'Hello from iPhone',
          service: 'iMessage',
          handle: '+1234567890',
          is_from_me: false,
          date: new Date().toISOString()
        }
      ]);
      const buffer = Buffer.from(imessageContent);

      const result = await service.validateFile(
        'imessage_export.json',
        buffer.length,
        'application/json',
        buffer
      );

      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe(MessageFormat.IMESSAGE);
      expect(result.estimatedMessageCount).toBe(1);
    });
  });

  describe('createUpload', () => {
    it('should create upload record and encrypt file', async () => {
      const mockUpload = {
        id: 'test-upload-id',
        userId: 'user-123',
        filename: 'test.json',
        originalFilename: 'messages.json',
        fileSize: 100,
        mimeType: 'application/json',
        format: MessageFormat.GENERIC,
        status: FileUploadStatus.PENDING,
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        processingProgress: 0,
        encryptedFilePath: expect.any(String)
      };

      mockPrisma.messageUpload.create.mockResolvedValue(mockUpload);

      const buffer = Buffer.from('test content');
      const result = await service.createUpload(
        'user-123',
        'test.json',
        'messages.json',
        100,
        'application/json',
        MessageFormat.GENERIC,
        buffer
      );

      expect(mockPrisma.messageUpload.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          filename: 'test.json',
          originalFilename: 'messages.json',
          fileSize: 100,
          mimeType: 'application/json',
          format: MessageFormat.GENERIC,
          status: FileUploadStatus.PENDING,
          processingProgress: 0,
          encryptedFilePath: expect.any(String)
        })
      });

      expect(result).toEqual(mockUpload);
    });
  });

  describe('message parsing', () => {
    it('should parse iMessage JSON format', async () => {
      const mockUpload = {
        id: 'test-upload',
        format: MessageFormat.IMESSAGE,
        encryptedFilePath: path.join(testUploadDir, 'test.enc')
      };

      const imessageData = [
        {
          text: 'Hello world',
          handle: '+1234567890',
          service: 'iMessage',
          is_from_me: false,
          date: '2023-12-25T10:30:00Z'
        },
        {
          text: 'How are you?',
          handle: '+1234567890',
          service: 'iMessage',
          is_from_me: true,
          date: '2023-12-25T10:31:00Z'
        }
      ];

      // Create encrypted test file
      const content = JSON.stringify(imessageData);
      const buffer = Buffer.from(content);
      await fs.writeFile(mockUpload.encryptedFilePath, buffer); // Simplified for test

      mockPrisma.messageUpload.findUnique.mockResolvedValue(mockUpload);
      mockPrisma.messageUpload.update.mockResolvedValue({});

      // Mock the decryption to return original content
      vi.spyOn(service as any, 'decryptFile').mockResolvedValue(buffer);

      const result = await service.processMessageFile('test-upload');

      expect(result.messages).toHaveLength(2);
      expect(result.format).toBe(MessageFormat.IMESSAGE);
      expect(result.totalCount).toBe(2);
      expect(result.messages[0].content).toBe('Hello world');
      expect(result.messages[0].sender).toMatch(/^\+\*+$/); // Redacted phone number
    });

    it('should parse WhatsApp text format', async () => {
      const mockUpload = {
        id: 'test-upload',
        format: MessageFormat.WHATSAPP,
        encryptedFilePath: path.join(testUploadDir, 'test.enc')
      };

      const whatsappContent = `12/25/23, 10:30 AM - John Doe: Hello there
12/25/23, 10:31 AM - Jane Smith: Hi John!
12/25/23, 10:32 AM - John Doe: How are you doing?`;

      const buffer = Buffer.from(whatsappContent);
      await fs.writeFile(mockUpload.encryptedFilePath, buffer);

      mockPrisma.messageUpload.findUnique.mockResolvedValue(mockUpload);
      mockPrisma.messageUpload.update.mockResolvedValue({});

      vi.spyOn(service as any, 'decryptFile').mockResolvedValue(buffer);

      const result = await service.processMessageFile('test-upload');

      expect(result.messages).toHaveLength(3);
      expect(result.format).toBe(MessageFormat.WHATSAPP);
      expect(result.messages[0].sender).toBe('J*****'); // Redacted name
      expect(result.messages[1].sender).toBe('J*****'); // Redacted name
    });

    it('should sanitize PII from messages', async () => {
      const mockUpload = {
        id: 'test-upload',
        format: MessageFormat.GENERIC,
        encryptedFilePath: path.join(testUploadDir, 'test.enc')
      };

      const messagesWithPII = [
        {
          sender: 'John Doe',
          content: 'My phone is 555-123-4567 and email is john@example.com',
          timestamp: new Date().toISOString()
        },
        {
          sender: 'Jane Smith',
          content: 'I live at 123 Main Street, Anytown',
          timestamp: new Date().toISOString()
        }
      ];

      const buffer = Buffer.from(JSON.stringify(messagesWithPII));
      await fs.writeFile(mockUpload.encryptedFilePath, buffer);

      mockPrisma.messageUpload.findUnique.mockResolvedValue(mockUpload);
      mockPrisma.messageUpload.update.mockResolvedValue({});

      vi.spyOn(service as any, 'decryptFile').mockResolvedValue(buffer);

      const result = await service.processMessageFile('test-upload');

      expect(result.messages[0].content).toContain('[PHONE_REDACTED]');
      expect(result.messages[0].content).toContain('[EMAIL_REDACTED]');
      expect(result.messages[1].content).toContain('[ADDRESS_REDACTED]');
      
      expect(result.sanitizationReport.phoneNumbersRemoved).toBe(1);
      expect(result.sanitizationReport.emailsRemoved).toBe(1);
      expect(result.sanitizationReport.addressesRemoved).toBe(1);
      expect(result.sanitizationReport.namesRedacted).toBe(2);
    });
  });

  describe('getUploadProgress', () => {
    it('should return upload progress', async () => {
      const mockUpload = {
        id: 'test-upload',
        status: FileUploadStatus.PROCESSING,
        processingProgress: 50,
        errorMessage: null
      };

      mockPrisma.messageUpload.findUnique.mockResolvedValue(mockUpload);

      const result = await service.getUploadProgress('test-upload');

      expect(result.uploadId).toBe('test-upload');
      expect(result.status).toBe(FileUploadStatus.PROCESSING);
      expect(result.progress).toBe(50);
      expect(result.currentStep).toBe('Processing messages...');
    });

    it('should throw error for non-existent upload', async () => {
      mockPrisma.messageUpload.findUnique.mockResolvedValue(null);

      await expect(service.getUploadProgress('non-existent')).rejects.toThrow();
    });
  });

  describe('getUserUploads', () => {
    it('should return user uploads', async () => {
      const mockUploads = [
        {
          id: 'upload-1',
          userId: 'user-123',
          originalFilename: 'messages1.json',
          status: FileUploadStatus.COMPLETED,
          uploadedAt: new Date()
        },
        {
          id: 'upload-2',
          userId: 'user-123',
          originalFilename: 'messages2.txt',
          status: FileUploadStatus.PROCESSING,
          uploadedAt: new Date()
        }
      ];

      mockPrisma.messageUpload.findMany.mockResolvedValue(mockUploads);

      const result = await service.getUserUploads('user-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.messageUpload.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { uploadedAt: 'desc' }
      });
    });
  });

  describe('cleanupExpiredUploads', () => {
    it('should clean up expired uploads', async () => {
      const expiredUploads = [
        {
          id: 'expired-1',
          encryptedFilePath: path.join(testUploadDir, 'expired1.enc')
        },
        {
          id: 'expired-2',
          encryptedFilePath: path.join(testUploadDir, 'expired2.enc')
        }
      ];

      // Create test files
      for (const upload of expiredUploads) {
        await fs.writeFile(upload.encryptedFilePath, 'test content');
      }

      mockPrisma.messageUpload.findMany.mockResolvedValue(expiredUploads);
      mockPrisma.messageUpload.update.mockResolvedValue({});

      await service.cleanupExpiredUploads();

      expect(mockPrisma.messageUpload.update).toHaveBeenCalledTimes(2);
      
      // Check that files were deleted
      for (const upload of expiredUploads) {
        await expect(fs.access(upload.encryptedFilePath)).rejects.toThrow();
      }
    });
  });
});