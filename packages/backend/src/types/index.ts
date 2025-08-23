// Core TypeScript interfaces and types for the community P2P lending platform

export interface Location {
  country: string;
  region?: string;
  city?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  location?: Location;
  languages: string[];
  digitalLiteracyLevel: number;
  phoneNumber?: string;
  occupation?: string;
  monthlyIncome?: number;
  employmentStatus?: string;
  bankAccountVerified: boolean;
  identityVerified: boolean;
  profilePictureUrl?: string;
  bio?: string;
  preferredLoanTypes: string[];
  maxLoanAmount?: number;
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface User {
  id: string;
  email: string;
  profile: UserProfile;
  communityMemberships: CommunityMembership[];
  trustworthinessScore?: TrustScore;
  zkProofStatus: ZKProofStatus;
  gdprConsent: GDPRConsent;
  createdAt: Date;
  updatedAt: Date;
}

export interface Community {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  trustNetwork: TrustNetwork;
  lendingRules: LendingRules;
  governanceModel: GovernanceModel;
  maxLoanAmount?: number;
  defaultInterestRate?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityMembership {
  id: string;
  userId: string;
  communityId: string;
  role: 'member' | 'moderator' | 'admin';
  reputationScore: number;
  joinedAt: Date;
  isActive: boolean;
  endorsementCount: number;
  successfulLoans: number;
  defaultedLoans: number;
}

export interface TrustNetwork {
  connections: Map<string, TrustConnection>;
  reputationScores: Map<string, number>;
  endorsements: Endorsement[];
}

export interface TrustConnection {
  id: string;
  fromUserId: string;
  toUserId: string;
  trustLevel: number;
  connectionType: 'friend' | 'family' | 'colleague' | 'community';
  establishedDate: Date;
  lastInteraction?: Date;
  isActive: boolean;
}

export interface Endorsement {
  id: string;
  fromUserId: string;
  toUserId: string;
  endorsementType: 'character' | 'financial' | 'professional';
  message?: string;
  rating: number; // 1-5
  isPublic: boolean;
  createdAt: Date;
  isActive: boolean;
}

export interface LendingRules {
  maxLoanAmount: number;
  minLoanAmount: number;
  maxInterestRate: number;
  minInterestRate: number;
  maxLoanDuration: number; // in days
  minLoanDuration: number; // in days
  requiresEndorsement: boolean;
  minimumTrustScore: number;
  allowedLoanPurposes: string[];
}

export interface GovernanceModel {
  votingSystem: 'simple' | 'weighted' | 'consensus';
  quorumRequirement: number;
  proposalThreshold: number;
  votingPeriod: number; // in days
  adminRights: string[];
  moderatorRights: string[];
}

export enum LoanStatus {
  PENDING = 'pending',
  FUNDED = 'funded',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DEFAULTED = 'defaulted',
  DISPUTED = 'disputed'
}

export interface Loan {
  id: string;
  borrowerId: string;
  lenderId?: string;
  communityId: string;
  amount: number;
  interestRate: number;
  duration: number; // in days
  purpose: string;
  status: LoanStatus;
  zkProofHash?: string;
  suiTransactionId?: string;
  encryptedDetails?: string;
  repaymentSchedule: RepaymentSchedule[];
  payments: Payment[];
  applicationDate: Date;
  fundedDate?: Date;
  completedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepaymentSchedule {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paidDate?: Date;
  paidAmount?: number;
  createdAt: Date;
}

export interface Payment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  transactionId?: string;
  suiTransactionId?: string;
  status: 'pending' | 'completed' | 'failed';
  notes?: string;
}

export interface BigFiveTraits {
  conscientiousness: number; // 0-100, weight: 40%
  neuroticism: number;       // 0-100, weight: 25% (inverse)
  agreeableness: number;     // 0-100, weight: 20%
  openness: number;          // 0-100, weight: 10%
  extraversion: number;      // 0-100, weight: 5%
  confidence: number;        // Overall confidence in analysis
}

export interface TrustScore {
  score: number;
  traits: BigFiveTraits;
  confidenceLevel: number;
  lastUpdated: Date;
  expiresAt: Date;
}

export interface AIAnalysis {
  id: string;
  userId: string;
  messageHistoryHash: string; // Hash of analyzed content
  bigFiveTraits: BigFiveTraits;
  trustworthinessScore: number;
  confidenceLevel: number;
  biasFlags: BiasFlag[];
  analysisDate: Date;
  modelVersion: string;
  expiresAt: Date;
  isActive: boolean;
}

export interface BiasFlag {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigationApplied: boolean;
  mitigationDetails?: string;
  flaggedAt: Date;
  resolvedAt?: Date;
}

export interface ScoreExplanation {
  overallScore: number;
  traitContributions: {
    trait: keyof BigFiveTraits;
    value: number;
    weight: number;
    contribution: number;
  }[];
  confidenceFactors: string[];
  recommendations: string[];
}

export enum ProofType {
  TRUST_SCORE = 'trust_score',
  INCOME_RANGE = 'income_range',
  IDENTITY = 'identity',
  LOAN_HISTORY = 'loan_history'
}

export interface ZKProof {
  id: string;
  userId: string;
  proofType: ProofType;
  proofData: Uint8Array;
  publicInputs: any[];
  verificationStatus: boolean;
  circuitVersion: string;
  generatedAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface ZKProofStatus {
  hasTrustScoreProof: boolean;
  hasIncomeProof: boolean;
  hasIdentityProof: boolean;
  hasLoanHistoryProof: boolean;
  lastUpdated: Date;
}

export interface GDPRConsent {
  id: string;
  userId: string;
  dataProcessingConsent: boolean;
  aiAnalysisConsent: boolean;
  marketingConsent: boolean;
  dataRetentionPeriod: number; // days
  consentDate: Date;
  lastUpdated: Date;
  withdrawalDate?: Date;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: Date;
  requestId: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  requestId: string;
}

// Standardized error codes
export enum ErrorCodes {
  INVALID_ZK_PROOF = 'INVALID_ZK_PROOF',
  INSUFFICIENT_TRUST_SCORE = 'INSUFFICIENT_TRUST_SCORE',
  BLOCKCHAIN_TRANSACTION_FAILED = 'BLOCKCHAIN_TRANSACTION_FAILED',
  AI_ANALYSIS_FAILED = 'AI_ANALYSIS_FAILED',
  GDPR_COMPLIANCE_ERROR = 'GDPR_COMPLIANCE_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

// Database connection configuration
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}

// Redis configuration for caching
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}