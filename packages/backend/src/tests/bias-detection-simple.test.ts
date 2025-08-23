import { describe, it, expect } from 'vitest';
import { BiasDetectionService, DemographicData } from '../services/bias-detection.js';
import { AIAnalysis, BiasFlag } from '../types/index.js';

describe('BiasDetectionService - Core Functionality', () => {
  let service: BiasDetectionService;

  service = new BiasDetectionService(3);

  describe('Demographic Parity Monitoring', () => {
    it('should detect bias when groups have significantly different outcomes', async () => {
      const analyses: AIAnalysis[] = [
        // Group A - all high scores (>= 70)
        createAnalysis('user-a-1', 85),
        createAnalysis('user-a-2', 80),
        createAnalysis('user-a-3', 75),
        // Group B - all low scores (< 70)
        createAnalysis('user-b-1', 60),
        createAnalysis('user-b-2', 55),
        createAnalysis('user-b-3', 65)
      ];

      const demographicData = new Map<string, DemographicData>();
      demographicData.set('user-a-1', { gender: 'M' });
      demographicData.set('user-a-2', { gender: 'M' });
      demographicData.set('user-a-3', { gender: 'M' });
      demographicData.set('user-b-1', { gender: 'F' });
      demographicData.set('user-b-2', { gender: 'F' });
      demographicData.set('user-b-3', { gender: 'F' });

      const result = await service.detectBias(analyses, demographicData);

      expect(result.hasBias).toBe(true);
      expect(result.biasFlags.length).toBeGreaterThan(0);
      expect(result.fairnessMetrics.demographicParity).toBeLessThan(0.5);
    });

    it('should not detect bias when groups have similar outcomes', async () => {
      const analyses: AIAnalysis[] = [
        // Group A - mixed scores
        createAnalysis('user-a-1', 75),
        createAnalysis('user-a-2', 72),
        createAnalysis('user-a-3', 68),
        // Group B - similar mixed scores
        createAnalysis('user-b-1', 74),
        createAnalysis('user-b-2', 71),
        createAnalysis('user-b-3', 69)
      ];

      const demographicData = new Map<string, DemographicData>();
      demographicData.set('user-a-1', { gender: 'M' });
      demographicData.set('user-a-2', { gender: 'M' });
      demographicData.set('user-a-3', { gender: 'M' });
      demographicData.set('user-b-1', { gender: 'F' });
      demographicData.set('user-b-2', { gender: 'F' });
      demographicData.set('user-b-3', { gender: 'F' });

      const result = await service.detectBias(analyses, demographicData);

      expect(result.hasBias).toBe(false);
      expect(result.fairnessMetrics.demographicParity).toBeGreaterThan(0.8);
    });
  });

  describe('Bias Mitigation System', () => {
    it('should apply corrections for high-severity bias', async () => {
      const originalAnalysis = createAnalysis('user-1', 60);
      const biasFlags: BiasFlag[] = [{
        id: 'test-flag',
        type: 'demographic_parity',
        severity: 'high',
        description: 'High severity bias detected',
        mitigationApplied: false,
        flaggedAt: new Date()
      }];

      const demographicData: DemographicData = { gender: 'F', income: 25000 };
      
      const result = await service.mitigateBias(originalAnalysis, demographicData, biasFlags);

      expect(result.mitigatedAnalysis.trustworthinessScore).toBeGreaterThan(originalAnalysis.trustworthinessScore);
      expect(result.mitigationLog.length).toBeGreaterThan(0);
      expect(biasFlags[0].mitigationApplied).toBe(true);
    });

    it('should not exceed score boundaries during mitigation', async () => {
      const highScoreAnalysis = createAnalysis('user-1', 95);
      const biasFlags: BiasFlag[] = [{
        id: 'test-flag',
        type: 'demographic_parity',
        severity: 'high',
        description: 'High severity bias detected',
        mitigationApplied: false,
        flaggedAt: new Date()
      }];

      const result = await service.mitigateBias(highScoreAnalysis, { gender: 'F' }, biasFlags);

      expect(result.mitigatedAnalysis.trustworthinessScore).toBeLessThanOrEqual(100);
      expect(result.mitigatedAnalysis.trustworthinessScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Audit Trail System', () => {
    it('should create audit logs for bias detection', async () => {
      const analyses: AIAnalysis[] = [
        createAnalysis('user-1', 80),
        createAnalysis('user-2', 60)
      ];

      const demographicData = new Map<string, DemographicData>();
      demographicData.set('user-1', { gender: 'M' });
      demographicData.set('user-2', { gender: 'F' });

      const result = await service.detectBias(analyses, demographicData);

      expect(result.auditTrail.length).toBeGreaterThan(0);
      
      const startLog = result.auditTrail.find(log => log.action === 'BIAS_DETECTION_START');
      const endLog = result.auditTrail.find(log => log.action === 'BIAS_DETECTION_COMPLETE');
      
      expect(startLog).toBeDefined();
      expect(endLog).toBeDefined();
    });

    it('should log mitigation actions', async () => {
      const analysis = createAnalysis('user-1', 60);
      const biasFlags: BiasFlag[] = [{
        id: 'test-flag',
        type: 'demographic_parity',
        severity: 'high',
        description: 'Test bias flag',
        mitigationApplied: false,
        flaggedAt: new Date()
      }];

      const result = await service.mitigateBias(analysis, { gender: 'F' }, biasFlags);

      const mitigationLogs = result.mitigationLog.filter(log => 
        log.action.includes('CORRECTION') || log.action.includes('MITIGATION')
      );
      
      expect(mitigationLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Fairness Metrics Calculation', () => {
    it('should calculate fairness metrics', async () => {
      const analyses: AIAnalysis[] = [
        // Group M - 3 samples
        createAnalysis('user-m-1', 75),
        createAnalysis('user-m-2', 74),
        createAnalysis('user-m-3', 73),
        // Group F - 3 samples
        createAnalysis('user-f-1', 76),
        createAnalysis('user-f-2', 72),
        createAnalysis('user-f-3', 74)
      ];

      const demographicData = new Map<string, DemographicData>();
      demographicData.set('user-m-1', { gender: 'M' });
      demographicData.set('user-m-2', { gender: 'M' });
      demographicData.set('user-m-3', { gender: 'M' });
      demographicData.set('user-f-1', { gender: 'F' });
      demographicData.set('user-f-2', { gender: 'F' });
      demographicData.set('user-f-3', { gender: 'F' });

      const result = await service.detectBias(analyses, demographicData);

      expect(result.fairnessMetrics.overallFairness).toBeGreaterThan(0);
      expect(result.fairnessMetrics.overallFairness).toBeLessThanOrEqual(1.0);
      expect(result.fairnessMetrics.sampleSize).toBe(6);
      expect(result.fairnessMetrics.timestamp).toBeInstanceOf(Date);
    });

    it('should handle empty data gracefully', async () => {
      const result = await service.detectBias([], new Map());

      expect(result.fairnessMetrics.overallFairness).toBe(1.0);
      expect(result.fairnessMetrics.sampleSize).toBe(0);
      expect(result.hasBias).toBe(false);
    });
  });

  describe('Recommended Actions Generation', () => {
    it('should generate actions based on bias severity', async () => {
      const analyses: AIAnalysis[] = [
        createAnalysis('user-1', 90),
        createAnalysis('user-2', 40)
      ];

      const demographicData = new Map<string, DemographicData>();
      demographicData.set('user-1', { gender: 'M' });
      demographicData.set('user-2', { gender: 'F' });

      const result = await service.detectBias(analyses, demographicData);

      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.recommendedActions.some(action => 
        action.includes('bias') || action.includes('fairness')
      )).toBe(true);
    });
  });
});

// Helper function to create test analysis
function createAnalysis(userId: string, score: number): AIAnalysis {
  return {
    id: `analysis-${userId}`,
    userId,
    messageHistoryHash: `hash-${userId}`,
    bigFiveTraits: {
      conscientiousness: score * 0.8,
      neuroticism: 100 - score,
      agreeableness: score * 0.9,
      openness: score * 0.7,
      extraversion: score * 0.6,
      confidence: 85
    },
    trustworthinessScore: score,
    confidenceLevel: 85,
    biasFlags: [],
    analysisDate: new Date(),
    modelVersion: 'test-v1',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isActive: true
  };
}