import { describe, it, expect } from 'vitest';
import { BiasDetectionService } from '../services/bias-detection.js';
import { AIAnalysis } from '../types/index.js';

describe('BiasDetectionService - Debug', () => {
  let service: BiasDetectionService;

  service = new BiasDetectionService(3);

  it('should debug bias detection logic', async () => {
    // Create simple test data with clear bias
    const analyses: AIAnalysis[] = [
      // Male group - high scores
      {
        id: 'male-1',
        userId: 'user-male-1',
        messageHistoryHash: 'hash-male-1',
        bigFiveTraits: {
          conscientiousness: 80,
          neuroticism: 20,
          agreeableness: 75,
          openness: 70,
          extraversion: 60,
          confidence: 85
        },
        trustworthinessScore: 85,
        confidenceLevel: 85,
        biasFlags: [],
        analysisDate: new Date(),
        modelVersion: 'test-v1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      },
      {
        id: 'male-2',
        userId: 'user-male-2',
        messageHistoryHash: 'hash-male-2',
        bigFiveTraits: {
          conscientiousness: 75,
          neuroticism: 25,
          agreeableness: 70,
          openness: 65,
          extraversion: 55,
          confidence: 80
        },
        trustworthinessScore: 80,
        confidenceLevel: 80,
        biasFlags: [],
        analysisDate: new Date(),
        modelVersion: 'test-v1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      },
      {
        id: 'male-3',
        userId: 'user-male-3',
        messageHistoryHash: 'hash-male-3',
        bigFiveTraits: {
          conscientiousness: 78,
          neuroticism: 22,
          agreeableness: 72,
          openness: 68,
          extraversion: 58,
          confidence: 82
        },
        trustworthinessScore: 78,
        confidenceLevel: 82,
        biasFlags: [],
        analysisDate: new Date(),
        modelVersion: 'test-v1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      },
      // Female group - low scores
      {
        id: 'female-1',
        userId: 'user-female-1',
        messageHistoryHash: 'hash-female-1',
        bigFiveTraits: {
          conscientiousness: 50,
          neuroticism: 60,
          agreeableness: 65,
          openness: 55,
          extraversion: 45,
          confidence: 70
        },
        trustworthinessScore: 60,
        confidenceLevel: 70,
        biasFlags: [],
        analysisDate: new Date(),
        modelVersion: 'test-v1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      },
      {
        id: 'female-2',
        userId: 'user-female-2',
        messageHistoryHash: 'hash-female-2',
        bigFiveTraits: {
          conscientiousness: 45,
          neuroticism: 65,
          agreeableness: 60,
          openness: 50,
          extraversion: 40,
          confidence: 65
        },
        trustworthinessScore: 55,
        confidenceLevel: 65,
        biasFlags: [],
        analysisDate: new Date(),
        modelVersion: 'test-v1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      },
      {
        id: 'female-3',
        userId: 'user-female-3',
        messageHistoryHash: 'hash-female-3',
        bigFiveTraits: {
          conscientiousness: 48,
          neuroticism: 62,
          agreeableness: 62,
          openness: 52,
          extraversion: 42,
          confidence: 68
        },
        trustworthinessScore: 58,
        confidenceLevel: 68,
        biasFlags: [],
        analysisDate: new Date(),
        modelVersion: 'test-v1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      }
    ];

    // Create demographic data
    const demographicData = new Map();
    demographicData.set('user-male-1', { gender: 'M' });
    demographicData.set('user-male-2', { gender: 'M' });
    demographicData.set('user-male-3', { gender: 'M' });
    demographicData.set('user-female-1', { gender: 'F' });
    demographicData.set('user-female-2', { gender: 'F' });
    demographicData.set('user-female-3', { gender: 'F' });

    const result = await service.detectBias(analyses, demographicData);

    console.log('Bias detection result:', {
      hasBias: result.hasBias,
      biasFlags: result.biasFlags,
      fairnessMetrics: result.fairnessMetrics,
      recommendedActions: result.recommendedActions
    });

    // Male group: 3/3 scores >= 70 (100% positive rate)
    // Female group: 0/3 scores >= 70 (0% positive rate)
    // This should definitely trigger bias detection

    expect(result.hasBias).toBe(true);
  });
});