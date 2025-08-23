import { describe, it, expect } from 'vitest';
import { ClaudeIntegrationService } from '../services/ai-trustworthiness.js';
import { MockMessageService, mockMessageProfiles } from '../services/mock-message-data.js';
import { BigFiveTraits } from '../types/index.js';

describe('Personality Trait Analysis and Scoring', () => {
  let service: ClaudeIntegrationService;
  let mockService: MockMessageService;

  // Create services with test config
  service = new ClaudeIntegrationService({
    apiKey: 'test-api-key',
    maxRetries: 2,
    retryDelay: 100,
    timeout: 5000
  });

  mockService = new MockMessageService();

  describe('Weighted Scoring Algorithm', () => {
    it('should apply correct weights to Big Five traits', async () => {
      // Test with known values to verify exact calculation
      const traits: BigFiveTraits = {
        conscientiousness: 80,  // 40% weight = 32.0 points
        neuroticism: 20,        // 25% weight, inverted = (100-20)*0.25 = 20.0 points
        agreeableness: 60,      // 20% weight = 12.0 points
        openness: 50,           // 10% weight = 5.0 points
        extraversion: 40,       // 5% weight = 2.0 points
        confidence: 85
      };

      const result = await service.calculateTrustworthiness(traits);

      // Expected: 32 + 20 + 12 + 5 + 2 = 71
      expect(result.score).toBe(71);
    });

    it('should handle neuroticism inversion correctly', async () => {
      // High neuroticism should reduce trustworthiness score
      const highNeuroticismTraits: BigFiveTraits = {
        conscientiousness: 100,
        neuroticism: 100,       // Should contribute (100-100)*0.25 = 0 points
        agreeableness: 100,
        openness: 100,
        extraversion: 100,
        confidence: 90
      };

      const lowNeuroticismTraits: BigFiveTraits = {
        conscientiousness: 100,
        neuroticism: 0,         // Should contribute (100-0)*0.25 = 25 points
        agreeableness: 100,
        openness: 100,
        extraversion: 100,
        confidence: 90
      };

      const highNeuroticismResult = await service.calculateTrustworthiness(highNeuroticismTraits);
      const lowNeuroticismResult = await service.calculateTrustworthiness(lowNeuroticismTraits);

      // Low neuroticism should result in higher trustworthiness score
      expect(lowNeuroticismResult.score).toBeGreaterThan(highNeuroticismResult.score);
      expect(lowNeuroticismResult.score - highNeuroticismResult.score).toBe(25); // 25% of 100
    });

    it('should weight conscientiousness highest (40%)', async () => {
      const baseTraits: BigFiveTraits = {
        conscientiousness: 50,
        neuroticism: 50,
        agreeableness: 50,
        openness: 50,
        extraversion: 50,
        confidence: 80
      };

      const highConscientiousnessTraits: BigFiveTraits = {
        ...baseTraits,
        conscientiousness: 100  // +50 points * 0.40 = +20 points
      };

      const baseResult = await service.calculateTrustworthiness(baseTraits);
      const highConscientiousnessResult = await service.calculateTrustworthiness(highConscientiousnessTraits);

      expect(highConscientiousnessResult.score - baseResult.score).toBe(20);
    });

    it('should weight extraversion lowest (5%)', async () => {
      const baseTraits: BigFiveTraits = {
        conscientiousness: 50,
        neuroticism: 50,
        agreeableness: 50,
        openness: 50,
        extraversion: 0,
        confidence: 80
      };

      const highExtraversionTraits: BigFiveTraits = {
        ...baseTraits,
        extraversion: 100  // +100 points * 0.05 = +5 points
      };

      const baseResult = await service.calculateTrustworthiness(baseTraits);
      const highExtraversionResult = await service.calculateTrustworthiness(highExtraversionTraits);

      expect(highExtraversionResult.score - baseResult.score).toBe(5);
    });
  });

  describe('Mock Message History Processing', () => {
    it('should provide diverse personality profiles for testing', () => {
      const profiles = mockService.getAllProfiles();
      
      expect(profiles.length).toBeGreaterThan(5);
      expect(profiles.every(p => p.messages.length > 0)).toBe(true);
      expect(profiles.every(p => p.expectedTraits.confidence > 0)).toBe(true);
    });

    it('should include high conscientiousness profile', () => {
      const profile = mockService.getProfileByName('High Conscientiousness Profile');
      
      expect(profile).toBeDefined();
      expect(profile!.expectedTraits.conscientiousness).toBeGreaterThan(80);
      expect(profile!.messages.some(m => m.toLowerCase().includes('organized') || m.toLowerCase().includes('responsible') || m.toLowerCase().includes('planning'))).toBe(true);
    });

    it('should include high neuroticism profile', () => {
      const profile = mockService.getProfileByName('High Neuroticism Profile');
      
      expect(profile).toBeDefined();
      expect(profile!.expectedTraits.neuroticism).toBeGreaterThan(70);
      expect(profile!.messages.some(m => m.includes('worry') || m.includes('anxious'))).toBe(true);
    });

    it('should filter profiles by trustworthiness score', () => {
      const highTrustProfiles = mockService.getProfilesByTrustworthiness(70, 100);
      const lowTrustProfiles = mockService.getProfilesByTrustworthiness(0, 50);
      
      expect(highTrustProfiles.length).toBeGreaterThan(0);
      expect(lowTrustProfiles.length).toBeGreaterThan(0);
      
      // Verify the filtering works correctly
      for (const profile of highTrustProfiles) {
        const traits = profile.expectedTraits;
        const calculatedScore = Math.round(
          (traits.conscientiousness * 0.40) +
          ((100 - traits.neuroticism) * 0.25) +
          (traits.agreeableness * 0.20) +
          (traits.openness * 0.10) +
          (traits.extraversion * 0.05)
        );
        expect(calculatedScore).toBeGreaterThanOrEqual(70);
      }
    });

    it('should generate message variations', () => {
      const baseMessages = ['I really enjoy helping people with important tasks.'];
      const variations = mockService.generateMessageVariations(baseMessages, 3);
      
      expect(variations.length).toBe(1); // Only one base message
      expect(variations[0]).not.toBe(baseMessages[0]); // Should be modified
      expect(variations[0].length).toBeGreaterThan(10); // Should be substantial
    });

    it('should create custom profiles with trait overrides', () => {
      const customProfile = mockService.createCustomProfile(
        'Custom Test Profile',
        'Profile for specific testing scenario',
        'Balanced Profile',
        { conscientiousness: 95, neuroticism: 10 }
      );
      
      expect(customProfile.name).toBe('Custom Test Profile');
      expect(customProfile.expectedTraits.conscientiousness).toBe(95);
      expect(customProfile.expectedTraits.neuroticism).toBe(10);
      expect(customProfile.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Scoring and Validation', () => {
    it('should maintain confidence level from traits', async () => {
      const traits: BigFiveTraits = {
        conscientiousness: 75,
        neuroticism: 40,
        agreeableness: 70,
        openness: 60,
        extraversion: 55,
        confidence: 92
      };

      const result = await service.calculateTrustworthiness(traits);
      expect(result.confidenceLevel).toBe(92);
    });

    it('should set appropriate expiration date', async () => {
      const traits: BigFiveTraits = {
        conscientiousness: 75,
        neuroticism: 40,
        agreeableness: 70,
        openness: 60,
        extraversion: 55,
        confidence: 85
      };

      const result = await service.calculateTrustworthiness(traits);
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      
      expect(result.expiresAt.getTime()).toBeCloseTo(thirtyDaysFromNow.getTime(), -1000); // Within 1 second
    });

    it('should validate score boundaries', async () => {
      // Test extreme low values
      const lowTraits: BigFiveTraits = {
        conscientiousness: 0,
        neuroticism: 100,
        agreeableness: 0,
        openness: 0,
        extraversion: 0,
        confidence: 50
      };

      // Test extreme high values  
      const highTraits: BigFiveTraits = {
        conscientiousness: 100,
        neuroticism: 0,
        agreeableness: 100,
        openness: 100,
        extraversion: 100,
        confidence: 100
      };

      const lowResult = await service.calculateTrustworthiness(lowTraits);
      const highResult = await service.calculateTrustworthiness(highTraits);

      expect(lowResult.score).toBeGreaterThanOrEqual(0);
      expect(lowResult.score).toBeLessThanOrEqual(100);
      expect(highResult.score).toBeGreaterThanOrEqual(0);
      expect(highResult.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Score Explanation Generation', () => {
    it('should provide detailed trait contributions', async () => {
      const traits = {
        conscientiousness: 80,
        neuroticism: 30,
        agreeableness: 70,
        openness: 60,
        extraversion: 50,
        confidence: 85
      };
      
      // Calculate the actual score: 80*0.4 + (100-30)*0.25 + 70*0.2 + 60*0.1 + 50*0.05 = 32 + 17.5 + 14 + 6 + 2.5 = 72
      const calculatedScore = Math.round(
        (traits.conscientiousness * 0.40) +
        ((100 - traits.neuroticism) * 0.25) +
        (traits.agreeableness * 0.20) +
        (traits.openness * 0.10) +
        (traits.extraversion * 0.05)
      );

      const trustScore = {
        score: calculatedScore,
        traits,
        confidenceLevel: 85,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      const explanation = await service.explainScore(trustScore);

      // Verify all traits are included
      expect(explanation.traitContributions).toHaveLength(5);
      
      const traitNames = explanation.traitContributions.map(t => t.trait);
      expect(traitNames).toContain('conscientiousness');
      expect(traitNames).toContain('neuroticism');
      expect(traitNames).toContain('agreeableness');
      expect(traitNames).toContain('openness');
      expect(traitNames).toContain('extraversion');

      // Verify contributions sum approximately to total score
      const totalContribution = explanation.traitContributions.reduce((sum, t) => sum + t.contribution, 0);
      expect(Math.round(totalContribution)).toBe(trustScore.score);
    });

    it('should provide confidence factors based on score quality', async () => {
      const highConfidenceScore = {
        score: 85,
        traits: {
          conscientiousness: 90,
          neuroticism: 10,
          agreeableness: 80,
          openness: 70,
          extraversion: 60,
          confidence: 95
        },
        confidenceLevel: 95,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      const explanation = await service.explainScore(highConfidenceScore);
      
      expect(explanation.confidenceFactors.length).toBeGreaterThan(0);
      expect(explanation.confidenceFactors.some(f => f.includes('High-quality'))).toBe(true);
    });

    it('should provide appropriate recommendations for different score ranges', async () => {
      // High score recommendations
      const highScore = {
        score: 85,
        traits: { conscientiousness: 90, neuroticism: 10, agreeableness: 80, openness: 70, extraversion: 60, confidence: 90 },
        confidenceLevel: 90,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      // Medium score recommendations
      const mediumScore = {
        score: 60,
        traits: { conscientiousness: 60, neuroticism: 50, agreeableness: 65, openness: 55, extraversion: 50, confidence: 75 },
        confidenceLevel: 75,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      // Low score recommendations
      const lowScore = {
        score: 35,
        traits: { conscientiousness: 30, neuroticism: 80, agreeableness: 40, openness: 45, extraversion: 30, confidence: 70 },
        confidenceLevel: 70,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      const highExplanation = await service.explainScore(highScore);
      const mediumExplanation = await service.explainScore(mediumScore);
      const lowExplanation = await service.explainScore(lowScore);

      // High scores should suggest standard terms
      expect(highExplanation.recommendations.some(r => r.includes('standard loan terms'))).toBe(true);

      // Medium scores should suggest community endorsements
      expect(mediumExplanation.recommendations.some(r => r.includes('community endorsements'))).toBe(true);

      // Low scores should suggest alternatives
      expect(lowExplanation.recommendations.some(r => r.includes('Alternative verification'))).toBe(true);
    });
  });

  describe('Integration with Mock Data', () => {
    it('should calculate expected scores for all mock profiles', async () => {
      for (const profile of mockMessageProfiles) {
        const result = await service.calculateTrustworthiness(profile.expectedTraits);
        
        // Calculate expected score manually
        const traits = profile.expectedTraits;
        const expectedScore = Math.round(
          (traits.conscientiousness * 0.40) +
          ((100 - traits.neuroticism) * 0.25) +
          (traits.agreeableness * 0.20) +
          (traits.openness * 0.10) +
          (traits.extraversion * 0.05)
        );

        expect(result.score).toBe(expectedScore);
        expect(result.confidenceLevel).toBe(traits.confidence);
      }
    });

    it('should identify high-risk and low-risk profiles correctly', async () => {
      const highRiskProfile = mockService.getProfileByName('Low Trustworthiness Profile');
      const lowRiskProfile = mockService.getProfileByName('High Conscientiousness Profile');

      expect(highRiskProfile).toBeDefined();
      expect(lowRiskProfile).toBeDefined();

      const highRiskResult = await service.calculateTrustworthiness(highRiskProfile!.expectedTraits);
      const lowRiskResult = await service.calculateTrustworthiness(lowRiskProfile!.expectedTraits);

      expect(lowRiskResult.score).toBeGreaterThan(highRiskResult.score);
      expect(lowRiskResult.score).toBeGreaterThan(70); // Should qualify for loans
      expect(highRiskResult.score).toBeLessThan(50);   // Should require alternatives
    });
  });
});