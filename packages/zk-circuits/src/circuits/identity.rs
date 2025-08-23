use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Expression, Instance, Selector},
    poly::Rotation,
};
use ff::PrimeField;
use std::marker::PhantomData;

/// Configuration for the identity verification circuit
#[derive(Clone, Debug)]
pub struct IdentityConfig {
    /// Advice column for the identity hash (private input)
    pub identity_hash: Column<Advice>,
    /// Advice column for the commitment (public input)
    pub commitment: Column<Advice>,
    /// Advice column for the verification result
    pub result: Column<Advice>,
    /// Instance column for public inputs/outputs
    pub instance: Column<Instance>,
    /// Selector for the identity verification gate
    pub selector: Selector,
}

/// Chip for identity verification operations
pub struct IdentityChip<F: PrimeField> {
    config: IdentityConfig,
    _marker: PhantomData<F>,
}

impl<F: PrimeField> IdentityChip<F> {
    pub fn construct(config: IdentityConfig) -> Self {
        Self {
            config,
            _marker: PhantomData,
        }
    }

    pub fn configure(
        meta: &mut ConstraintSystem<F>,
        identity_hash: Column<Advice>,
        commitment: Column<Advice>,
        result: Column<Advice>,
        instance: Column<Instance>,
    ) -> IdentityConfig {
        let selector = meta.selector();

        // Enable equality constraints for public inputs/outputs
        meta.enable_equality(identity_hash);
        meta.enable_equality(commitment);
        meta.enable_equality(result);
        meta.enable_equality(instance);

        // Create the identity verification gate
        // This gate checks if the identity hash matches the commitment
        meta.create_gate("identity_verification", |meta| {
            let s = meta.query_selector(selector);
            let _identity_hash = meta.query_advice(identity_hash, Rotation::cur());
            let _commitment = meta.query_advice(commitment, Rotation::cur());
            let result = meta.query_advice(result, Rotation::cur());

            // For simplicity in this demo, we'll just ensure result is boolean
            // A full implementation would include commitment scheme verification
            vec![
                // Ensure result is boolean (0 or 1)
                s * (result.clone() * (result - Expression::Constant(F::ONE))),
            ]
        });

        IdentityConfig {
            identity_hash,
            commitment,
            result,
            instance,
            selector,
        }
    }

    /// Assign the identity verification
    pub fn assign_identity_verification(
        &self,
        mut layouter: impl Layouter<F>,
        identity_hash: Value<F>,
        commitment: Value<F>,
    ) -> Result<AssignedCell<F>, Error> {
        layouter.assign_region(
            || "identity verification",
            |mut region| {
                // Enable the selector
                self.config.selector.enable(&mut region, 0)?;

                // Assign identity hash (private input)
                let _identity_hash_cell = region.assign_advice(
                    || "identity hash",
                    self.config.identity_hash,
                    0,
                    || identity_hash,
                )?;

                // Assign commitment (public input)
                let _commitment_cell = region.assign_advice(
                    || "commitment",
                    self.config.commitment,
                    0,
                    || commitment,
                )?;

                // Calculate and assign result
                // In a real implementation, this would verify the commitment scheme
                let result_value = identity_hash.zip(commitment).map(|(hash, comm)| {
                    // Simple equality check for demonstration
                    // In practice, this would be a more complex commitment verification
                    if hash == comm {
                        F::ONE
                    } else {
                        F::ZERO
                    }
                });

                let result_cell = region.assign_advice(
                    || "verification result",
                    self.config.result,
                    0,
                    || result_value,
                )?;

                Ok(result_cell)
            },
        )
    }
}

/// The main identity verification circuit
#[derive(Clone, Debug)]
pub struct IdentityCircuit<F: PrimeField> {
    /// Private input: the identity hash
    pub identity_hash: Value<F>,
    /// Public input: the commitment to verify against
    pub commitment: Value<F>,
}

impl<F: PrimeField> IdentityCircuit<F> {
    pub fn new(identity_hash: Option<u64>, commitment: u64) -> Self {
        Self {
            identity_hash: if let Some(hash) = identity_hash {
                Value::known(F::from(hash))
            } else {
                Value::unknown()
            },
            commitment: Value::known(F::from(commitment)),
        }
    }

    /// Create a new circuit with field elements directly
    pub fn new_with_fields(identity_hash: Value<F>, commitment: Value<F>) -> Self {
        Self {
            identity_hash,
            commitment,
        }
    }
}

