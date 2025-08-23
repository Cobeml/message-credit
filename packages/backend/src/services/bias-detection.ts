import { BiasFlag, AIAnalysis, AuditLog } from '../types/index.js';

/**
 * Bias Detection and Mitigation Service
 * Requirements: 2.5, 2.6, 7.1, 7.2
 */

export interface DemographicData {
  age?: number;
  gender?: string;
  ethnicity?: string;
  location?: string;
  income?: number;
  education?: string;
}

export interface FairnessMetrics {
  demographicParity: number;        // Difference in positive rates between groups
  equalizedOdds: number;           // Difference in TPR and FPR between groups
  calibration: number;             // Difference in calibration between groups
  overallFairness: number;         // Combined fairness score
  sampleSize: number;              // Number of samples analyzed
  timestamp: Date;
}

export interface BiasDetectionResult {
  hasBias: boolean;
  biasFlags: BiasFlag[];
  fairnessMetrics: FairnessMetrics;
  recommendedActions: string[];
  auditTrail: AuditLog[];
}

export interface GroupStatistics {
  groupName: string;
  totalCount: number;
  positiveOutcomes: number;        // Scores >= 70
  averageScore: number;
  standardDeviation: number;
  truePositiveRate?: number;       // For validation data
  falsePositiveRate?: number;      // For validation data
}

export class BiasDetectionService {
  private readonly BIAS_THRESHOLD = 0.1;  // 10% difference threshold
  private readonly MIN_SAMPLE_SIZE: number;   // Minimum samples for reliable analysis

  constructor(minSampleSize: number = 30) {
    this.MIN_SAMPLE_SIZE = minSampleSize;
  }

  /**
   * Analyze AI analysis results for demographic bias
   * Requirements: 2.5, 7.1
   */
  async detectBias(
    analyses: AIAnalysis[],
    demographicData: Map<string, DemographicData>
  ): Promise<BiasDetectionResult> {
    const auditTrail: AuditLog[] = [];
    const biasFlags: BiasFlag[] = [];

    // Log the start of bias detection
    auditTrail.push(this.createAuditLog(
      'BIAS_DETECTION_START',
      'BiasDetection',
      'system',
      { analysisCount: analyses.length, demographicDataCount: demographicData.size }
    ));

    // Group analyses by demographic characteristics
    const demographicGroups = this.groupByDemographics(analyses, demographicData);
    
    // Calculate statistics for each group
    const groupStats = this.calculateGroupStatistics(demographicGroups);

    // Check for demographic parity violations
    const parityFlags = this.checkDemographicParity(groupStats);
    biasFlags.push(...parityFlags);

    // Check for equalized odds violations (if validation data available)
    const equalizedOddsFlags = this.checkEqualizedOdds(groupStats);
    biasFlags.push(...equalizedOddsFlags);

    // Check for calibration bias
    const calibrationFlags = this.checkCalibration(groupStats);
    biasFlags.push(...calibrationFlags);

    // Calculate overall fairness metrics
    const fairnessMetrics = this.calculateFairnessMetrics(groupStats);

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(biasFlags, fairnessMetrics);

    // Log bias detection results
    auditTrail.push(this.createAuditLog(
      'BIAS_DETECTION_COMPLETE',
      'BiasDetection',
      'system',
      { 
        biasDetected: biasFlags.length > 0,
        flagCount: biasFlags.length,
        fairnessScore: fairnessMetrics.overallFairness
      }
    ));

    return {
      hasBias: biasFlags.length > 0,
      biasFlags,
      fairnessMetrics,
      recommendedActions,
      auditTrail
    };
  }

