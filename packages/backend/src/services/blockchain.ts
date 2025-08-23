// Sui blockchain service for loan management and ZK proof integration
// Handles transaction signing, submission, and event listening

import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { fromB64, toB64 } from '@mysten/sui.js/utils';
import type { SuiTransactionBlockResponse } from '@mysten/sui.js/client';

// Types for blockchain operations
export interface ZKProof {
  proof_data: number[];
  public_inputs: number[];
  circuit_type: number;
  proof_timestamp: number;
  circuit_version: number;
}

export interface LoanCreationParams {
  amount: number;
  interest_rate: number;
  duration_days: number;
  zk_proof: ZKProof;
  encrypted_details: number[];
  community_id: string;
}

export interface LoanFundingParams {
  loan_id: string;
  amount: number;
}

export interface PaymentParams {
  loan_id: string;
  amount: number;
  payment_type: number; // 0: principal, 1: interest, 2: penalty
}

export interface BlockchainConfig {
  network: 'testnet' | 'mainnet' | 'devnet' | 'localnet';
  packageId: string;
  privateKey?: string;
  rpcUrl?: string;
}

export interface LoanInfo {
  borrower: string;
  lender: string;
  amount: number;
  interest_rate: number;
  duration_days: number;
  status: number;
  created_at: number;
  total_repaid: number;
}

export interface RegistryStats {
  total_loans: number;
  total_volume: number;
}

export class SuiBlockchainService {
  private client: SuiClient;
  private keypair: Ed25519Keypair | null = null;
  private packageId: string;
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second

  constructor(config: BlockchainConfig) {
    // Initialize Sui client
    const rpcUrl = config.rpcUrl || getFullnodeUrl(config.network);
    this.client = new SuiClient({ url: rpcUrl });
    this.packageId = config.packageId;

    // Initialize keypair if private key provided and valid
    if (config.privateKey && config.privateKey !== 'your-sui-private-key') {
      try {
        let secretKey: Uint8Array;
        
        // Try different private key formats
        if (config.privateKey.startsWith('0x')) {
          // Hex format: 0x...
          const hexString = config.privateKey.slice(2); // Remove 0x prefix
          secretKey = new Uint8Array(Buffer.from(hexString, 'hex'));
        } else if (config.privateKey.startsWith('suiprivkey')) {
          // Bech32 format (2024+): suiprivkey...
          // Note: Need to decode Bech32 first (simplified for now)
          throw new Error('Bech32 private keys not yet supported. Use hex or base64 format.');
        } else {
          // Assume base64 format
          secretKey = fromB64(config.privateKey);
        }
        
        this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
        console.log('Sui keypair initialized successfully');
      } catch (error) {
        console.warn('Invalid SUI private key provided, blockchain signing will be disabled. Error:', error.message);
      }
    }
  }

  /**
   * Set the keypair for transaction signing
   */
  setKeypair(privateKey: string): void {
    this.keypair = Ed25519Keypair.fromSecretKey(fromB64(privateKey));
  }

