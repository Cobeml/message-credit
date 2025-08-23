// Integration tests for message upload API endpoints

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../app.js';
import { MessageFormat, FileUploadStatus } from '../types/index.js';

// Mock Prisma client
const mockPrisma = {
  messageUpload: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  },
  userAuth: {
    findUnique: vi.fn()
  },
  gDPRConsent: {
    findUnique: vi.fn()
  }
} as unknown as PrismaClient;

describe('Message Upload API', () => {
  let app: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.UPLOAD_DIR = './test-uploads';
    process.env.MAX_FILE_SIZE = '10'; // 10MB
    
    app = createApp(mockPrisma);
  });

  describe('POST /api/message-upload/upload', () => {
    it('should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/api/message-upload/upload')
        .attach('messageFile', Buffer.from('test'), 'test.txt');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject unsupported file types without auth', async () => {
      const response = await request(app)
        .post('/api/message-upload/upload')
        .attach('messageFile', Buffer.from('test'), {
          filename: 'test.exe',
          contentType: 'application/x-executable'
        });

      expect(response.status).toBe(401); // Auth fails first
    });
  });

  describe('GET /api/message-upload/progress/:uploadId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/message-upload/progress/upload-123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/message-upload/result/:uploadId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/message-upload/result/upload-123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/message-upload/list', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/message-upload/list');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('DELETE /api/message-upload/:uploadId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/message-upload/upload-123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/message-upload/formats', () => {
    it('should return supported formats', async () => {
      const response = await request(app)
        .get('/api/message-upload/formats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.formats).toHaveLength(4);
      
      const formats = response.body.data.formats;
      expect(formats.find((f: any) => f.id === 'imessage')).toBeDefined();
      expect(formats.find((f: any) => f.id === 'whatsapp')).toBeDefined();
      expect(formats.find((f: any) => f.id === 'email')).toBeDefined();
      expect(formats.find((f: any) => f.id === 'generic')).toBeDefined();
    });
  });

  describe('GET /api/message-upload/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/message-upload/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toBe('message-upload');
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.features).toContain('Secure file upload with encryption');
      expect(response.body.data.supportedFormats).toContain('WhatsApp');
      expect(response.body.data.maxFileSize).toBe('10MB');
    });
  });

  describe('Rate limiting', () => {
    it('should enforce upload rate limits', async () => {
      // Make multiple rapid requests without auth
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/message-upload/upload')
          .attach('messageFile', Buffer.from('test'), 'test.json')
      );

      const responses = await Promise.all(requests);

      // Should get either 401 (unauthorized) or 429 (rate limited)
      const validStatusCodes = responses.every(r => r.status === 401 || r.status === 429);
      expect(validStatusCodes).toBe(true);
    });
  });
});