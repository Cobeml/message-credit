import { describe, it, expect } from 'vitest';
import { ClaudeIntegrationService } from '../services/ai-trustworthiness.js';
import { BigFiveTraits } from '../types/index.js';

describe('ClaudeIntegrationService - Core Logic', () => {
  let service: ClaudeIntegrationService;

  // Create service with test config
  service = new ClaudeIntegrationService({
    apiKey: 'test-api-key',
    maxRetries: 2,
    retryDelay: 100,
    timeout: 5000
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

  describe('analyzeMessageHistory - input validation', () => {
    it('should throw error for empty message history', async () => {
      await expect(service.analyzeMessageHistory([])).rejects.toThrow('Message history cannot be empty');
    });
  });
});

describe('createClaudeIntegrationService', () => {
  it('should throw error if API key is missing', async () => {
    const originalKey = process.env.CLAUDE_API_KEY;
    delete process.env.CLAUDE_API_KEY;

    const { createClaudeIntegrationService } = await import('../services/ai-trustworthiness.js');
    expect(() => {
      createClaudeIntegrationService();
    }).toThrow('CLAUDE_API_KEY environment variable is required');

    // Restore original key
    if (originalKey) {
      process.env.CLAUDE_API_KEY = originalKey;
    }
  });
});