  /**
   * Get the current address
   */
  getAddress(): string {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }
    return this.keypair.getPublicKey().toSuiAddress();
  }

  /**
   * Create a new loan with ZK proof verification
   */
  async createLoan(params: LoanCreationParams): Promise<string> {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }

    const tx = new TransactionBlock();
    
    // Get the shared registry object
    const registryId = await this.getRegistryId();
    
    // Get current clock
    const clock = tx.sharedObjectRef({
      objectId: '0x6',
      initialSharedVersion: 1,
      mutable: false,
    });

    // Create ZK proof argument
    const zkProofArg = tx.pure({
      proof_data: params.zk_proof.proof_data,
      public_inputs: params.zk_proof.public_inputs,
      circuit_type: params.zk_proof.circuit_type,
      proof_timestamp: params.zk_proof.proof_timestamp,
      circuit_version: params.zk_proof.circuit_version,
    });

    // Call the create_loan_with_proof function
    const result = tx.moveCall({
      target: `${this.packageId}::loan_manager::create_loan_with_proof`,
      arguments: [
        tx.sharedObjectRef({
          objectId: registryId,
          initialSharedVersion: 1,
          mutable: true,
        }),
        tx.pure(params.amount),
        tx.pure(params.interest_rate),
        tx.pure(params.duration_days),
        zkProofArg,
        tx.pure(params.encrypted_details),
        tx.pure(params.community_id),
        clock,
      ],
    });

    // Execute transaction with retry logic
    const response = await this.executeTransactionWithRetry(tx);
    
    // Extract loan address from transaction effects
    const loanAddress = this.extractLoanAddressFromResponse(response);
    
    return loanAddress;
  }

  /**
   * Fund an existing loan
   */
  async fundLoan(params: LoanFundingParams): Promise<string> {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }

    const tx = new TransactionBlock();
    
    // Create coin for payment
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(params.amount)]);
    
    // Get current clock
    const clock = tx.sharedObjectRef({
      objectId: '0x6',
      initialSharedVersion: 1,
      mutable: false,
    });

    // Call the fund_loan function
    tx.moveCall({
      target: `${this.packageId}::loan_manager::fund_loan`,
      arguments: [
        tx.sharedObjectRef({
          objectId: params.loan_id,
          initialSharedVersion: 1,
          mutable: true,
        }),
        coin,
        clock,
      ],
    });

    // Execute transaction with retry logic
    const response = await this.executeTransactionWithRetry(tx);
    
    return response.digest;
  }

  /**
   * Make a payment towards a loan
   */
  async makePayment(params: PaymentParams): Promise<string> {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }

    const tx = new TransactionBlock();
    
    // Create coin for payment
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(params.amount)]);
    
    // Get current clock
    const clock = tx.sharedObjectRef({
      objectId: '0x6',
      initialSharedVersion: 1,
      mutable: false,
    });

    // Call the make_payment function
    tx.moveCall({
      target: `${this.packageId}::loan_manager::make_payment`,
      arguments: [
        tx.sharedObjectRef({
          objectId: params.loan_id,
          initialSharedVersion: 1,
          mutable: true,
        }),
        coin,
        tx.pure(params.payment_type),
        clock,
      ],
    });

    // Execute transaction with retry logic
    const response = await this.executeTransactionWithRetry(tx);
    
    return response.digest;
  }

  /**
   * Mark a loan as defaulted
   */
  async markLoanDefaulted(loanId: string): Promise<string> {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }

    const tx = new TransactionBlock();
    
    // Get current clock
    const clock = tx.sharedObjectRef({
      objectId: '0x6',
      initialSharedVersion: 1,
      mutable: false,
    });

    // Call the mark_defaulted function
    tx.moveCall({
      target: `${this.packageId}::loan_manager::mark_defaulted`,
      arguments: [
        tx.sharedObjectRef({
          objectId: loanId,
          initialSharedVersion: 1,
          mutable: true,
        }),
        clock,
      ],
    });

    // Execute transaction with retry logic
    const response = await this.executeTransactionWithRetry(tx);
    
    return response.digest;
  }

  /**
   * Dispute a loan
   */
  async disputeLoan(loanId: string): Promise<string> {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }

    const tx = new TransactionBlock();

    // Call the dispute_loan function
    tx.moveCall({
      target: `${this.packageId}::loan_manager::dispute_loan`,
      arguments: [
        tx.sharedObjectRef({
          objectId: loanId,
          initialSharedVersion: 1,
          mutable: true,
        }),
      ],
    });

    // Execute transaction with retry logic
    const response = await this.executeTransactionWithRetry(tx);
    
    return response.digest;
  }

  /**
   * Get loan information
   */
  async getLoanInfo(loanId: string): Promise<LoanInfo> {
    const tx = new TransactionBlock();

    // Call the get_loan_info function
    tx.moveCall({
      target: `${this.packageId}::loan_manager::get_loan_info`,
      arguments: [
        tx.sharedObjectRef({
          objectId: loanId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Execute as a dev inspect transaction to get return values
    const response = await this.client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getAddress(),
    });

    if (response.error) {
      throw new Error(`Failed to get loan info: ${response.error}`);
    }

    // Parse the return values
    const returnValues = response.results?.[0]?.returnValues;
    if (!returnValues || returnValues.length < 8) {
      throw new Error('Invalid response format');
    }

    return {
      borrower: this.parseAddress(returnValues[0]),
      lender: this.parseAddress(returnValues[1]),
      amount: this.parseU64(returnValues[2]),
      interest_rate: this.parseU64(returnValues[3]),
      duration_days: this.parseU64(returnValues[4]),
      status: this.parseU8(returnValues[5]),
      created_at: this.parseU64(returnValues[6]),
      total_repaid: this.parseU64(returnValues[7]),
    };
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<RegistryStats> {
    const registryId = await this.getRegistryId();
    const tx = new TransactionBlock();

    // Call the get_registry_stats function
    tx.moveCall({
      target: `${this.packageId}::loan_manager::get_registry_stats`,
      arguments: [
        tx.sharedObjectRef({
          objectId: registryId,
          initialSharedVersion: 1,
          mutable: false,
        }),
      ],
    });

    // Execute as a dev inspect transaction to get return values
    const response = await this.client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getAddress(),
    });

    if (response.error) {
      throw new Error(`Failed to get registry stats: ${response.error}`);
    }

    // Parse the return values
    const returnValues = response.results?.[0]?.returnValues;
    if (!returnValues || returnValues.length < 2) {
      throw new Error('Invalid response format');
    }

    return {
      total_loans: this.parseU64(returnValues[0]),
      total_volume: this.parseU64(returnValues[1]),
    };
  }

  /**
   * Listen for loan-related events
   */
  async subscribeToLoanEvents(
    callback: (event: SuiEvent) => void,
    eventTypes?: string[]
  ): Promise<() => void> {
    const filter = {
      Package: this.packageId,
    };

    const unsubscribe = await this.client.subscribeEvent({
      filter,
      onMessage: (event) => {
        // Filter by event types if specified
        if (eventTypes && eventTypes.length > 0) {
          const eventType = event.type.split('::').pop();
          if (!eventTypes.includes(eventType || '')) {
            return;
          }
        }
        callback(event);
      },
    });

    return unsubscribe;
  }

  /**
   * Get transaction history for a specific loan
   */
  async getLoanTransactionHistory(loanId: string): Promise<SuiTransactionBlockResponse[]> {
    const transactions = await this.client.queryTransactionBlocks({
      filter: {
        InputObject: loanId,
      },
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
        showObjectChanges: true,
      },
    });

    return transactions.data;
  }

  /**
   * Execute transaction with retry logic
   */
  private async executeTransactionWithRetry(
    tx: TransactionBlock,
    attempts = this.retryAttempts
  ): Promise<SuiTransactionBlockResponse> {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await this.client.signAndExecuteTransactionBlock({
          signer: this.keypair,
          transactionBlock: tx,
          options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
          },
        });

        // Check if transaction was successful
        if (response.effects?.status?.status === 'success') {
          return response;
        } else {
          throw new Error(`Transaction failed: ${response.effects?.status?.error}`);
        }
      } catch (error) {
        console.error(`Transaction attempt ${i + 1} failed:`, error);
        
        if (i === attempts - 1) {
          throw error;
        }
        
        // Wait before retrying
        await this.delay(this.retryDelay * (i + 1));
      }
    }

    throw new Error('All transaction attempts failed');
  }

  /**
   * Get the registry object ID (in production, this would be stored in config)
   */
  private async getRegistryId(): Promise<string> {
    // In a real implementation, this would be stored in configuration
    // For now, we'll simulate finding the registry object
    const objects = await this.client.getOwnedObjects({
      owner: this.getAddress(),
      filter: {
        StructType: `${this.packageId}::loan_manager::LoanRegistry`,
      },
    });

    if (objects.data.length === 0) {
      throw new Error('Loan registry not found');
    }

    return objects.data[0].data?.objectId || '';
  }

  /**
   * Extract loan address from transaction response
   */
  private extractLoanAddressFromResponse(response: SuiTransactionBlockResponse): string {
    // Look for created objects in the transaction effects
    const createdObjects = response.effects?.created;
    if (!createdObjects || createdObjects.length === 0) {
      throw new Error('No objects created in transaction');
    }

    // Find the loan object (assuming it's the first created object)
    const loanObject = createdObjects.find(obj => 
      obj.reference.objectId !== response.effects?.gasObject?.reference?.objectId
    );

    if (!loanObject) {
      throw new Error('Loan object not found in created objects');
    }

    return loanObject.reference.objectId;
  }

  /**
   * Utility functions for parsing return values
   */
  private parseAddress(value: [number[], string]): string {
    return `0x${Buffer.from(value[0]).toString('hex')}`;
  }

  private parseU64(value: [number[], string]): number {
    return parseInt(value[1]);
  }

  private parseU8(value: [number[], string]): number {
    return parseInt(value[1]);
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<number> {
    const gasPrice = await this.client.getReferenceGasPrice();
    return parseInt(gasPrice);
  }

  /**
   * Get account balance
   */
  async getBalance(address?: string): Promise<number> {
    const addr = address || this.getAddress();
    const balance = await this.client.getBalance({
      owner: addr,
    });
    return parseInt(balance.totalBalance);
  }

  /**
   * Validate transaction before execution
   */
  async validateTransaction(tx: TransactionBlock): Promise<boolean> {
    try {
      const response = await this.client.dryRunTransactionBlock({
        transactionBlock: tx,
      });
      
      return response.effects.status.status === 'success';
    } catch (error) {
      console.error('Transaction validation failed:', error);
      return false;
    }
  }
}

// Export utility functions for ZK proof creation
export const createZKProof = (
  proofData: number[],
  publicInputs: number[],
  circuitType: number,
  timestamp?: number
): ZKProof => {
  return {
    proof_data: proofData,
    public_inputs: publicInputs,
    circuit_type: circuitType,
    proof_timestamp: timestamp || Date.now(),
    circuit_version: 1,
  };
};

// Export constants for circuit types
export const CIRCUIT_TYPES = {
  TRUST_SCORE: 0,
  INCOME_RANGE: 1,
  IDENTITY: 2,
  LOAN_HISTORY: 3,
} as const;

// Export constants for loan status
export const LOAN_STATUS = {
  PENDING: 0,
  FUNDED: 1,
  ACTIVE: 2,
  COMPLETED: 3,
  DEFAULTED: 4,
  DISPUTED: 5,
} as const;

// Export constants for payment types
export const PAYMENT_TYPES = {
  PRINCIPAL: 0,
  INTEREST: 1,
  PENALTY: 2,
} as const;