  /**
   * Apply bias mitigation to AI analysis results
   * Requirements: 2.6, 7.2
   */
  async mitigateBias(
    analysis: AIAnalysis,
    demographicData: DemographicData,
    biasFlags: BiasFlag[]
  ): Promise<{ mitigatedAnalysis: AIAnalysis; mitigationLog: AuditLog[] }> {
    const mitigationLog: AuditLog[] = [];
    let mitigatedAnalysis = { ...analysis };

    mitigationLog.push(this.createAuditLog(
      'BIAS_MITIGATION_START',
      'AIAnalysis',
      analysis.id,
      { originalScore: analysis.trustworthinessScore, biasFlags: biasFlags.length }
    ));

    for (const flag of biasFlags) {
      if (flag.severity === 'high') {
        // Apply strong correction for high-severity bias
        mitigatedAnalysis = this.applyStrongCorrection(mitigatedAnalysis, flag, demographicData);
        
        mitigationLog.push(this.createAuditLog(
          'STRONG_BIAS_CORRECTION',
          'AIAnalysis',
          analysis.id,
          { 
            flagType: flag.type,
            originalScore: analysis.trustworthinessScore,
            adjustedScore: mitigatedAnalysis.trustworthinessScore
          }
        ));
      } else if (flag.severity === 'medium') {
        // Apply moderate correction for medium-severity bias
        mitigatedAnalysis = this.applyModerateCorrection(mitigatedAnalysis, flag, demographicData);
        
        mitigationLog.push(this.createAuditLog(
          'MODERATE_BIAS_CORRECTION',
          'AIAnalysis',
          analysis.id,
          { 
            flagType: flag.type,
            originalScore: analysis.trustworthinessScore,
            adjustedScore: mitigatedAnalysis.trustworthinessScore
          }
        ));
      }

      // Mark bias flag as mitigated
      flag.mitigationApplied = true;
      flag.mitigationDetails = `Applied ${flag.severity} correction for ${flag.type}`;
      flag.resolvedAt = new Date();
    }

    mitigationLog.push(this.createAuditLog(
      'BIAS_MITIGATION_COMPLETE',
      'AIAnalysis',
      analysis.id,
      { 
        originalScore: analysis.trustworthinessScore,
        finalScore: mitigatedAnalysis.trustworthinessScore,
        mitigationsApplied: biasFlags.length
      }
    ));

    return { mitigatedAnalysis, mitigationLog };
  }

  /**
   * Group analyses by demographic characteristics
   */
  private groupByDemographics(
    analyses: AIAnalysis[],
    demographicData: Map<string, DemographicData>
  ): Map<string, AIAnalysis[]> {
    const groups = new Map<string, AIAnalysis[]>();

    for (const analysis of analyses) {
      const demographic = demographicData.get(analysis.userId);
      if (!demographic) continue;

      // Create group keys based on demographic characteristics
      const groupKeys = this.createGroupKeys(demographic);
      
      for (const groupKey of groupKeys) {
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(analysis);
      }
    }

    return groups;
  }

  /**
   * Create group keys for demographic analysis
   */
  private createGroupKeys(demographic: DemographicData): string[] {
    const keys: string[] = [];

    if (demographic.gender) {
      keys.push(`gender:${demographic.gender}`);
    }
    
    if (demographic.age) {
      const ageGroup = this.getAgeGroup(demographic.age);
      keys.push(`age:${ageGroup}`);
    }

    if (demographic.ethnicity) {
      keys.push(`ethnicity:${demographic.ethnicity}`);
    }

    if (demographic.income) {
      const incomeGroup = this.getIncomeGroup(demographic.income);
      keys.push(`income:${incomeGroup}`);
    }

    if (demographic.education) {
      keys.push(`education:${demographic.education}`);
    }

    return keys;
  }

  /**
   * Calculate statistics for each demographic group
   */
  private calculateGroupStatistics(groups: Map<string, AIAnalysis[]>): GroupStatistics[] {
    const stats: GroupStatistics[] = [];

    for (const [groupName, analyses] of groups) {
      if (analyses.length < this.MIN_SAMPLE_SIZE) continue;

      const scores = analyses.map(a => a.trustworthinessScore);
      const positiveOutcomes = scores.filter(s => s >= 70).length;
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      // Calculate standard deviation
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scores.length;
      const standardDeviation = Math.sqrt(variance);

      stats.push({
        groupName,
        totalCount: analyses.length,
        positiveOutcomes,
        averageScore,
        standardDeviation
      });
    }

    return stats;
  }

  /**
   * Check for demographic parity violations
   */
  private checkDemographicParity(groupStats: GroupStatistics[]): BiasFlag[] {
    const flags: BiasFlag[] = [];
    
    // Group by demographic type (gender, age, etc.)
    const demographicTypes = new Map<string, GroupStatistics[]>();
    
    for (const stat of groupStats) {
      const [type] = stat.groupName.split(':');
      if (!demographicTypes.has(type)) {
        demographicTypes.set(type, []);
      }
      demographicTypes.get(type)!.push(stat);
    }

    for (const [type, groups] of demographicTypes) {
      if (groups.length < 2) continue;

      const positiveRates = groups.map(g => g.positiveOutcomes / g.totalCount);
      const maxRate = Math.max(...positiveRates);
      const minRate = Math.min(...positiveRates);
      const difference = maxRate - minRate;

      if (difference > this.BIAS_THRESHOLD) {
        const severity = difference > 0.2 ? 'high' : difference > 0.15 ? 'medium' : 'low';
        
        flags.push({
          id: `parity-${type}-${Date.now()}`,
          type: 'demographic_parity',
          severity,
          description: `Demographic parity violation in ${type}: ${(difference * 100).toFixed(1)}% difference in positive outcomes`,
          mitigationApplied: false,
          flaggedAt: new Date()
        });
      }
    }

    return flags;
  }

