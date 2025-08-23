import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { MessageProcessingService } from '../services/message-processing.js';
import { PrismaClient } from '@prisma/client';
import { MessageFormat } from '../types/index.js';

describe('Message Datasets for MVP Validation', () => {
  let prisma: PrismaClient;
  let messageService: MessageProcessingService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    messageService = new MessageProcessingService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Reliable User Dataset', () => {
    it('should load and validate reliable user JSON dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'reliable-user-messages.json');
      const fileContent = await fs.readFile(filePath, 'utf8');
      const messages = JSON.parse(fileContent);

      // Validate dataset structure
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(100);

      // Validate message structure
      const firstMessage = messages[0];
      expect(firstMessage).toHaveProperty('timestamp');
      expect(firstMessage).toHaveProperty('sender');
      expect(firstMessage).toHaveProperty('content');
      expect(firstMessage).toHaveProperty('messageType');

      // Validate date range (should span 6 months)
      const timestamps = messages.map(m => new Date(m.timestamp));
      const startDate = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const endDate = new Date(Math.max(...timestamps.map(t => t.getTime())));
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
      
      expect(monthsDiff).toBeGreaterThanOrEqual(5); // At least 5 months span

      // Validate reliable behavior patterns
      const contentText = messages.map(m => m.content).join(' ').toLowerCase();
      
      // Should contain positive financial behavior indicators
      expect(contentText).toMatch(/rent payment|payment.*on time|paid.*full/);
      expect(contentText).toMatch(/reliable|consistent|trust/);
      expect(contentText).toMatch(/budget|savings|emergency fund/);
      expect(contentText).toMatch(/credit score|financial discipline/);
    });

    it('should load and validate reliable user WhatsApp dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'reliable-user-whatsapp.txt');
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // Validate WhatsApp format
      const lines = fileContent.split('\n').filter(line => line.trim());
      expect(lines.length).toBeGreaterThan(50);

      // Validate WhatsApp message format
      const whatsappRegex = /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2} [AP]M - [^:]+: .+$/;
      const validMessages = lines.filter(line => whatsappRegex.test(line));
      expect(validMessages.length).toBeGreaterThan(50);

      // Validate reliable behavior patterns
      const contentText = fileContent.toLowerCase();
      expect(contentText).toMatch(/rent payment|payment.*on time|paid.*full/);
      expect(contentText).toMatch(/reliable|consistent|trust/);
    });
  });

  describe('Unreliable User Dataset', () => {
    it('should load and validate unreliable user JSON dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'unreliable-user-messages.json');
      const fileContent = await fs.readFile(filePath, 'utf8');
      const messages = JSON.parse(fileContent);

      // Validate dataset structure
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(100);

      // Validate message structure
      const firstMessage = messages[0];
      expect(firstMessage).toHaveProperty('timestamp');
      expect(firstMessage).toHaveProperty('sender');
      expect(firstMessage).toHaveProperty('content');
      expect(firstMessage).toHaveProperty('messageType');

      // Validate date range (should span 6 months)
      const timestamps = messages.map(m => new Date(m.timestamp));
      const startDate = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const endDate = new Date(Math.max(...timestamps.map(t => t.getTime())));
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
      
      expect(monthsDiff).toBeGreaterThanOrEqual(5); // At least 5 months span

      // Validate unreliable behavior patterns
      const contentText = messages.map(m => m.content).join(' ').toLowerCase();
      
      // Should contain negative financial behavior indicators
      expect(contentText).toMatch(/late|overdue|forgot|missed/);
      expect(contentText).toMatch(/can't pay|broke|struggling|overwhelmed/);
      expect(contentText).toMatch(/default|evict|repossess/);
      expect(contentText).toMatch(/anxiety|stress|panic|disaster/);
    });

    it('should load and validate unreliable user WhatsApp dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'unreliable-user-whatsapp.txt');
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // Validate WhatsApp format
      const lines = fileContent.split('\n').filter(line => line.trim());
      expect(lines.length).toBeGreaterThan(50);

      // Validate WhatsApp message format
      const whatsappRegex = /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2} [AP]M - [^:]+: .+$/;
      const validMessages = lines.filter(line => whatsappRegex.test(line));
      expect(validMessages.length).toBeGreaterThan(50);

      // Validate unreliable behavior patterns
      const contentText = fileContent.toLowerCase();
      expect(contentText).toMatch(/late|overdue|forgot|missed/);
      expect(contentText).toMatch(/can't pay|broke|struggling|overwhelmed/);
    });
  });

  describe('Message Processing Integration', () => {
    it('should detect JSON format correctly for reliable user dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'reliable-user-messages.json');
      const fileBuffer = await fs.readFile(filePath);
      
      const validation = await messageService.validateFile(
        'reliable-user-messages.json',
        fileBuffer.length,
        'application/json',
        fileBuffer
      );

      expect(validation.isValid).toBe(true);
      expect(validation.detectedFormat).toBe(MessageFormat.GENERIC);
      expect(validation.estimatedMessageCount).toBeGreaterThan(100);
    });

    it('should detect WhatsApp format correctly for reliable user dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'reliable-user-whatsapp.txt');
      const fileBuffer = await fs.readFile(filePath);
      
      const validation = await messageService.validateFile(
        'reliable-user-whatsapp.txt',
        fileBuffer.length,
        'text/plain',
        fileBuffer
      );

      expect(validation.isValid).toBe(true);
      expect(validation.detectedFormat).toBe(MessageFormat.WHATSAPP);
      expect(validation.estimatedMessageCount).toBeGreaterThan(50);
    });

    it('should detect JSON format correctly for unreliable user dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'unreliable-user-messages.json');
      const fileBuffer = await fs.readFile(filePath);
      
      const validation = await messageService.validateFile(
        'unreliable-user-messages.json',
        fileBuffer.length,
        'application/json',
        fileBuffer
      );

      expect(validation.isValid).toBe(true);
      expect(validation.detectedFormat).toBe(MessageFormat.GENERIC);
      expect(validation.estimatedMessageCount).toBeGreaterThan(100);
    });

    it('should detect WhatsApp format correctly for unreliable user dataset', async () => {
      const filePath = path.join(process.cwd(), 'test-uploads', 'unreliable-user-whatsapp.txt');
      const fileBuffer = await fs.readFile(filePath);
      
      const validation = await messageService.validateFile(
        'unreliable-user-whatsapp.txt',
        fileBuffer.length,
        'text/plain',
        fileBuffer
      );

      expect(validation.isValid).toBe(true);
      expect(validation.detectedFormat).toBe(MessageFormat.WHATSAPP);
      expect(validation.estimatedMessageCount).toBeGreaterThan(50);
    });
  });

  describe('Dataset Quality Validation', () => {
    it('should have contrasting behavioral patterns between reliable and unreliable datasets', async () => {
      // Load both datasets
      const reliableContent = await fs.readFile(
        path.join(process.cwd(), 'test-uploads', 'reliable-user-messages.json'), 
        'utf8'
      );
      const unreliableContent = await fs.readFile(
        path.join(process.cwd(), 'test-uploads', 'unreliable-user-messages.json'), 
        'utf8'
      );

      const reliableMessages = JSON.parse(reliableContent);
      const unreliableMessages = JSON.parse(unreliableContent);

      const reliableText = reliableMessages.map(m => m.content).join(' ').toLowerCase();
      const unreliableText = unreliableMessages.map(m => m.content).join(' ').toLowerCase();

      // Reliable dataset should have positive indicators
      const positiveWords = ['reliable', 'consistent', 'on time', 'paid', 'trust', 'discipline'];
      const reliablePositiveCount = positiveWords.reduce((count, word) => {
        return count + (reliableText.match(new RegExp(word, 'g')) || []).length;
      }, 0);

      // Unreliable dataset should have negative indicators
      const negativeWords = ['late', 'forgot', 'missed', 'overdue', 'broke', 'struggling'];
      const unreliableNegativeCount = negativeWords.reduce((count, word) => {
        return count + (unreliableText.match(new RegExp(word, 'g')) || []).length;
      }, 0);

      expect(reliablePositiveCount).toBeGreaterThan(10);
      expect(unreliableNegativeCount).toBeGreaterThan(20);
    });

    it('should have appropriate message count and time span for both datasets', async () => {
      const datasets = [
        'reliable-user-messages.json',
        'unreliable-user-messages.json'
      ];

      for (const dataset of datasets) {
        const filePath = path.join(process.cwd(), 'test-uploads', dataset);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const messages = JSON.parse(fileContent);

        // Should have 100+ messages
        expect(messages.length).toBeGreaterThanOrEqual(100);

        // Should span approximately 6 months
        const timestamps = messages.map(m => new Date(m.timestamp));
        const startDate = new Date(Math.min(...timestamps.map(t => t.getTime())));
        const endDate = new Date(Math.max(...timestamps.map(t => t.getTime())));
        const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        
        expect(daysDiff).toBeGreaterThan(150); // At least 5 months
        expect(daysDiff).toBeLessThan(270); // Less than 9 months
      }
    });
  });
});