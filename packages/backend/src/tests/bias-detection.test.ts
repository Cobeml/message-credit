import { describe, it, expect } from 'vitest';
import { BiasDetectionService, DemographicData, GroupStatistics } from '../services/bias-detection.js';
import { AIAnalysis, BiasFlag } from '../types/index.js';

describe('BiasDetectionService', () => {
  let service: BiasDetectionService;

  // Create service instance with smaller minimum sample size for testing
  service = new BiasDetectionService(3);

  describe('Demographic Parity Monitoring', () => {
    it('should detect demographic parity violations', async () => {
      // Create mock analyses with bias
      const analyses: AIAnalysis[] = [
        // Male group - higher scores (all >= 70)
        ...createMockAnalyses('male', [85, 80, 75, 82, 78], 'M'),
        // Female group - lower scores (all < 70)
        ...createMockAnalyses('female', [65, 60, 55, 62, 58], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      expect(result.hasBias).toBe(true);
      expect(result.biasFlags.some(f => f.type === 'demographic_parity')).toBe(true);
      expect(result.fairnessMetrics.demographicParity).toBeLessThan(0.9);
    });

    it('should not flag bias when groups have similar outcomes', async () => {
      // Create mock analyses without bias
      const analyses: AIAnalysis[] = [
        ...createMockAnalyses('male', [75, 72, 78, 74, 76], 'M'),
        ...createMockAnalyses('female', [74, 71, 77, 73, 75], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      expect(result.hasBias).toBe(false);
      expect(result.fairnessMetrics.demographicParity).toBeGreaterThan(0.9);
    });

    it('should handle multiple demographic dimensions', async () => {
      const analyses: AIAnalysis[] = [
        // Young males - high scores
        ...createMockAnalyses('young-male', [85, 80, 82], 'M', 25),
        // Older females - low scores
        ...createMockAnalyses('older-female', [60, 55, 58], 'F', 55),
        // Young females - medium scores
        ...createMockAnalyses('young-female', [70, 68, 72], 'F', 25)
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      // Should detect bias in both gender and age dimensions
      const genderBias = result.biasFlags.some(f => f.description.includes('gender'));
      const ageBias = result.biasFlags.some(f => f.description.includes('age'));
      
      expect(genderBias || ageBias).toBe(true);
    });
  });

  describe('Bias Flag Detection and Severity Assessment', () => {
    it('should assign correct severity levels', async () => {
      const analyses: AIAnalysis[] = [
        // Group 1 - very high scores (severe bias)
        ...createMockAnalyses('group1', [95, 90, 92, 88, 94], 'M'),
        // Group 2 - very low scores
        ...createMockAnalyses('group2', [45, 40, 42, 38, 44], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      const highSeverityFlags = result.biasFlags.filter(f => f.severity === 'high');
      expect(highSeverityFlags.length).toBeGreaterThan(0);
    });

    it('should create appropriate bias flag descriptions', async () => {
      const analyses: AIAnalysis[] = [
        ...createMockAnalyses('group1', [80, 75, 78], 'M'),
        ...createMockAnalyses('group2', [60, 55, 58], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      const parityFlag = result.biasFlags.find(f => f.type === 'demographic_parity');
      expect(parityFlag?.description).toContain('gender');
      expect(parityFlag?.description).toContain('%');
    });

    it('should detect calibration issues', async () => {
      const analyses: AIAnalysis[] = [
        // Group with high variance (calibration issue)
        ...createMockAnalyses('high-variance', [95, 30, 85, 25, 90, 35, 80, 40], 'M'),
        // Group with normal variance
        ...createMockAnalyses('normal-variance', [75, 72, 78, 74, 76, 73, 77, 71], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      const calibrationFlag = result.biasFlags.find(f => f.type === 'calibration');
      expect(calibrationFlag).toBeDefined();
      expect(calibrationFlag?.description).toContain('variance');
    });
  });

  describe('Bias Mitigation System', () => {
    it('should apply strong correction for high-severity bias', async () => {
      const originalAnalysis: AIAnalysis = createSingleAnalysis('user1', 60);
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

    it('should apply moderate correction for medium-severity bias', async () => {
      const originalAnalysis: AIAnalysis = createSingleAnalysis('user1', 65);
      const biasFlags: BiasFlag[] = [{
        id: 'test-flag',
        type: 'demographic_parity',
        severity: 'medium',
        description: 'Medium severity bias detected',
        mitigationApplied: false,
        flaggedAt: new Date()
      }];

      const demographicData: DemographicData = { gender: 'F' };
      
      const result = await service.mitigateBias(originalAnalysis, demographicData, biasFlags);

      const adjustment = result.mitigatedAnalysis.trustworthinessScore - originalAnalysis.trustworthinessScore;
      expect(adjustment).toBeGreaterThan(0);
      expect(adjustment).toBeLessThan(10); // Should be moderate adjustment
    });

    it('should not exceed score boundaries during mitigation', async () => {
      const highScoreAnalysis: AIAnalysis = createSingleAnalysis('user1', 95);
      const lowScoreAnalysis: AIAnalysis = createSingleAnalysis('user2', 5);
      
      const biasFlags: BiasFlag[] = [{
        id: 'test-flag',
        type: 'demographic_parity',
        severity: 'high',
        description: 'High severity bias detected',
        mitigationApplied: false,
        flaggedAt: new Date()
      }];

      const demographicData: DemographicData = { gender: 'F' };

      const highResult = await service.mitigateBias(highScoreAnalysis, demographicData, biasFlags);
      const lowResult = await service.mitigateBias(lowScoreAnalysis, demographicData, biasFlags);

      expect(highResult.mitigatedAnalysis.trustworthinessScore).toBeLessThanOrEqual(100);
      expect(lowResult.mitigatedAnalysis.trustworthinessScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Audit Trail System', () => {
    it('should create comprehensive audit logs', async () => {
      const analyses: AIAnalysis[] = [
        ...createMockAnalyses('group1', [80, 75], 'M'),
        ...createMockAnalyses('group2', [60, 55], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      expect(result.auditTrail.length).toBeGreaterThan(0);
      
      const startLog = result.auditTrail.find(log => log.action === 'BIAS_DETECTION_START');
      const endLog = result.auditTrail.find(log => log.action === 'BIAS_DETECTION_COMPLETE');
      
      expect(startLog).toBeDefined();
      expect(endLog).toBeDefined();
      expect(startLog?.timestamp).toBeInstanceOf(Date);
    });

    it('should log mitigation actions', async () => {
      const analysis: AIAnalysis = createSingleAnalysis('user1', 60);
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
      
      const correctionLog = mitigationLogs.find(log => log.action === 'STRONG_BIAS_CORRECTION');
      expect(correctionLog?.newValues).toHaveProperty('originalScore');
      expect(correctionLog?.newValues).toHaveProperty('adjustedScore');
    });
  });

  describe('Fairness Metrics Calculation', () => {
    it('should calculate demographic parity metrics correctly', async () => {
      const analyses: AIAnalysis[] = [
        // Group 1: 80% positive rate (4/5 >= 70)
        ...createMockAnalyses('group1', [75, 72, 78, 74, 65], 'M'),
        // Group 2: 40% positive rate (2/5 >= 70)  
        ...createMockAnalyses('group2', [75, 65, 60, 68, 72], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      // Demographic parity should reflect the 40% difference
      expect(result.fairnessMetrics.demographicParity).toBeLessThan(0.7);
      expect(result.fairnessMetrics.sampleSize).toBe(10);
    });

    it('should calculate overall fairness score', async () => {
      const analyses: AIAnalysis[] = [
        ...createMockAnalyses('group1', [75, 74, 76], 'M'),
        ...createMockAnalyses('group2', [74, 73, 75], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      expect(result.fairnessMetrics.overallFairness).toBeGreaterThan(0.8);
      expect(result.fairnessMetrics.overallFairness).toBeLessThanOrEqual(1.0);
    });

    it('should handle empty data gracefully', async () => {
      const result = await service.detectBias([], new Map());

      expect(result.fairnessMetrics.overallFairness).toBe(1.0);
      expect(result.fairnessMetrics.sampleSize).toBe(0);
      expect(result.hasBias).toBe(false);
    });
  });

  describe('Recommended Actions Generation', () => {
    it('should generate urgent actions for high-severity bias', async () => {
      const analyses: AIAnalysis[] = [
        ...createMockAnalyses('group1', [95, 90, 92], 'M'),
        ...createMockAnalyses('group2', [45, 40, 42], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      const urgentAction = result.recommendedActions.find(action => 
        action.includes('URGENT') || action.includes('immediate')
      );
      expect(urgentAction).toBeDefined();
    });

    it('should suggest monitoring for medium-severity bias', async () => {
      const analyses: AIAnalysis[] = [
        ...createMockAnalyses('group1', [78, 75, 80], 'M'),
        ...createMockAnalyses('group2', [65, 62, 68], 'F')
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      const monitoringAction = result.recommendedActions.find(action => 
        action.includes('monitoring') || action.includes('Medium-severity')
      );
      expect(monitoringAction).toBeDefined();
    });

    it('should suggest data collection for small samples', async () => {
      const analyses: AIAnalysis[] = [
        ...createMockAnalyses('group1', [75, 70], 'M'), // Only 2 samples
        ...createMockAnalyses('group2', [65, 60], 'F')  // Only 2 samples
      ];

      const demographicData = createDemographicData(analyses);
      const result = await service.detectBias(analyses, demographicData);

      const dataCollectionAction = result.recommendedActions.find(action => 
        action.includes('Sample size') || action.includes('more data')
      );
      expect(dataCollectionAction).toBeDefined();
    });
  });
});

// Helper functions for creating test data

function createMockAnalyses(
  groupPrefix: string, 
  scores: number[], 
  gender: string, 
  age: number = 30
): AIAnalysis[] {
  return scores.map((score, index) => ({
    id: `${groupPrefix}-${index}`,
    userId: `user-${groupPrefix}-${index}`,
    messageHistoryHash: `hash-${groupPrefix}-${index}`,
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
  }));
}

function createSingleAnalysis(userId: string, score: number): AIAnalysis {
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

function createDemographicData(analyses: AIAnalysis[]): Map<string, DemographicData> {
  const demographicData = new Map<string, DemographicData>();
  
  analyses.forEach(analysis => {
    // Extract gender from the group prefix in the userId
    let gender = 'M'; // default
    if (analysis.userId.includes('male') && !analysis.userId.includes('female')) {
      gender = 'M';
    } else if (analysis.userId.includes('female')) {
      gender = 'F';
    } else if (analysis.userId.includes('-m-') || analysis.userId.includes('user-m-')) {
      gender = 'M';
    } else if (analysis.userId.includes('-f-') || analysis.userId.includes('user-f-')) {
      gender = 'F';
    } else if (analysis.userId.includes('group1')) {
      gender = 'M';
    } else if (analysis.userId.includes('group2')) {
      gender = 'F';
    }
    
    const age = analysis.userId.includes('young') ? 25 : 
                analysis.userId.includes('older') ? 55 : 30;
    const income = gender === 'M' ? 60000 : 45000; // Simulate income gap
    
    demographicData.set(analysis.userId, {
      gender,
      age,
      income,
      ethnicity: 'test',
      education: 'bachelor'
    });
  });
  
  return demographicData;
}