  /**
   * Check for equalized odds violations
   */
  private checkEqualizedOdds(groupStats: GroupStatistics[]): BiasFlag[] {
    const flags: BiasFlag[] = [];
    
    // This would require validation data with true outcomes
    // For now, we'll use a simplified check based on score distributions
    
    const demographicTypes = new Map<string, GroupStatistics[]>();
    
    for (const stat of groupStats) {
      const [type] = stat.groupName.split(':');
      if (!demographicTypes.has(type)) {
        demographicTypes.set(type, []);
      }
      demographicTypes.get(type)!.push(stat);
    }

    for (const [type, groups] of demographicTypes) {
      if (groups.length < 2) continue;

      const averageScores = groups.map(g => g.averageScore);
      const maxScore = Math.max(...averageScores);
      const minScore = Math.min(...averageScores);
      const difference = maxScore - minScore;

      if (difference > 10) { // 10-point difference threshold
        const severity = difference > 20 ? 'high' : difference > 15 ? 'medium' : 'low';
        
        flags.push({
          id: `equalized-odds-${type}-${Date.now()}`,
          type: 'equalized_odds',
          severity,
          description: `Equalized odds violation in ${type}: ${difference.toFixed(1)} point difference in average scores`,
          mitigationApplied: false,
          flaggedAt: new Date()
        });
      }
    }

    return flags;
  }

  /**
   * Check for calibration bias
   */
  private checkCalibration(groupStats: GroupStatistics[]): BiasFlag[] {
    const flags: BiasFlag[] = [];
    
    // Check for groups with unusually high or low variance
    for (const stat of groupStats) {
      if (stat.standardDeviation > 25) { // High variance threshold
        flags.push({
          id: `calibration-${stat.groupName}-${Date.now()}`,
          type: 'calibration',
          severity: 'medium',
          description: `High score variance in ${stat.groupName}: ${stat.standardDeviation.toFixed(1)} standard deviation`,
          mitigationApplied: false,
          flaggedAt: new Date()
        });
      }
    }

    return flags;
  }

  /**
   * Calculate overall fairness metrics
   */
  private calculateFairnessMetrics(groupStats: GroupStatistics[]): FairnessMetrics {
    if (groupStats.length === 0) {
      return {
        demographicParity: 1.0,
        equalizedOdds: 1.0,
        calibration: 1.0,
        overallFairness: 1.0,
        sampleSize: 0,
        timestamp: new Date()
      };
    }

    // Calculate demographic parity metric
    const positiveRates = groupStats.map(g => g.positiveOutcomes / g.totalCount);
    const parityRange = Math.max(...positiveRates) - Math.min(...positiveRates);
    const demographicParity = Math.max(0, 1 - parityRange);

    // Calculate equalized odds metric (simplified)
    const averageScores = groupStats.map(g => g.averageScore);
    const scoreRange = Math.max(...averageScores) - Math.min(...averageScores);
    const equalizedOdds = Math.max(0, 1 - (scoreRange / 100));

    // Calculate calibration metric
    const standardDeviations = groupStats.map(g => g.standardDeviation);
    const avgStdDev = standardDeviations.reduce((sum, std) => sum + std, 0) / standardDeviations.length;
    const calibration = Math.max(0, 1 - (avgStdDev / 50));

    // Calculate overall fairness score
    const overallFairness = (demographicParity + equalizedOdds + calibration) / 3;

    const totalSamples = groupStats.reduce((sum, stat) => sum + stat.totalCount, 0);

    return {
      demographicParity,
      equalizedOdds,
      calibration,
      overallFairness,
      sampleSize: totalSamples,
      timestamp: new Date()
    };
  }

