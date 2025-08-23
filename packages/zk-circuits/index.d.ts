/**
 * TypeScript definitions for ZK Circuits Node.js bindings
 * 
 * This file provides type definitions for the Rust-based zero-knowledge proof
 * circuits that can be called from Node.js applications.
 */

/**
 * Initialize the ZK proof system with setup parameters.
 * This must be called before generating or verifying proofs.
 * 
 * @returns Promise<boolean> - true if initialization was successful
 * @throws Error if initialization fails
 */
export function initializeZkSystem(): Promise<boolean>;

/**
 * Generate a zero-knowledge proof that a trust score meets the threshold
 * without revealing the actual trust score value.
 * 
 * @param trustScore - The actual trust score (private input)
 * @param threshold - The threshold to compare against (public input)
 * @returns Promise<Uint8Array> - The generated proof data
 * @throws Error if proof generation fails
 */
export function generateTrustScoreProof(trustScore: number, threshold: number): Promise<Uint8Array>;

/**
 * Verify a trust score proof without learning the actual trust score.
 * 
 * @param proofData - The proof data to verify
 * @param threshold - The threshold that was used in proof generation
 * @param expectedResult - Whether the trust score should be above threshold
 * @returns Promise<boolean> - true if the proof is valid
 * @throws Error if verification fails
 */
export function verifyTrustScoreProof(proofData: Uint8Array, threshold: number, expectedResult: boolean): Promise<boolean>;

/**
 * Test the trust score circuit using a mock prover (for testing purposes).
 * This is useful for development and testing without full proof generation.
 * 
 * @param trustScore - The trust score to test
 * @param threshold - The threshold to compare against
 * @returns Promise<boolean> - true if the circuit constraints are satisfied
 * @throws Error if the test fails
 */
export function testTrustScoreCircuit(trustScore: number, threshold: number): Promise<boolean>;

/**
 * Result structure for proof operations (used internally)
 */
export interface ProofResult {
  success: boolean;
  proofData?: Uint8Array;
  errorMessage?: string;
}

/**
 * Parameters for trust score proof generation (used internally)
 */
export interface TrustScoreParams {
  trustScore: number;
  threshold: number;
}

/**
 * Error types that can be thrown by the ZK circuit functions
 */
export class ZkCircuitError extends Error {
  constructor(message: string);
}

/**
 * Utility functions for working with ZK proofs
 */
export namespace ZkUtils {
  /**
   * Convert a proof result to a more user-friendly format
   */
  export function formatProofResult(result: ProofResult): {
    isValid: boolean;
    proof?: string; // base64 encoded proof
    error?: string;
  };
  
  /**
   * Validate trust score parameters before proof generation
   */
  export function validateTrustScoreParams(trustScore: number, threshold: number): {
    isValid: boolean;
    errors: string[];
  };
}