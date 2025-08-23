// Blockchain controller for loan management API endpoints
import { Request, Response } from 'express';
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

// Initialize blockchain service (in production, this would be dependency injected)
const blockchainConfig = {
  network: (process.env.SUI_NETWORK as 'testnet' | 'mainnet' | 'devnet' | 'localnet') || 'testnet',
  packageId: process.env.SUI_PACKAGE_ID || '0x0',
  privateKey: process.env.SUI_PRIVATE_KEY,
  rpcUrl: process.env.SUI_RPC_URL,
};

const blockchainService = new SuiBlockchainService(blockchainConfig);

// Request/Response interfaces
interface CreateLoanRequest {
  amount: number;
  interest_rate: number;
  duration_days: number;
  zk_proof: {
    proof_data: number[];
    public_inputs: number[];
    circuit_type: number;
    proof_timestamp?: number;
  };
  encrypted_details: number[];
  community_id: string;
}

interface FundLoanRequest {
  loan_id: string;
  amount: number;
}

interface MakePaymentRequest {
  loan_id: string;
  amount: number;
  payment_type: number;
}

interface LoanManagementRequest {
  loan_id: string;
}

/**
 * Create a new loan with ZK proof verification
 */
export const createLoan = async (req: Request<{}, {}, CreateLoanRequest>, res: Response) => {
  try {
    const { amount, interest_rate, duration_days, zk_proof, encrypted_details, community_id } = req.body;

    // Validate required fields
    if (!amount || !interest_rate || !duration_days || !zk_proof || !community_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['amount', 'interest_rate', 'duration_days', 'zk_proof', 'community_id']
      });
    }

    // Validate amount and interest rate
    if (amount <= 0 || interest_rate < 0) {
      return res.status(400).json({
        error: 'Invalid amount or interest rate',
        details: 'Amount must be positive, interest rate must be non-negative'
      });
    }

    // Validate ZK proof structure
    if (!zk_proof.proof_data || !zk_proof.public_inputs || zk_proof.circuit_type === undefined) {
      return res.status(400).json({
        error: 'Invalid ZK proof structure',
        required: ['proof_data', 'public_inputs', 'circuit_type']
      });
    }

    // Create ZK proof object
    const zkProof = createZKProof(
      zk_proof.proof_data,
      zk_proof.public_inputs,
      zk_proof.circuit_type,
      zk_proof.proof_timestamp
    );

    // Prepare loan creation parameters
    const loanParams: LoanCreationParams = {
      amount,
      interest_rate,
      duration_days,
      zk_proof: zkProof,
      encrypted_details: encrypted_details || [],
      community_id,
    };

    // Create loan on blockchain
    const loanAddress = await blockchainService.createLoan(loanParams);

    res.status(201).json({
      success: true,
      loan_id: loanAddress,
      message: 'Loan created successfully',
      details: {
        amount,
        interest_rate,
        duration_days,
        community_id,
        status: LOAN_STATUS.PENDING,
      }
    });

  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({
      error: 'Failed to create loan',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Fund an existing loan
 */
export const fundLoan = async (req: Request<{}, {}, FundLoanRequest>, res: Response) => {
  try {
    const { loan_id, amount } = req.body;

    // Validate required fields
    if (!loan_id || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['loan_id', 'amount']
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        details: 'Amount must be positive'
      });
    }

    // Prepare funding parameters
    const fundingParams: LoanFundingParams = {
      loan_id,
      amount,
    };

    // Fund loan on blockchain
    const transactionDigest = await blockchainService.fundLoan(fundingParams);

    res.status(200).json({
      success: true,
      transaction_digest: transactionDigest,
      message: 'Loan funded successfully',
      details: {
        loan_id,
        amount,
      }
    });

  } catch (error) {
    console.error('Error funding loan:', error);
    res.status(500).json({
      error: 'Failed to fund loan',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Make a payment towards a loan
 */
export const makePayment = async (req: Request<{}, {}, MakePaymentRequest>, res: Response) => {
  try {
    const { loan_id, amount, payment_type } = req.body;

    // Validate required fields
    if (!loan_id || !amount || payment_type === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['loan_id', 'amount', 'payment_type']
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        details: 'Amount must be positive'
      });
    }

    // Validate payment type
    if (!Object.values(PAYMENT_TYPES).includes(payment_type)) {
      return res.status(400).json({
        error: 'Invalid payment type',
        valid_types: Object.entries(PAYMENT_TYPES).map(([key, value]) => ({ [key]: value }))
      });
    }

    // Prepare payment parameters
    const paymentParams: PaymentParams = {
      loan_id,
      amount,
      payment_type,
    };

    // Make payment on blockchain
    const transactionDigest = await blockchainService.makePayment(paymentParams);

    res.status(200).json({
      success: true,
      transaction_digest: transactionDigest,
      message: 'Payment made successfully',
      details: {
        loan_id,
        amount,
        payment_type,
      }
    });

  } catch (error) {
    console.error('Error making payment:', error);
    res.status(500).json({
      error: 'Failed to make payment',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Mark a loan as defaulted
 */
export const markLoanDefaulted = async (req: Request<{}, {}, LoanManagementRequest>, res: Response) => {
  try {
    const { loan_id } = req.body;

    // Validate required fields
    if (!loan_id) {
      return res.status(400).json({
        error: 'Missing required field: loan_id'
      });
    }

    // Mark loan as defaulted on blockchain
    const transactionDigest = await blockchainService.markLoanDefaulted(loan_id);

    res.status(200).json({
      success: true,
      transaction_digest: transactionDigest,
      message: 'Loan marked as defaulted',
      details: {
        loan_id,
        new_status: LOAN_STATUS.DEFAULTED,
      }
    });

  } catch (error) {
    console.error('Error marking loan as defaulted:', error);
    res.status(500).json({
      error: 'Failed to mark loan as defaulted',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Dispute a loan
 */
export const disputeLoan = async (req: Request<{}, {}, LoanManagementRequest>, res: Response) => {
  try {
    const { loan_id } = req.body;

    // Validate required fields
    if (!loan_id) {
      return res.status(400).json({
        error: 'Missing required field: loan_id'
      });
    }

    // Dispute loan on blockchain
    const transactionDigest = await blockchainService.disputeLoan(loan_id);

    res.status(200).json({
      success: true,
      transaction_digest: transactionDigest,
      message: 'Loan disputed successfully',
      details: {
        loan_id,
        new_status: LOAN_STATUS.DISPUTED,
      }
    });

  } catch (error) {
    console.error('Error disputing loan:', error);
    res.status(500).json({
      error: 'Failed to dispute loan',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get loan information
 */
export const getLoanInfo = async (req: Request<{ loan_id: string }>, res: Response) => {
  try {
    const { loan_id } = req.params;

    // Validate loan ID
    if (!loan_id) {
      return res.status(400).json({
        error: 'Missing loan_id parameter'
      });
    }

    // Get loan information from blockchain
    const loanInfo = await blockchainService.getLoanInfo(loan_id);

    if (!loanInfo) {
      return res.status(404).json({
        error: 'Loan not found'
      });
    }

    res.status(200).json({
      success: true,
      loan_info: {
        ...loanInfo,
        status_name: loanInfo.status !== undefined ? Object.keys(LOAN_STATUS)[loanInfo.status] : 'Unknown',
      }
    });

  } catch (error) {
    console.error('Error getting loan info:', error);
    res.status(500).json({
      error: 'Failed to get loan information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get registry statistics
 */
export const getRegistryStats = async (req: Request, res: Response) => {
  try {
    // Get registry statistics from blockchain
    const stats = await blockchainService.getRegistryStats();

    res.status(200).json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Error getting registry stats:', error);
    res.status(500).json({
      error: 'Failed to get registry statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get loan transaction history
 */
export const getLoanHistory = async (req: Request<{ loan_id: string }>, res: Response) => {
  try {
    const { loan_id } = req.params;

    // Validate loan ID
    if (!loan_id) {
      return res.status(400).json({
        error: 'Missing loan_id parameter'
      });
    }

    // Get transaction history from blockchain
    const history = await blockchainService.getLoanTransactionHistory(loan_id);

    res.status(200).json({
      success: true,
      transaction_history: history.map(tx => ({
        digest: tx.digest,
        timestamp: tx.timestampMs,
        status: tx.effects?.status?.status,
        events: tx.events?.map(event => ({
          type: event.type,
          data: event.parsedJson,
        })) || [],
      }))
    });

  } catch (error) {
    console.error('Error getting loan history:', error);
    res.status(500).json({
      error: 'Failed to get loan history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get account balance
 */
export const getBalance = async (req: Request<{ address?: string }>, res: Response) => {
  try {
    const { address } = req.params;
    
    // Get balance from blockchain
    const balance = await blockchainService.getBalance(address);

    res.status(200).json({
      success: true,
      balance: {
        address: address || blockchainService.getAddress(),
        amount: balance,
        unit: 'MIST', // Sui's smallest unit
      }
    });

  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({
      error: 'Failed to get balance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get current gas price
 */
export const getGasPrice = async (req: Request, res: Response) => {
  try {
    // Get gas price from blockchain
    const gasPrice = await blockchainService.getGasPrice();

    res.status(200).json({
      success: true,
      gas_price: {
        amount: gasPrice,
        unit: 'MIST',
      }
    });

  } catch (error) {
    console.error('Error getting gas price:', error);
    res.status(500).json({
      error: 'Failed to get gas price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Health check endpoint for blockchain service
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Try to get gas price as a simple health check
    const gasPrice = await blockchainService.getGasPrice();
    
    res.status(200).json({
      success: true,
      status: 'healthy',
      blockchain: {
        network: blockchainConfig.network,
        connected: true,
        gas_price: gasPrice,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Blockchain health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      blockchain: {
        network: blockchainConfig.network,
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    });
  }
};

// Export constants for use in routes
export { CIRCUIT_TYPES, LOAN_STATUS, PAYMENT_TYPES };