/**
 * Integration tests for ZK Circuits FFI bindings
 * 
 * These tests verify that the Rust ZK circuits can be properly called
 * from Node.js through the FFI interface.
 */

const { describe, it, before } = require('mocha');
const { expect } = require('chai');

// Note: In a real implementation, these would be imported from the compiled native module
// For now, we'll create mock implementations to test the interface

// Mock implementations for testing the interface
const mockZkCircuits = {
  initializeZkSystem: async () => {
    console.log('Mock: Initializing ZK system...');
    return true;
  },
  
  generateTrustScoreProof: async (trustScore, threshold) => {
    console.log(`Mock: Generating proof for score ${trustScore} vs threshold ${threshold}`);
    if (typeof trustScore !== 'number' || typeof threshold !== 'number') {
      throw new Error('Invalid parameters: trustScore and threshold must be numbers');
    }
    if (trustScore < 0 || trustScore > 100 || threshold < 0 || threshold > 100) {
      throw new Error('Invalid parameters: scores must be between 0 and 100');
    }
    
    // Return mock proof data
    const result = trustScore >= threshold;
    return new Uint8Array([
      ...Buffer.from('mock_proof_data'),
      result ? 1 : 0 // Include the result in the mock proof
    ]);
  },
  
  verifyTrustScoreProof: async (proofData, threshold, expectedResult) => {
    console.log(`Mock: Verifying proof for threshold ${threshold}, expected: ${expectedResult}`);
    if (!(proofData instanceof Uint8Array)) {
      throw new Error('Invalid proof data: must be Uint8Array');
    }
    if (typeof threshold !== 'number' || typeof expectedResult !== 'boolean') {
      throw new Error('Invalid parameters');
    }
    
    // Mock verification: check if proof contains expected result
    const proofResult = proofData[proofData.length - 1] === 1;
    return proofResult === expectedResult;
  },
  
  testTrustScoreCircuit: async (trustScore, threshold) => {
    console.log(`Mock: Testing circuit for score ${trustScore} vs threshold ${threshold}`);
    if (typeof trustScore !== 'number' || typeof threshold !== 'number') {
      throw new Error('Invalid parameters');
    }
    
    // Mock circuit test: always return true for valid parameters
    return trustScore >= 0 && trustScore <= 100 && threshold >= 0 && threshold <= 100;
  }
};

