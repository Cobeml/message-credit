// Tests for Sui blockchain service
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { 
  SuiBlockchainService, 
  createZKProof, 
  CIRCUIT_TYPES, 
  LOAN_STATUS,
  PAYMENT_TYPES,
  type LoanCreationParams,
  type LoanFundingParams,
  type PaymentParams 
} from '../services/blockchain';

// Mock the Sui SDK
vi.mock('@mysten/sui.js/client', () => ({
  SuiClient: vi.fn().mockImplementation(() => ({
    signAndExecuteTransactionBlock: vi.fn(),
    devInspectTransactionBlock: vi.fn(),
    subscribeEvent: vi.fn(),
    queryTransactionBlocks: vi.fn(),
    getOwnedObjects: vi.fn(),
    getReferenceGasPrice: vi.fn(),
    getBalance: vi.fn(),
    dryRunTransactionBlock: vi.fn(),
  })),
  getFullnodeUrl: vi.fn().mockReturnValue('https://fullnode.testnet.sui.io'),
}));

vi.mock('@mysten/sui.js/keypairs/ed25519', () => ({
  Ed25519Keypair: {
    fromSecretKey: vi.fn().mockReturnValue({
      getPublicKey: vi.fn().mockReturnValue({
        toSuiAddress: vi.fn().mockReturnValue('0x123456789abcdef'),
      }),
    }),
  },
}));

vi.mock('@mysten/sui.js/transactions', () => ({
  TransactionBlock: vi.fn().mockImplementation(() => ({
    pure: vi.fn().mockReturnValue('pure_arg'),
    sharedObjectRef: vi.fn().mockReturnValue('shared_ref'),
    splitCoins: vi.fn().mockReturnValue(['coin_object']),
    moveCall: vi.fn().mockReturnValue('move_call_result'),
    gas: 'gas_object',
  })),
}));

vi.mock('@mysten/sui.js/utils', () => ({
  fromB64: vi.fn().mockReturnValue(new Uint8Array(32)),
  toB64: vi.fn().mockReturnValue('base64string'),
}));