  /**
   * Generate recommended actions based on bias detection results
   */
  private generateRecommendedActions(biasFlags: BiasFlag[], metrics: FairnessMetrics): string[] {
    const actions: string[] = [];

    if (biasFlags.length === 0) {
      actions.push('No bias detected. Continue monitoring fairness metrics.');
      return actions;
    }

    const highSeverityFlags = biasFlags.filter(f => f.severity === 'high');
    const mediumSeverityFlags = biasFlags.filter(f => f.severity === 'medium');

    if (highSeverityFlags.length > 0) {
      actions.push('URGENT: High-severity bias detected. Implement immediate corrections.');
      actions.push('Review and retrain AI model with bias mitigation techniques.');
      actions.push('Conduct manual review of affected user assessments.');
    }

    if (mediumSeverityFlags.length > 0) {
      actions.push('Medium-severity bias detected. Apply score adjustments.');
      actions.push('Increase monitoring frequency for affected demographic groups.');
    }

    if (metrics.overallFairness < 0.8) {
      actions.push('Overall fairness score is low. Consider model retraining.');
    }

    if (metrics.sampleSize < 100) {
      actions.push('Sample size is small. Collect more data for reliable bias detection.');
    }

    actions.push('Document all bias mitigation actions in audit trail.');
    actions.push('Schedule follow-up bias analysis within 30 days.');

    return actions;
  }

  /**
   * Apply strong bias correction
   */
  private applyStrongCorrection(
    analysis: AIAnalysis,
    flag: BiasFlag,
    demographic: DemographicData
  ): AIAnalysis {
    const corrected = { ...analysis };
    
    // Apply correction based on bias type
    if (flag.type === 'demographic_parity') {
      // Adjust score to reduce demographic disparity
      const adjustment = this.calculateParityAdjustment(demographic, flag.severity);
      corrected.trustworthinessScore = Math.min(100, Math.max(0, 
        corrected.trustworthinessScore + adjustment
      ));
    } else if (flag.type === 'equalized_odds') {
      // Adjust score to improve equalized odds
      const adjustment = this.calculateEqualizedOddsAdjustment(demographic, flag.severity);
      corrected.trustworthinessScore = Math.min(100, Math.max(0,
        corrected.trustworthinessScore + adjustment
      ));
    }

    return corrected;
  }

  /**
   * Apply moderate bias correction
   */
  private applyModerateCorrection(
    analysis: AIAnalysis,
    flag: BiasFlag,
    demographic: DemographicData
  ): AIAnalysis {
    const corrected = { ...analysis };
    
    // Apply smaller correction for moderate bias
    if (flag.type === 'demographic_parity') {
      const adjustment = this.calculateParityAdjustment(demographic, flag.severity) * 0.5;
      corrected.trustworthinessScore = Math.min(100, Math.max(0,
        corrected.trustworthinessScore + adjustment
      ));
    }

    return corrected;
  }

  /**
   * Calculate parity adjustment based on demographic data
   */
  private calculateParityAdjustment(demographic: DemographicData, severity: string): number {
    // This is a simplified adjustment - in practice, this would be based on
    // statistical analysis of bias patterns
    const baseAdjustment = severity === 'high' ? 5 : severity === 'medium' ? 3 : 1;
    
    // Apply demographic-specific adjustments (placeholder logic)
    let adjustment = baseAdjustment;
    
    if (demographic.income && demographic.income < 30000) {
      adjustment += 2; // Boost for low-income individuals
    }
    
    return adjustment;
  }

  /**
   * Calculate equalized odds adjustment
   */
  private calculateEqualizedOddsAdjustment(demographic: DemographicData, severity: string): number {
    const baseAdjustment = severity === 'high' ? 4 : severity === 'medium' ? 2 : 1;
    return baseAdjustment;
  }

  /**
   * Helper methods for demographic grouping
   */
  private getAgeGroup(age: number): string {
    if (age < 25) return '18-24';
    if (age < 35) return '25-34';
    if (age < 45) return '35-44';
    if (age < 55) return '45-54';
    if (age < 65) return '55-64';
    return '65+';
  }

  private getIncomeGroup(income: number): string {
    if (income < 25000) return 'low';
    if (income < 50000) return 'lower-middle';
    if (income < 75000) return 'middle';
    if (income < 100000) return 'upper-middle';
    return 'high';
  }

  /**
   * Create audit log entry
   */
  private createAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    details: any
  ): AuditLog {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      entityType,
      entityId,
      newValues: details,
      timestamp: new Date()
    };
  }
}

/**
 * Factory function to create bias detection service
 */
export function createBiasDetectionService(minSampleSize?: number): BiasDetectionService {
  return new BiasDetectionService(minSampleSize);
}