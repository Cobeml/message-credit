// Tests for blockchain controller endpoints
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  createLoan,
  fundLoan,
  makePayment,
  getLoanInfo,
  getRegistryStats,
  healthCheck,
  CIRCUIT_TYPES,
  LOAN_STATUS,
  PAYMENT_TYPES
} from '../controllers/blockchain';

// Mock the blockchain service
vi.mock('../services/blockchain', () => ({
  SuiBlockchainService: vi.fn().mockImplementation(() => ({
    createLoan: vi.fn().mockResolvedValue('loan_123'),
    fundLoan: vi.fn().mockResolvedValue('tx_123'),
    makePayment: vi.fn().mockResolvedValue('payment_123'),
    getLoanInfo: vi.fn().mockResolvedValue({
      id: 'loan_123',
      borrower: '0x123',
      lender: '0x456',
      amount: 1000,
      status: 1,
      interest_rate: 5
    }),
    getRegistryStats: vi.fn().mockResolvedValue({
      total_loans: 10,
      total_volume: 50000
    }),
    getGasPrice: vi.fn().mockResolvedValue(1000),
  })),
  createZKProof: vi.fn(),
  CIRCUIT_TYPES: { TRUST_SCORE: 0, INCOME_RANGE: 1, IDENTITY: 2, LOAN_HISTORY: 3 },
  LOAN_STATUS: { PENDING: 0, FUNDED: 1, ACTIVE: 2, COMPLETED: 3, DEFAULTED: 4, DISPUTED: 5 },
  PAYMENT_TYPES: { PRINCIPAL: 0, INTEREST: 1, PENALTY: 2 },
}));

describe('Blockchain Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    
    mockReq = {};
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
  });

  describe('createLoan', () => {
    it('should create loan successfully with valid data', async () => {
      mockReq.body = {
        amount: 1000000,
        interest_rate: 500,
        duration_days: 30,
        zk_proof: {
          proof_data: [1, 2, 3, 4],
          public_inputs: [75],
          circuit_type: CIRCUIT_TYPES.TRUST_SCORE,
        },
        encrypted_details: [1, 2, 3, 4, 5],
        community_id: 'test_community',
      };

      await createLoan(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Loan created successfully',
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      mockReq.body = {
        amount: 1000000,
        // Missing other required fields
      };

      await createLoan(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing required fields',
        })
      );
    });

    it('should return 400 for invalid amount', async () => {
      mockReq.body = {
        amount: -1000,
        interest_rate: 500,
        duration_days: 30,
        zk_proof: {
          proof_data: [1, 2, 3, 4],
          public_inputs: [75],
          circuit_type: CIRCUIT_TYPES.TRUST_SCORE,
        },
        encrypted_details: [1, 2, 3, 4, 5],
        community_id: 'test_community',
      };

      await createLoan(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid amount or interest rate',
        })
      );
    });

    it('should return 400 for invalid ZK proof structure', async () => {
      mockReq.body = {
        amount: 1000000,
        interest_rate: 500,
        duration_days: 30,
        zk_proof: {
          // Missing required fields
        },
        encrypted_details: [1, 2, 3, 4, 5],
        community_id: 'test_community',
      };

      await createLoan(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid ZK proof structure',
        })
      );
    });
  });

  describe('fundLoan', () => {
    it('should fund loan successfully with valid data', async () => {
      mockReq.body = {
        loan_id: 'loan_123',
        amount: 1000000,
      };

      await fundLoan(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Loan funded successfully',
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      mockReq.body = {
        loan_id: 'loan_123',
        // Missing amount
      };

      await fundLoan(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing required fields',
        })
      );
    });

    it('should return 400 for invalid amount', async () => {
      mockReq.body = {
        loan_id: 'loan_123',
        amount: -1000,
      };

      await fundLoan(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid amount',
        })
      );
    });
  });

  describe('makePayment', () => {
    it('should make payment successfully with valid data', async () => {
      mockReq.body = {
        loan_id: 'loan_123',
        amount: 500000,
        payment_type: PAYMENT_TYPES.PRINCIPAL,
      };

      await makePayment(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Payment made successfully',
        })
      );
    });

    it('should return 400 for invalid payment type', async () => {
      mockReq.body = {
        loan_id: 'loan_123',
        amount: 500000,
        payment_type: 999, // Invalid payment type
      };

      await makePayment(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid payment type',
        })
      );
    });
  });

  describe('getLoanInfo', () => {
    it('should get loan info successfully', async () => {
      mockReq.params = { loan_id: 'loan_123' };

      await getLoanInfo(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should return 400 for missing loan_id', async () => {
      mockReq.params = {};

      await getLoanInfo(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing loan_id parameter',
        })
      );
    });
  });

  describe('getRegistryStats', () => {
    it('should get registry stats successfully', async () => {
      await getRegistryStats(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          statistics: expect.any(Object),
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      await healthCheck(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'healthy',
        })
      );
    });
  });

  describe('Constants', () => {
    it('should export correct constants', () => {
      expect(CIRCUIT_TYPES.TRUST_SCORE).toBe(0);
      expect(CIRCUIT_TYPES.INCOME_RANGE).toBe(1);
      expect(CIRCUIT_TYPES.IDENTITY).toBe(2);
      expect(CIRCUIT_TYPES.LOAN_HISTORY).toBe(3);

      expect(LOAN_STATUS.PENDING).toBe(0);
      expect(LOAN_STATUS.FUNDED).toBe(1);
      expect(LOAN_STATUS.ACTIVE).toBe(2);
      expect(LOAN_STATUS.COMPLETED).toBe(3);
      expect(LOAN_STATUS.DEFAULTED).toBe(4);
      expect(LOAN_STATUS.DISPUTED).toBe(5);

      expect(PAYMENT_TYPES.PRINCIPAL).toBe(0);
      expect(PAYMENT_TYPES.INTEREST).toBe(1);
      expect(PAYMENT_TYPES.PENALTY).toBe(2);
    });
  });
});