describe('SuiBlockchainService', () => {
  let blockchainService: SuiBlockchainService;
  let mockClient: any;

  const mockConfig = {
    network: 'testnet' as const,
    packageId: '0xpackage123',
    privateKey: 'mockPrivateKey',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    blockchainService = new SuiBlockchainService(mockConfig);
    mockClient = (blockchainService as any).client;
  });

  describe('Constructor and Setup', () => {
    it('should initialize with correct configuration', () => {
      expect(blockchainService).toBeDefined();
      expect((blockchainService as any).packageId).toBe(mockConfig.packageId);
    });

    it('should set keypair when provided', () => {
      const address = blockchainService.getAddress();
      expect(address).toBe('0x123456789abcdef');
    });

    it('should throw error when getting address without keypair', () => {
      const serviceWithoutKey = new SuiBlockchainService({
        network: 'testnet',
        packageId: '0xpackage123',
      });
      
      expect(() => serviceWithoutKey.getAddress()).toThrow('Keypair not initialized');
    });
  });

  describe('Loan Creation', () => {
    it('should create loan with valid ZK proof', async () => {
      const mockResponse = {
        digest: 'transaction_digest',
        effects: {
          status: { status: 'success' },
          created: [
            { reference: { objectId: 'loan_object_id' } },
          ],
        },
      };

      mockClient.signAndExecuteTransactionBlock.mockResolvedValue(mockResponse);
      mockClient.getOwnedObjects.mockResolvedValue({
        data: [{ data: { objectId: 'registry_id' } }],
      });

      const zkProof = createZKProof([1, 2, 3, 4], [75], CIRCUIT_TYPES.TRUST_SCORE);
      const loanParams: LoanCreationParams = {
        amount: 1000000,
        interest_rate: 500,
        duration_days: 30,
        zk_proof: zkProof,
        encrypted_details: [1, 2, 3, 4, 5],
        community_id: 'test_community',
      };

      const loanAddress = await blockchainService.createLoan(loanParams);
      
      expect(loanAddress).toBe('loan_object_id');
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(1);
    });

    it('should throw error when keypair not initialized', async () => {
      const serviceWithoutKey = new SuiBlockchainService({
        network: 'testnet',
        packageId: '0xpackage123',
      });

      const zkProof = createZKProof([1, 2, 3, 4], [75], CIRCUIT_TYPES.TRUST_SCORE);
      const loanParams: LoanCreationParams = {
        amount: 1000000,
        interest_rate: 500,
        duration_days: 30,
        zk_proof: zkProof,
        encrypted_details: [1, 2, 3, 4, 5],
        community_id: 'test_community',
      };

      await expect(serviceWithoutKey.createLoan(loanParams)).rejects.toThrow('Keypair not initialized');
    });

    it('should retry on transaction failure', async () => {
      const failResponse = {
        effects: { status: { status: 'failure', error: 'Gas limit exceeded' } },
      };
      const successResponse = {
        digest: 'transaction_digest',
        effects: {
          status: { status: 'success' },
          created: [{ reference: { objectId: 'loan_object_id' } }],
        },
      };

      mockClient.signAndExecuteTransactionBlock
        .mockResolvedValueOnce(failResponse)
        .mockResolvedValueOnce(successResponse);
      
      mockClient.getOwnedObjects.mockResolvedValue({
        data: [{ data: { objectId: 'registry_id' } }],
      });

      const zkProof = createZKProof([1, 2, 3, 4], [75], CIRCUIT_TYPES.TRUST_SCORE);
      const loanParams: LoanCreationParams = {
        amount: 1000000,
        interest_rate: 500,
        duration_days: 30,
        zk_proof: zkProof,
        encrypted_details: [1, 2, 3, 4, 5],
        community_id: 'test_community',
      };

      const loanAddress = await blockchainService.createLoan(loanParams);
      
      expect(loanAddress).toBe('loan_object_id');
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Loan Funding', () => {
    it('should fund loan successfully', async () => {
      const mockResponse = {
        digest: 'funding_transaction_digest',
        effects: { status: { status: 'success' } },
      };

      mockClient.signAndExecuteTransactionBlock.mockResolvedValue(mockResponse);

      const fundingParams: LoanFundingParams = {
        loan_id: 'loan_object_id',
        amount: 1000000,
      };

      const transactionDigest = await blockchainService.fundLoan(fundingParams);
      
      expect(transactionDigest).toBe('funding_transaction_digest');
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loan Payments', () => {
    it('should make payment successfully', async () => {
      const mockResponse = {
        digest: 'payment_transaction_digest',
        effects: { status: { status: 'success' } },
      };

      mockClient.signAndExecuteTransactionBlock.mockResolvedValue(mockResponse);

      const paymentParams: PaymentParams = {
        loan_id: 'loan_object_id',
        amount: 500000,
        payment_type: PAYMENT_TYPES.PRINCIPAL,
      };

      const transactionDigest = await blockchainService.makePayment(paymentParams);
      
      expect(transactionDigest).toBe('payment_transaction_digest');
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loan Management', () => {
    it('should mark loan as defaulted', async () => {
      const mockResponse = {
        digest: 'default_transaction_digest',
        effects: { status: { status: 'success' } },
      };

      mockClient.signAndExecuteTransactionBlock.mockResolvedValue(mockResponse);

      const transactionDigest = await blockchainService.markLoanDefaulted('loan_object_id');
      
      expect(transactionDigest).toBe('default_transaction_digest');
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(1);
    });

    it('should dispute loan', async () => {
      const mockResponse = {
        digest: 'dispute_transaction_digest',
        effects: { status: { status: 'success' } },
      };

      mockClient.signAndExecuteTransactionBlock.mockResolvedValue(mockResponse);

      const transactionDigest = await blockchainService.disputeLoan('loan_object_id');
      
      expect(transactionDigest).toBe('dispute_transaction_digest');
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Retrieval', () => {
    it('should get loan information', async () => {
      const mockResponse = {
        results: [{
          returnValues: [
            [[0x12, 0x34], 'address'], // borrower
            [[0x56, 0x78], 'address'], // lender
            [[], '1000000'], // amount
            [[], '500'], // interest_rate
            [[], '30'], // duration_days
            [[], '2'], // status (active)
            [[], '1640995200000'], // created_at
            [[], '0'], // total_repaid
          ],
        }],
      };

      mockClient.devInspectTransactionBlock.mockResolvedValue(mockResponse);

      const loanInfo = await blockchainService.getLoanInfo('loan_object_id');
      
      expect(loanInfo).toEqual({
        borrower: '0x1234',
        lender: '0x5678',
        amount: 1000000,
        interest_rate: 500,
        duration_days: 30,
        status: LOAN_STATUS.ACTIVE,
        created_at: 1640995200000,
        total_repaid: 0,
      });
    });

    it('should get registry statistics', async () => {
      const mockResponse = {
        results: [{
          returnValues: [
            [[], '10'], // total_loans
            [[], '5000000'], // total_volume
          ],
        }],
      };

      mockClient.devInspectTransactionBlock.mockResolvedValue(mockResponse);
      mockClient.getOwnedObjects.mockResolvedValue({
        data: [{ data: { objectId: 'registry_id' } }],
      });

      const stats = await blockchainService.getRegistryStats();
      
      expect(stats).toEqual({
        total_loans: 10,
        total_volume: 5000000,
      });
    });

    it('should handle error in data retrieval', async () => {
      mockClient.devInspectTransactionBlock.mockResolvedValue({
        error: 'Object not found',
      });

      await expect(blockchainService.getLoanInfo('invalid_loan_id'))
        .rejects.toThrow('Failed to get loan info: Object not found');
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to loan events', async () => {
      const mockUnsubscribe = vi.fn();
      mockClient.subscribeEvent.mockResolvedValue(mockUnsubscribe);

      const mockCallback = vi.fn();
      const unsubscribe = await blockchainService.subscribeToLoanEvents(mockCallback);

      expect(mockClient.subscribeEvent).toHaveBeenCalledWith({
        filter: { Package: mockConfig.packageId },
        onMessage: expect.any(Function),
      });
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should filter events by type', async () => {
      const mockUnsubscribe = vi.fn();
      let eventHandler: (event: any) => void;
      
      mockClient.subscribeEvent.mockImplementation(({ onMessage }) => {
        eventHandler = onMessage;
        return Promise.resolve(mockUnsubscribe);
      });

      const mockCallback = vi.fn();
      await blockchainService.subscribeToLoanEvents(mockCallback, ['LoanCreated']);

      // Simulate events
      const loanCreatedEvent = { type: 'package::loan_manager::LoanCreated' };
      const loanFundedEvent = { type: 'package::loan_manager::LoanFunded' };

      eventHandler!(loanCreatedEvent);
      eventHandler!(loanFundedEvent);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(loanCreatedEvent);
    });
  });

  describe('Transaction History', () => {
    it('should get loan transaction history', async () => {
      const mockTransactions = {
        data: [
          { digest: 'tx1', effects: { status: { status: 'success' } } },
          { digest: 'tx2', effects: { status: { status: 'success' } } },
        ],
      };

      mockClient.queryTransactionBlocks.mockResolvedValue(mockTransactions);

      const history = await blockchainService.getLoanTransactionHistory('loan_object_id');
      
      expect(history).toEqual(mockTransactions.data);
      expect(mockClient.queryTransactionBlocks).toHaveBeenCalledWith({
        filter: { InputObject: 'loan_object_id' },
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true,
        },
      });
    });
  });

  describe('Utility Functions', () => {
    it('should get gas price', async () => {
      mockClient.getReferenceGasPrice.mockResolvedValue('1000');

      const gasPrice = await blockchainService.getGasPrice();
      
      expect(gasPrice).toBe(1000);
    });

    it('should get account balance', async () => {
      mockClient.getBalance.mockResolvedValue({ totalBalance: '5000000' });

      const balance = await blockchainService.getBalance();
      
      expect(balance).toBe(5000000);
    });

    it('should validate transaction', async () => {
      mockClient.dryRunTransactionBlock.mockResolvedValue({
        effects: { status: { status: 'success' } },
      });

      const mockTx = {} as any;
      const isValid = await blockchainService.validateTransaction(mockTx);
      
      expect(isValid).toBe(true);
    });

    it('should handle validation failure', async () => {
      mockClient.dryRunTransactionBlock.mockRejectedValue(new Error('Validation failed'));

      const mockTx = {} as any;
      const isValid = await blockchainService.validateTransaction(mockTx);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry', async () => {
      mockClient.signAndExecuteTransactionBlock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          digest: 'success_digest',
          effects: { status: { status: 'success' } },
        });

      mockClient.getOwnedObjects.mockResolvedValue({
        data: [{ data: { objectId: 'registry_id' } }],
      });

      const fundingParams: LoanFundingParams = {
        loan_id: 'loan_object_id',
        amount: 1000000,
      };

      const result = await blockchainService.fundLoan(fundingParams);
      
      expect(result).toBe('success_digest');
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockClient.signAndExecuteTransactionBlock.mockRejectedValue(new Error('Persistent error'));

      const fundingParams: LoanFundingParams = {
        loan_id: 'loan_object_id',
        amount: 1000000,
      };

      await expect(blockchainService.fundLoan(fundingParams))
        .rejects.toThrow('Persistent error');
      
      expect(mockClient.signAndExecuteTransactionBlock).toHaveBeenCalledTimes(3); // Default retry attempts
    });
  });
});

describe('Utility Functions', () => {
  describe('createZKProof', () => {
    it('should create ZK proof with all parameters', () => {
      const proofData = [1, 2, 3, 4];
      const publicInputs = [75];
      const circuitType = CIRCUIT_TYPES.TRUST_SCORE;
      const timestamp = 1640995200000;

      const proof = createZKProof(proofData, publicInputs, circuitType, timestamp);

      expect(proof).toEqual({
        proof_data: proofData,
        public_inputs: publicInputs,
        circuit_type: circuitType,
        proof_timestamp: timestamp,
        circuit_version: 1,
      });
    });

    it('should use current timestamp when not provided', () => {
      const proof = createZKProof([1, 2, 3, 4], [75], CIRCUIT_TYPES.TRUST_SCORE);
      
      expect(proof.proof_timestamp).toBeGreaterThan(0);
      expect(proof.proof_timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Constants', () => {
    it('should have correct circuit types', () => {
      expect(CIRCUIT_TYPES.TRUST_SCORE).toBe(0);
      expect(CIRCUIT_TYPES.INCOME_RANGE).toBe(1);
      expect(CIRCUIT_TYPES.IDENTITY).toBe(2);
      expect(CIRCUIT_TYPES.LOAN_HISTORY).toBe(3);
    });

    it('should have correct loan status values', () => {
      expect(LOAN_STATUS.PENDING).toBe(0);
      expect(LOAN_STATUS.FUNDED).toBe(1);
      expect(LOAN_STATUS.ACTIVE).toBe(2);
      expect(LOAN_STATUS.COMPLETED).toBe(3);
      expect(LOAN_STATUS.DEFAULTED).toBe(4);
      expect(LOAN_STATUS.DISPUTED).toBe(5);
    });

    it('should have correct payment types', () => {
      expect(PAYMENT_TYPES.PRINCIPAL).toBe(0);
      expect(PAYMENT_TYPES.INTEREST).toBe(1);
      expect(PAYMENT_TYPES.PENALTY).toBe(2);
    });
  });
});