impl<F: PrimeField> Circuit<F> for IdentityCircuit<F> {
    type Config = IdentityConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            identity_hash: Value::unknown(),
            commitment: self.commitment,
        }
    }

    fn configure(meta: &mut ConstraintSystem<F>) -> Self::Config {
        let identity_hash = meta.advice_column();
        let commitment = meta.advice_column();
        let result = meta.advice_column();
        let instance = meta.instance_column();

        IdentityChip::configure(meta, identity_hash, commitment, result, instance)
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<F>,
    ) -> Result<(), Error> {
        let chip = IdentityChip::construct(config.clone());

        // Assign the identity verification
        let result_cell = chip.assign_identity_verification(
            layouter.namespace(|| "identity verification"),
            self.identity_hash,
            self.commitment,
        )?;

        // Expose the result as public input (instance 0)
        layouter.constrain_instance(
            result_cell.cell(),
            config.instance,
            0,
        )?;

        Ok(())
    }
}

/// Helper type for assigned cells
pub type AssignedCell<F> = halo2_proofs::circuit::AssignedCell<F, F>;

/// Utility functions for identity verification
pub mod utils {
    use super::*;
    
    /// Simple hash function for demonstration (not cryptographically secure)
    pub fn simple_hash(data: &[u8]) -> u64 {
        let mut hash = 0u64;
        for &byte in data {
            hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
        }
        hash
    }
    
    /// Create a commitment to an identity (simplified)
    pub fn create_commitment(identity_data: &[u8], nonce: u64) -> u64 {
        let identity_hash = simple_hash(identity_data);
        identity_hash.wrapping_add(nonce)
    }
    
    /// Verify an identity commitment
    pub fn verify_commitment(identity_data: &[u8], nonce: u64, commitment: u64) -> bool {
        let expected_commitment = create_commitment(identity_data, nonce);
        expected_commitment == commitment
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::utils::*;
    use halo2_proofs::dev::MockProver;
    use pasta_curves::Fp;
    use ff::Field;

    #[test]
    fn test_identity_verification_success() {
        let k = 4; // Circuit size parameter
        
        // Create identity data and commitment
        let identity_data = b"user123@example.com";
        let nonce = 12345u64;
        let commitment = create_commitment(identity_data, nonce);
        let identity_hash = simple_hash(identity_data).wrapping_add(nonce);

        let circuit = IdentityCircuit::<Fp>::new(Some(identity_hash), commitment);
        
        // The public input should be 1 (true) since the commitment matches
        let public_inputs = vec![Fp::one()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_identity_verification_failure() {
        let k = 4;
        
        // Create identity data and commitment
        let identity_data = b"user123@example.com";
        let nonce = 12345u64;
        let commitment = create_commitment(identity_data, nonce);
        let wrong_identity_hash = simple_hash(b"wrong_user").wrapping_add(nonce);

        let circuit = IdentityCircuit::<Fp>::new(Some(wrong_identity_hash), commitment);
        
        // The public input should be 0 (false) since the commitment doesn't match
        let public_inputs = vec![Fp::zero()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_identity_verification_with_field_elements() {
        let k = 4;
        
        // Test with matching field elements
        let identity_hash = Fp::from(12345u64);
        let commitment = Fp::from(12345u64);

        let circuit = IdentityCircuit::<Fp>::new_with_fields(
            Value::known(identity_hash),
            Value::known(commitment),
        );
        
        let public_inputs = vec![Fp::one()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_identity_verification_different_values() {
        let k = 4;
        
        // Test with different field elements
        let identity_hash = Fp::from(12345u64);
        let commitment = Fp::from(54321u64);

        let circuit = IdentityCircuit::<Fp>::new_with_fields(
            Value::known(identity_hash),
            Value::known(commitment),
        );
        
        let public_inputs = vec![Fp::zero()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_circuit_without_witnesses() {
        let k = 4;
        let commitment = 12345u64;

        let circuit = IdentityCircuit::<Fp>::new(None, commitment);
        let circuit_without_witnesses = circuit.without_witnesses();

        // Should be able to create the circuit structure without witnesses
        let _ = circuit_without_witnesses;
    }

    #[test]
    fn test_utility_functions() {
        let identity_data = b"test@example.com";
        let nonce = 98765u64;
        
        // Test hash function
        let hash1 = simple_hash(identity_data);
        let hash2 = simple_hash(identity_data);
        assert_eq!(hash1, hash2); // Hash should be deterministic
        
        let different_data = b"different@example.com";
        let hash3 = simple_hash(different_data);
        assert_ne!(hash1, hash3); // Different data should produce different hash
        
        // Test commitment functions
        let commitment = create_commitment(identity_data, nonce);
        assert!(verify_commitment(identity_data, nonce, commitment));
        assert!(!verify_commitment(different_data, nonce, commitment));
        assert!(!verify_commitment(identity_data, nonce + 1, commitment));
    }
}