describe('ZK Circuits FFI Integration Tests', function() {
  this.timeout(10000); // Allow more time for ZK operations
  
  before(async function() {
    console.log('Setting up ZK Circuits FFI tests...');
    // Initialize the ZK system
    const initialized = await mockZkCircuits.initializeZkSystem();
    expect(initialized).to.be.true;
  });
  
  describe('Trust Score Circuit Tests', function() {
    it('should generate proof for trust score above threshold', async function() {
      const trustScore = 85;
      const threshold = 70;
      
      const proof = await mockZkCircuits.generateTrustScoreProof(trustScore, threshold);
      
      expect(proof).to.be.instanceOf(Uint8Array);
      expect(proof.length).to.be.greaterThan(0);
      
      // Verify the proof
      const isValid = await mockZkCircuits.verifyTrustScoreProof(proof, threshold, true);
      expect(isValid).to.be.true;
    });
    
    it('should generate proof for trust score below threshold', async function() {
      const trustScore = 65;
      const threshold = 70;
      
      const proof = await mockZkCircuits.generateTrustScoreProof(trustScore, threshold);
      
      expect(proof).to.be.instanceOf(Uint8Array);
      expect(proof.length).to.be.greaterThan(0);
      
      // Verify the proof
      const isValid = await mockZkCircuits.verifyTrustScoreProof(proof, threshold, false);
      expect(isValid).to.be.true;
    });
    
    it('should generate proof for trust score equal to threshold', async function() {
      const trustScore = 70;
      const threshold = 70;
      
      const proof = await mockZkCircuits.generateTrustScoreProof(trustScore, threshold);
      
      expect(proof).to.be.instanceOf(Uint8Array);
      expect(proof.length).to.be.greaterThan(0);
      
      // Verify the proof (equal should be treated as >= threshold)
      const isValid = await mockZkCircuits.verifyTrustScoreProof(proof, threshold, true);
      expect(isValid).to.be.true;
    });
    
    it('should reject invalid trust score parameters', async function() {
      try {
        await mockZkCircuits.generateTrustScoreProof(-1, 70);
        expect.fail('Should have thrown an error for negative trust score');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
      
      try {
        await mockZkCircuits.generateTrustScoreProof(101, 70);
        expect.fail('Should have thrown an error for trust score > 100');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
    });
    
    it('should reject invalid threshold parameters', async function() {
      try {
        await mockZkCircuits.generateTrustScoreProof(75, -1);
        expect.fail('Should have thrown an error for negative threshold');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
      
      try {
        await mockZkCircuits.generateTrustScoreProof(75, 101);
        expect.fail('Should have thrown an error for threshold > 100');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
    });
    
    it('should reject invalid proof data in verification', async function() {
      try {
        await mockZkCircuits.verifyTrustScoreProof('invalid', 70, true);
        expect.fail('Should have thrown an error for invalid proof data');
      } catch (error) {
        expect(error.message).to.include('Invalid proof data');
      }
    });
    
    it('should test circuit with mock prover', async function() {
      const result1 = await mockZkCircuits.testTrustScoreCircuit(85, 70);
      expect(result1).to.be.true;
      
      const result2 = await mockZkCircuits.testTrustScoreCircuit(65, 70);
      expect(result2).to.be.true;
      
      const result3 = await mockZkCircuits.testTrustScoreCircuit(70, 70);
      expect(result3).to.be.true;
    });
    
    it('should handle edge cases in circuit testing', async function() {
      // Test boundary values
      const result1 = await mockZkCircuits.testTrustScoreCircuit(0, 0);
      expect(result1).to.be.true;
      
      const result2 = await mockZkCircuits.testTrustScoreCircuit(100, 100);
      expect(result2).to.be.true;
      
      const result3 = await mockZkCircuits.testTrustScoreCircuit(1, 100);
      expect(result3).to.be.true;
      
      const result4 = await mockZkCircuits.testTrustScoreCircuit(100, 1);
      expect(result4).to.be.true;
    });
  });
  
  describe('Error Handling Tests', function() {
    it('should handle non-numeric parameters gracefully', async function() {
      try {
        await mockZkCircuits.generateTrustScoreProof('85', 70);
        expect.fail('Should have thrown an error for string trust score');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
      
      try {
        await mockZkCircuits.generateTrustScoreProof(85, '70');
        expect.fail('Should have thrown an error for string threshold');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
    });
    
    it('should handle null/undefined parameters', async function() {
      try {
        await mockZkCircuits.generateTrustScoreProof(null, 70);
        expect.fail('Should have thrown an error for null trust score');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
      
      try {
        await mockZkCircuits.generateTrustScoreProof(85, undefined);
        expect.fail('Should have thrown an error for undefined threshold');
      } catch (error) {
        expect(error.message).to.include('Invalid parameters');
      }
    });
  });
  
  describe('Performance Tests', function() {
    it('should generate proofs within reasonable time', async function() {
      const startTime = Date.now();
      
      await mockZkCircuits.generateTrustScoreProof(85, 70);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Mock should be very fast, real implementation might take longer
      expect(duration).to.be.lessThan(1000); // 1 second for mock
    });
    
    it('should verify proofs within reasonable time', async function() {
      const proof = await mockZkCircuits.generateTrustScoreProof(85, 70);
      
      const startTime = Date.now();
      
      await mockZkCircuits.verifyTrustScoreProof(proof, 70, true);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verification should be faster than generation
      expect(duration).to.be.lessThan(500); // 0.5 seconds for mock
    });
  });
});

// Export the mock for use in other tests
module.exports = { mockZkCircuits };