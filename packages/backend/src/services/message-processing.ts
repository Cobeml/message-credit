// Message file upload and processing service with privacy-preserving features

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import winston from 'winston';
import {
  MessageUpload,
  MessageFormat,
  FileUploadStatus,
  ParsedMessage,
  MessageParsingResult,
  FileValidationResult,
  UploadProgress,
  APIError,
  ErrorCodes
} from '../types/index.js';

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

export class MessageProcessingService {
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly encryptionKey: Buffer;

  constructor(private prisma: PrismaClient) {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '50') * 1024 * 1024; // 50MB default
    this.allowedMimeTypes = [
      'application/json',
      'text/csv',
      'text/plain',
      'application/zip',
      'text/x-csv'
    ];
    
    // Generate or load encryption key for file encryption
    const keyString = process.env.FILE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    this.encryptionKey = Buffer.from(keyString, 'hex');
    
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.info('Created upload directory', { path: this.uploadDir });
    }
  }

  /**
   * Validate uploaded file for security and format compliance
   */
  async validateFile(
    filename: string,
    fileSize: number,
    mimeType: string,
    buffer: Buffer
  ): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // File size validation
    if (fileSize > this.maxFileSize) {
      errors.push(`File size ${fileSize} exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // MIME type validation
    if (!this.allowedMimeTypes.includes(mimeType)) {
      errors.push(`File type ${mimeType} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Basic virus scanning (check for suspicious patterns)
    const suspiciousPatterns = [
      /\x00{10,}/, // Null byte sequences
      /<script[^>]*>/i, // Script tags
      /javascript:/i, // JavaScript URLs
      /vbscript:/i, // VBScript URLs
    ];

    const fileContent = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fileContent)) {
        errors.push('File contains suspicious content patterns');
        break;
      }
    }

    // Detect message format
    let detectedFormat: MessageFormat | undefined;
    let estimatedMessageCount: number | undefined;

    try {
      const content = buffer.toString('utf8');
      const formatDetection = this.detectMessageFormat(content, filename);
      detectedFormat = formatDetection.format;
      estimatedMessageCount = formatDetection.estimatedCount;
    } catch (error) {
      warnings.push('Could not detect message format automatically');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedFormat,
      estimatedMessageCount
    };
  }

  /**
   * Detect message format from file content and filename
   */
  private detectMessageFormat(content: string, filename: string): { format: MessageFormat; estimatedCount: number } {
    const lowerFilename = filename.toLowerCase();
    const contentSample = content.substring(0, 2000);

    // iMessage detection
    if (lowerFilename.includes('imessage') || 
        contentSample.includes('"service":"iMessage"') ||
        contentSample.includes('com.apple.madrid')) {
      const messageCount = (content.match(/"text":/g) || []).length;
      return { format: MessageFormat.IMESSAGE, estimatedCount: messageCount };
    }

    // WhatsApp detection
    if (lowerFilename.includes('whatsapp') ||
        contentSample.includes('WhatsApp Chat') ||
        /\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2} [AP]M - /.test(contentSample)) {
      const messageCount = (content.match(/\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2} [AP]M - /g) || []).length;
      return { format: MessageFormat.WHATSAPP, estimatedCount: messageCount };
    }

    // Email detection
    if (lowerFilename.includes('email') ||
        contentSample.includes('From:') ||
        contentSample.includes('Subject:') ||
        contentSample.includes('Date:')) {
      const messageCount = (content.match(/^From:/gm) || []).length;
      return { format: MessageFormat.EMAIL, estimatedCount: messageCount };
    }

    // Generic format (JSON or CSV)
    if (lowerFilename.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        const messageCount = Array.isArray(parsed) ? parsed.length : 
                           parsed.messages ? parsed.messages.length : 1;
        return { format: MessageFormat.GENERIC, estimatedCount: messageCount };
      } catch {
        // Fall through to generic
      }
    }

    if (lowerFilename.endsWith('.csv')) {
      const lines = content.split('\n').filter(line => line.trim());
      return { format: MessageFormat.GENERIC, estimatedCount: Math.max(0, lines.length - 1) };
    }

    // Default to generic
    const lines = content.split('\n').filter(line => line.trim());
    return { format: MessageFormat.GENERIC, estimatedCount: lines.length };
  }

  /**
   * Encrypt and store uploaded file
   */
  private async encryptAndStoreFile(buffer: Buffer, uploadId: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    const encrypted = Buffer.concat([
      iv,
      cipher.update(buffer),
      cipher.final()
    ]);

    const filePath = path.join(this.uploadDir, `${uploadId}.enc`);
    await fs.writeFile(filePath, encrypted);
    
    logger.info('File encrypted and stored', { uploadId, filePath });
    return filePath;
  }

  /**
   * Decrypt stored file
   */
  private async decryptFile(filePath: string): Promise<Buffer> {
    const encryptedData = await fs.readFile(filePath);
    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16);
    
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted;
  }

  /**
   * Parse messages based on detected format
   */
  private async parseMessages(content: string, format: MessageFormat): Promise<ParsedMessage[]> {
    switch (format) {
      case MessageFormat.IMESSAGE:
        return this.parseIMessageFormat(content);
      case MessageFormat.WHATSAPP:
        return this.parseWhatsAppFormat(content);
      case MessageFormat.EMAIL:
        return this.parseEmailFormat(content);
      case MessageFormat.GENERIC:
        return this.parseGenericFormat(content);
      default:
        throw new Error(`Unsupported message format: ${format}`);
    }
  }

  /**
   * Parse iMessage format (JSON export)
   */
  private parseIMessageFormat(content: string): ParsedMessage[] {
    try {
      const data = JSON.parse(content);
      const messages: ParsedMessage[] = [];

      if (Array.isArray(data)) {
        data.forEach((msg, index) => {
          if (msg.text) {
            messages.push({
              id: `imsg_${index}`,
              timestamp: new Date(msg.date || msg.timestamp || Date.now()),
              sender: msg.handle || msg.sender || 'unknown',
              content: msg.text,
              messageType: 'text',
              metadata: {
                service: msg.service,
                isFromMe: msg.is_from_me
              }
            });
          }
        });
      }

      return messages;
    } catch (error) {
      logger.error('Failed to parse iMessage format', { error });
      throw new Error('Invalid iMessage format');
    }
  }

  /**
   * Parse WhatsApp format (text export)
   */
  private parseWhatsAppFormat(content: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const lines = content.split('\n');
    
    // WhatsApp format: "MM/DD/YY, HH:MM AM/PM - Sender: Message"
    const whatsappRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}), (\d{1,2}:\d{2} [AP]M) - ([^:]+): (.+)$/;
    
    lines.forEach((line, index) => {
      const match = line.match(whatsappRegex);
      if (match) {
        const [, date, time, sender, message] = match;
        const timestamp = new Date(`${date} ${time}`);
        
        messages.push({
          id: `wa_${index}`,
          timestamp,
          sender: sender.trim(),
          content: message,
          messageType: 'text',
          metadata: {
            platform: 'whatsapp'
          }
        });
      }
    });

    return messages;
  }

  /**
   * Parse email format (mbox or similar)
   */
  private parseEmailFormat(content: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const emailSections = content.split(/^From /m);
    
    emailSections.forEach((section, index) => {
      if (!section.trim()) return;
      
      const lines = section.split('\n');
      let sender = 'unknown';
      let subject = '';
      let date = new Date();
      let messageContent = '';
      let inBody = false;
      
      for (const line of lines) {
        if (line.startsWith('From:')) {
          sender = line.replace('From:', '').trim();
        } else if (line.startsWith('Subject:')) {
          subject = line.replace('Subject:', '').trim();
        } else if (line.startsWith('Date:')) {
          date = new Date(line.replace('Date:', '').trim());
        } else if (line.trim() === '' && !inBody) {
          inBody = true;
        } else if (inBody) {
          messageContent += line + '\n';
        }
      }
      
      if (messageContent.trim()) {
        messages.push({
          id: `email_${index}`,
          timestamp: date,
          sender,
          content: `${subject}\n\n${messageContent.trim()}`,
          messageType: 'text',
          metadata: {
            subject,
            platform: 'email'
          }
        });
      }
    });

    return messages;
  }

  /**
   * Parse generic format (JSON or CSV)
   */
  private parseGenericFormat(content: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    
    try {
      // Try JSON first
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          messages.push({
            id: `generic_${index}`,
            timestamp: new Date(item.timestamp || item.date || Date.now()),
            sender: item.sender || item.from || item.author || 'unknown',
            content: item.content || item.message || item.text || String(item),
            messageType: 'text',
            metadata: { ...item }
          });
        });
      }
    } catch {
      // Try CSV format
      const lines = content.split('\n');
      const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase());
      
      if (headers && lines.length > 1) {
        lines.slice(1).forEach((line, index) => {
          if (!line.trim()) return;
          
          const values = line.split(',');
          const messageData: any = {};
          
          headers.forEach((header, i) => {
            messageData[header] = values[i]?.trim() || '';
          });
          
          messages.push({
            id: `csv_${index}`,
            timestamp: new Date(messageData.timestamp || messageData.date || Date.now()),
            sender: messageData.sender || messageData.from || messageData.author || 'unknown',
            content: messageData.content || messageData.message || messageData.text || line,
            messageType: 'text',
            metadata: messageData
          });
        });
      }
    }

    return messages;
  }

  /**
   * Sanitize messages to remove PII
   */
  private sanitizeMessages(messages: ParsedMessage[]): {
    sanitized: ParsedMessage[];
    report: MessageParsingResult['sanitizationReport'];
  } {
    const report = {
      piiRemoved: 0,
      phoneNumbersRemoved: 0,
      emailsRemoved: 0,
      addressesRemoved: 0,
      namesRedacted: 0
    };

    const sanitized = messages.map(msg => {
      let content = msg.content;
      let sender = msg.sender;

      // Remove phone numbers
      const phoneRegex = /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
      const phoneMatches = content.match(phoneRegex);
      if (phoneMatches) {
        report.phoneNumbersRemoved += phoneMatches.length;
        content = content.replace(phoneRegex, '[PHONE_REDACTED]');
      }

      // Remove email addresses
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatches = content.match(emailRegex);
      if (emailMatches) {
        report.emailsRemoved += emailMatches.length;
        content = content.replace(emailRegex, '[EMAIL_REDACTED]');
      }

      // Remove potential addresses (basic pattern)
      const addressRegex = /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)/gi;
      const addressMatches = content.match(addressRegex);
      if (addressMatches) {
        report.addressesRemoved += addressMatches.length;
        content = content.replace(addressRegex, '[ADDRESS_REDACTED]');
      }

      // Redact sender names (keep first letter)
      if (sender !== 'unknown' && sender.length > 1) {
        sender = sender.charAt(0) + '*'.repeat(Math.min(sender.length - 1, 5));
        report.namesRedacted++;
      }

      // Count total PII items removed
      report.piiRemoved = report.phoneNumbersRemoved + report.emailsRemoved + 
                         report.addressesRemoved + report.namesRedacted;

      return {
        ...msg,
        sender,
        content
      };
    });

    return { sanitized, report };
  }

  /**
   * Process uploaded message file
   */
  async processMessageFile(uploadId: string): Promise<MessageParsingResult> {
    const upload = await this.prisma.messageUpload.findUnique({
      where: { id: uploadId }
    });

    if (!upload) {
      throw new APIError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Upload not found',
        timestamp: new Date(),
        requestId: uploadId
      });
    }

    try {
      // Update status to processing
      await this.updateUploadProgress(uploadId, FileUploadStatus.PROCESSING, 10, 'Decrypting file...');

      // Decrypt and read file
      const fileBuffer = await this.decryptFile(upload.encryptedFilePath!);
      const content = fileBuffer.toString('utf8');

      await this.updateUploadProgress(uploadId, FileUploadStatus.PROCESSING, 30, 'Parsing messages...');

      // Parse messages
      const messages = await this.parseMessages(content, upload.format);

      await this.updateUploadProgress(uploadId, FileUploadStatus.PROCESSING, 60, 'Sanitizing content...');

      // Sanitize messages
      const { sanitized, report } = this.sanitizeMessages(messages);

      await this.updateUploadProgress(uploadId, FileUploadStatus.PROCESSING, 80, 'Finalizing...');

      // Calculate date range and participants
      const timestamps = sanitized.map(m => m.timestamp);
      const dateRange = {
        start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
        end: new Date(Math.max(...timestamps.map(t => t.getTime())))
      };

      const participants = [...new Set(sanitized.map(m => m.sender))];

      // Create sanitized message hash
      const sanitizedContent = JSON.stringify(sanitized);
      const messageHash = crypto.createHash('sha256').update(sanitizedContent).digest('hex');

      const result: MessageParsingResult = {
        messages: sanitized,
        totalCount: sanitized.length,
        format: upload.format,
        dateRange,
        participants,
        sanitizationReport: report
      };

      // Update upload record
      await this.prisma.messageUpload.update({
        where: { id: uploadId },
        data: {
          status: FileUploadStatus.COMPLETED,
          processedAt: new Date(),
          messageCount: sanitized.length,
          processingProgress: 100,
          sanitizedMessageHash: messageHash
        }
      });

      // Clean up encrypted file
      await this.cleanupFile(upload.encryptedFilePath!);

      logger.info('Message file processed successfully', {
        uploadId,
        messageCount: sanitized.length,
        format: upload.format
      });

      return result;

    } catch (error) {
      logger.error('Failed to process message file', { uploadId, error });
      
      await this.prisma.messageUpload.update({
        where: { id: uploadId },
        data: {
          status: FileUploadStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processingProgress: 0
        }
      });

      throw error;
    }
  }

  /**
   * Create new message upload record
   */
  async createUpload(
    userId: string,
    filename: string,
    originalFilename: string,
    fileSize: number,
    mimeType: string,
    format: MessageFormat,
    buffer: Buffer
  ): Promise<MessageUpload> {
    const uploadId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Encrypt and store file
    const encryptedFilePath = await this.encryptAndStoreFile(buffer, uploadId);

    const upload = await this.prisma.messageUpload.create({
      data: {
        id: uploadId,
        userId,
        filename,
        originalFilename,
        fileSize,
        mimeType,
        format,
        status: FileUploadStatus.PENDING,
        uploadedAt: new Date(),
        expiresAt,
        processingProgress: 0,
        encryptedFilePath
      }
    });

    logger.info('Message upload created', { uploadId, userId, filename });
    return upload;
  }

  /**
   * Update upload progress
   */
  async updateUploadProgress(
    uploadId: string,
    status: FileUploadStatus,
    progress: number,
    currentStep: string
  ): Promise<void> {
    await this.prisma.messageUpload.update({
      where: { id: uploadId },
      data: {
        status,
        processingProgress: progress
      }
    });

    logger.debug('Upload progress updated', { uploadId, status, progress, currentStep });
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(uploadId: string): Promise<UploadProgress> {
    const upload = await this.prisma.messageUpload.findUnique({
      where: { id: uploadId }
    });

    if (!upload) {
      throw new APIError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Upload not found',
        timestamp: new Date(),
        requestId: uploadId
      });
    }

    return {
      uploadId: upload.id,
      status: upload.status,
      progress: upload.processingProgress,
      currentStep: this.getStatusDescription(upload.status),
      errorMessage: upload.errorMessage || undefined
    };
  }

  private getStatusDescription(status: FileUploadStatus): string {
    switch (status) {
      case FileUploadStatus.PENDING:
        return 'Upload queued for processing';
      case FileUploadStatus.PROCESSING:
        return 'Processing messages...';
      case FileUploadStatus.COMPLETED:
        return 'Processing completed successfully';
      case FileUploadStatus.FAILED:
        return 'Processing failed';
      case FileUploadStatus.EXPIRED:
        return 'Upload expired';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Clean up expired uploads
   */
  async cleanupExpiredUploads(): Promise<void> {
    const expiredUploads = await this.prisma.messageUpload.findMany({
      where: {
        expiresAt: {
          lt: new Date()
        },
        status: {
          not: FileUploadStatus.EXPIRED
        }
      }
    });

    for (const upload of expiredUploads) {
      try {
        if (upload.encryptedFilePath) {
          await this.cleanupFile(upload.encryptedFilePath);
        }

        await this.prisma.messageUpload.update({
          where: { id: upload.id },
          data: {
            status: FileUploadStatus.EXPIRED,
            encryptedFilePath: null
          }
        });

        logger.info('Cleaned up expired upload', { uploadId: upload.id });
      } catch (error) {
        logger.error('Failed to cleanup expired upload', { uploadId: upload.id, error });
      }
    }
  }

  /**
   * Clean up file from disk
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug('File cleaned up', { filePath });
    } catch (error) {
      logger.warn('Failed to cleanup file', { filePath, error });
    }
  }

  /**
   * Get user uploads
   */
  async getUserUploads(userId: string): Promise<MessageUpload[]> {
    return this.prisma.messageUpload.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' }
    });
  }
}