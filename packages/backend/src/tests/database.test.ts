// Database models and types tests

import { describe, it, expect } from 'vitest';
import { 
  type User, 
  type Community, 
  type Loan, 
  type AIAnalysis, 
  type BigFiveTraits,
  type TrustScore,
  LoanStatus,
  ProofType,
  ErrorCodes
} from '../types/index.js';

describe('Database Types and Models', () => {

  describe('TypeScript Types', () => {
    it('should have correct User interface structure', () => {
      const mockUser: User = {
        id: 'user_123',
        email: 'test@example.com',
        profile: {
          firstName: 'Test',
          lastName: 'User',
          languages: ['en'],
          digitalLiteracyLevel: 3,
          bankAccountVerified: true,
          identityVerified: true,
          preferredLoanTypes: ['education'],
          riskTolerance: 'medium'
        },
        communityMemberships: [],
        zkProofStatus: {
          hasTrustScoreProof: false,
          hasIncomeProof: false,
          hasIdentityProof: false,
          hasLoanHistoryProof: false,
          lastUpdated: new Date()
        },
        gdprConsent: {
          id: 'consent_123',
          userId: 'user_123',
          dataProcessingConsent: true,
          aiAnalysisConsent: true,
          marketingConsent: false,
          dataRetentionPeriod: 365,
          consentDate: new Date(),
          lastUpdated: new Date(),
          isActive: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockUser.id).toBe('user_123');
      expect(mockUser.profile.riskTolerance).toBe('medium');
      expect(mockUser.gdprConsent.dataProcessingConsent).toBe(true);
    });

    it('should have correct BigFiveTraits interface', () => {
      const traits: BigFiveTraits = {
        conscientiousness: 85,
        neuroticism: 25,
        agreeableness: 78,
        openness: 82,
        extraversion: 70,
        confidence: 88
      };

      expect(traits.conscientiousness).toBe(85);
      expect(traits.confidence).toBe(88);
    });

    it('should have correct TrustScore interface', () => {
      const trustScore: TrustScore = {
        score: 82,
        traits: {
          conscientiousness: 85,
          neuroticism: 25,
          agreeableness: 78,
          openness: 82,
          extraversion: 70,
          confidence: 88
        },
        confidenceLevel: 88,
        lastUpdated: new Date(),
        expiresAt: new Date()
      };

      expect(trustScore.score).toBe(82);
      expect(trustScore.traits.conscientiousness).toBe(85);
    });

    it('should have correct LoanStatus enum values', () => {
      expect(LoanStatus.PENDING).toBe('pending');
      expect(LoanStatus.FUNDED).toBe('funded');
      expect(LoanStatus.ACTIVE).toBe('active');
      expect(LoanStatus.COMPLETED).toBe('completed');
      expect(LoanStatus.DEFAULTED).toBe('defaulted');
      expect(LoanStatus.DISPUTED).toBe('disputed');
    });

    it('should have correct ProofType enum values', () => {
      expect(ProofType.TRUST_SCORE).toBe('trust_score');
      expect(ProofType.INCOME_RANGE).toBe('income_range');
      expect(ProofType.IDENTITY).toBe('identity');
      expect(ProofType.LOAN_HISTORY).toBe('loan_history');
    });

    it('should have correct ErrorCodes enum values', () => {
      expect(ErrorCodes.INVALID_ZK_PROOF).toBe('INVALID_ZK_PROOF');
      expect(ErrorCodes.INSUFFICIENT_TRUST_SCORE).toBe('INSUFFICIENT_TRUST_SCORE');
      expect(ErrorCodes.BLOCKCHAIN_TRANSACTION_FAILED).toBe('BLOCKCHAIN_TRANSACTION_FAILED');
      expect(ErrorCodes.AI_ANALYSIS_FAILED).toBe('AI_ANALYSIS_FAILED');
      expect(ErrorCodes.GDPR_COMPLIANCE_ERROR).toBe('GDPR_COMPLIANCE_ERROR');
    });
  });

  describe('Loan Interface', () => {
    it('should have correct Loan interface structure', () => {
      const mockLoan: Loan = {
        id: 'loan_123',
        borrowerId: 'user_123',
        lenderId: 'user_456',
        communityId: 'community_123',
        amount: 5000,
        interestRate: 8.5,
        duration: 180,
        purpose: 'Education',
        status: LoanStatus.ACTIVE,
        repaymentSchedule: [],
        payments: [],
        applicationDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockLoan.amount).toBe(5000);
      expect(mockLoan.status).toBe(LoanStatus.ACTIVE);
      expect(mockLoan.interestRate).toBe(8.5);
    });
  });

  describe('Community Interface', () => {
    it('should have correct Community interface structure', () => {
      const mockCommunity: Community = {
        id: 'community_123',
        name: 'Test Community',
        memberCount: 10,
        trustNetwork: {
          connections: new Map(),
          reputationScores: new Map(),
          endorsements: []
        },
        lendingRules: {
          maxLoanAmount: 10000,
          minLoanAmount: 500,
          maxInterestRate: 15,
          minInterestRate: 5,
          maxLoanDuration: 365,
          minLoanDuration: 30,
          requiresEndorsement: true,
          minimumTrustScore: 70,
          allowedLoanPurposes: ['education', 'business']
        },
        governanceModel: {
          votingSystem: 'simple',
          quorumRequirement: 0.5,
          proposalThreshold: 0.1,
          votingPeriod: 7,
          adminRights: ['manage_members'],
          moderatorRights: ['review_loans']
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockCommunity.name).toBe('Test Community');
      expect(mockCommunity.lendingRules.maxLoanAmount).toBe(10000);
      expect(mockCommunity.governanceModel.votingSystem).toBe('simple');
    });
  });
});