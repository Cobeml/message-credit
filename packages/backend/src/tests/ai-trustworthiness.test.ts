import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeIntegrationService } from '../services/ai-trustworthiness.js';
import { BigFiveTraits } from '../types/index.js';

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate
      }
    }))
  };
});

describe('ClaudeIntegrationService', () => {
  let service: ClaudeIntegrationService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create service with test config
    service = new ClaudeIntegrationService({
      apiKey: 'test-api-key',
      maxRetries: 2,
      retryDelay: 100,
      timeout: 5000
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeMessageHistory', () => {
    it('should analyze message history and return Big Five traits', async () => {
      // Mock successful Claude API response
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            conscientiousness: 75,
            neuroticism: 30,
            agreeableness: 80,
            openness: 65,
            extraversion: 55,
            confidence: 85
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages = [
        'I always make sure to complete my tasks on time and help others when needed.',
        'Planning ahead is really important to me, and I try to stay organized.',
        'I enjoy meeting new people and learning about different perspectives.'
      ];

      const result = await service.analyzeMessageHistory(messages);

      expect(result).toEqual({
        conscientiousness: 75,
        neuroticism: 30,
        agreeableness: 80,
        openness: 65,
        extraversion: 55,
        confidence: 85
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: expect.stringContaining('Big Five personality model')
        }]
      });
    });

    it('should preprocess messages to remove PII', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            conscientiousness: 70,
            neuroticism: 40,
            agreeableness: 75,
            openness: 60,
            extraversion: 50,
            confidence: 80
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages = [
        'My email is john.doe@example.com and my phone is 555-123-4567',
        'I live at 123 Main Street and my SSN is 123-45-6789',
        'My credit card number is 4532 1234 5678 9012'
      ];

      await service.analyzeMessageHistory(messages);

      const callArgs = mockCreate.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      // Verify PII was removed
      expect(prompt).not.toContain('john.doe@example.com');
      expect(prompt).not.toContain('555-123-4567');
      expect(prompt).not.toContain('123 Main Street');
      expect(prompt).not.toContain('123-45-6789');
      expect(prompt).not.toContain('4532 1234 5678 9012');

      // Verify PII was replaced with placeholders
      expect(prompt).toContain('[EMAIL]');
      expect(prompt).toContain('[PHONE]');
      expect(prompt).toContain('[ADDRESS]');
      expect(prompt).toContain('[SSN]');
      expect(prompt).toContain('[CARD]');
    });

    it('should throw error for empty message history', async () => {
      await expect(service.analyzeMessageHistory([])).rejects.toThrow('Message history cannot be empty');
    });

    it('should retry on API failure', async () => {
      // First call fails, second succeeds
      mockCreate
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          content: [{
            type: 'text',
            text: JSON.stringify({
              conscientiousness: 70,
              neuroticism: 40,
              agreeableness: 75,
              openness: 60,
              extraversion: 50,
              confidence: 80
            })
          }]
        });

      const messages = ['Test message for retry logic'];
      const result = await service.analyzeMessageHistory(messages);

      expect(result.conscientiousness).toBe(70);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockCreate.mockRejectedValue(new Error('Persistent API Error'));

      const messages = ['Test message'];
      
      await expect(service.analyzeMessageHistory(messages)).rejects.toThrow('Claude API failed after 2 attempts');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid JSON response', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Invalid JSON response'
        }]
      });

      const messages = ['Test message'];
      
      await expect(service.analyzeMessageHistory(messages)).rejects.toThrow('Failed to parse personality traits');
    });

    it('should validate trait values are within range', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            conscientiousness: 150, // Invalid - over 100
            neuroticism: -10,       // Invalid - under 0
            agreeableness: 75,
            openness: 60,
            extraversion: 50,
            confidence: 80
          })
        }]
      });

      const messages = ['Test message'];
      
      await expect(service.analyzeMessageHistory(messages)).rejects.toThrow('Failed to parse personality traits');
    });
  });

  describe('calculateTrustworthiness', () => {
    it('should calculate trustworthiness score with correct weights', async () => {
      const traits: BigFiveTraits = {
        conscientiousness: 80,  // 40% weight = 32 points
        neuroticism: 20,        // 25% weight, inverted = (100-20)*0.25 = 20 points
        agreeableness: 70,      // 20% weight = 14 points
        openness: 60,           // 10% weight = 6 points
        extraversion: 50,       // 5% weight = 2.5 points
        confidence: 85
      };

      const result = await service.calculateTrustworthiness(traits);

      // Expected: 32 + 20 + 14 + 6 + 2.5 = 74.5, rounded to 75
      expect(result.score).toBe(75);
      expect(result.traits).toEqual(traits);
      expect(result.confidenceLevel).toBe(85);
      expect(result.lastUpdated).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle edge case scores', async () => {
      const traits: BigFiveTraits = {
        conscientiousness: 100,
        neuroticism: 0,
        agreeableness: 100,
        openness: 100,
        extraversion: 100,
        confidence: 100
      };

      const result = await service.calculateTrustworthiness(traits);

      // Should be close to 100 but capped
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThan(90);
    });

    it('should ensure score is within valid range', async () => {
      const traits: BigFiveTraits = {
        conscientiousness: 0,
        neuroticism: 100,
        agreeableness: 0,
        openness: 0,
        extraversion: 0,
        confidence: 50
      };

      const result = await service.calculateTrustworthiness(traits);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('explainScore', () => {
    it('should provide detailed score explanation', async () => {
      const trustScore = {
        score: 75,
        traits: {
          conscientiousness: 80,
          neuroticism: 20,
          agreeableness: 70,
          openness: 60,
          extraversion: 50,
          confidence: 85
        },
        confidenceLevel: 85,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      const explanation = await service.explainScore(trustScore);

      expect(explanation.overallScore).toBe(75);
      expect(explanation.traitContributions).toHaveLength(5);
      
      // Check conscientiousness contribution (highest weight)
      const conscientiousnessContrib = explanation.traitContributions.find(t => t.trait === 'conscientiousness');
      expect(conscientiousnessContrib?.weight).toBe(0.40);
      expect(conscientiousnessContrib?.contribution).toBe(32); // 80 * 0.40

      // Check neuroticism contribution (inverted)
      const neuroticismContrib = explanation.traitContributions.find(t => t.trait === 'neuroticism');
      expect(neuroticismContrib?.weight).toBe(0.25);
      expect(neuroticismContrib?.contribution).toBe(20); // (100-20) * 0.25

      expect(explanation.confidenceFactors).toBeInstanceOf(Array);
      expect(explanation.recommendations).toBeInstanceOf(Array);
    });

    it('should provide appropriate recommendations based on score', async () => {
      const highScoreTrust = {
        score: 85,
        traits: {
          conscientiousness: 90,
          neuroticism: 10,
          agreeableness: 80,
          openness: 70,
          extraversion: 60,
          confidence: 90
        },
        confidenceLevel: 90,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      const explanation = await service.explainScore(highScoreTrust);
      
      expect(explanation.recommendations.some(r => r.includes('standard loan terms'))).toBe(true);
    });

    it('should suggest alternatives for low scores', async () => {
      const lowScoreTrust = {
        score: 40,
        traits: {
          conscientiousness: 30,
          neuroticism: 80,
          agreeableness: 40,
          openness: 50,
          extraversion: 30,
          confidence: 60
        },
        confidenceLevel: 60,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      const explanation = await service.explainScore(lowScoreTrust);
      
      expect(explanation.recommendations.some(r => r.includes('Alternative verification'))).toBe(true);
    });
  });

  describe('createMessageHistoryHash', () => {
    it('should create consistent hash for same messages', () => {
      const messages = ['Hello world', 'How are you?'];
      
      const hash1 = service.createMessageHistoryHash(messages);
      const hash2 = service.createMessageHistoryHash(messages);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string length
    });

    it('should create different hashes for different messages', () => {
      const messages1 = ['Hello world'];
      const messages2 = ['Goodbye world'];
      
      const hash1 = service.createMessageHistoryHash(messages1);
      const hash2 = service.createMessageHistoryHash(messages2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('createClaudeIntegrationService', () => {
  it('should create service with environment variables', async () => {
    // Mock environment variables
    process.env.CLAUDE_API_KEY = 'test-key';
    process.env.CLAUDE_MAX_RETRIES = '5';
    process.env.CLAUDE_RETRY_DELAY = '2000';
    process.env.CLAUDE_TIMEOUT = '60000';

    const { createClaudeIntegrationService } = await import('../services/ai-trustworthiness.js');
    const service = createClaudeIntegrationService();

    expect(service).toBeInstanceOf(ClaudeIntegrationService);
  });

  it('should throw error if API key is missing', async () => {
    delete process.env.CLAUDE_API_KEY;

    const { createClaudeIntegrationService } = await import('../services/ai-trustworthiness.js');
    expect(() => {
      createClaudeIntegrationService();
    }).toThrow('CLAUDE_API_KEY environment variable is required');
  });
});