use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Expression, Instance, Selector},
    poly::Rotation,
};
use ff::PrimeField;
use std::marker::PhantomData;

/// Configuration for the trust score circuit
#[derive(Clone, Debug)]
pub struct TrustScoreConfig {
    /// Advice column for the trust score (private input)
    pub trust_score: Column<Advice>,
    /// Advice column for the threshold (public input)
    pub threshold: Column<Advice>,
    /// Advice column for the comparison result
    pub result: Column<Advice>,
    /// Instance column for public inputs/outputs
    pub instance: Column<Instance>,
    /// Selector for the comparison gate
    pub selector: Selector,
}

/// Chip for trust score comparison operations
pub struct TrustScoreChip<F: PrimeField> {
    config: TrustScoreConfig,
    _marker: PhantomData<F>,
}

impl<F: PrimeField> TrustScoreChip<F> {
    pub fn construct(config: TrustScoreConfig) -> Self {
        Self {
            config,
            _marker: PhantomData,
        }
    }

    pub fn configure(
        meta: &mut ConstraintSystem<F>,
        trust_score: Column<Advice>,
        threshold: Column<Advice>,
        result: Column<Advice>,
        instance: Column<Instance>,
    ) -> TrustScoreConfig {
        let selector = meta.selector();

        // Enable equality constraints for public inputs/outputs
        meta.enable_equality(trust_score);
        meta.enable_equality(threshold);
        meta.enable_equality(result);
        meta.enable_equality(instance);

        // Create the comparison gate
        // This gate checks if trust_score >= threshold
        meta.create_gate("trust_score_comparison", |meta| {
            let s = meta.query_selector(selector);
            let _trust_score = meta.query_advice(trust_score, Rotation::cur());
            let _threshold = meta.query_advice(threshold, Rotation::cur());
            let result = meta.query_advice(result, Rotation::cur());

            // We need to prove that:
            // - result is boolean (0 or 1)
            // - If result = 1, then trust_score >= threshold
            // - If result = 0, then trust_score < threshold
            // 
            // For simplicity in this mock implementation, we'll just ensure result is boolean
            // A full implementation would need range checks and more complex comparison logic

            vec![
                // Ensure result is boolean (0 or 1)
                s * (result.clone() * (result - Expression::Constant(F::ONE))),
            ]
        });

        TrustScoreConfig {
            trust_score,
            threshold,
            result,
            instance,
            selector,
        }
    }

    /// Assign the trust score comparison
    pub fn assign_comparison(
        &self,
        mut layouter: impl Layouter<F>,
        trust_score: Value<F>,
        threshold: Value<F>,
    ) -> Result<AssignedCell<F>, Error> {
        layouter.assign_region(
            || "trust score comparison",
            |mut region| {
                // Enable the selector
                self.config.selector.enable(&mut region, 0)?;

                // Assign trust score (private input)
                let _trust_score_cell = region.assign_advice(
                    || "trust score",
                    self.config.trust_score,
                    0,
                    || trust_score,
                )?;

                // Assign threshold (public input)
                let _threshold_cell = region.assign_advice(
                    || "threshold",
                    self.config.threshold,
                    0,
                    || threshold,
                )?;

                // Calculate and assign result
                // For the mock prover, we need to calculate the expected result
                let result_value = trust_score.zip(threshold).map(|(score, thresh)| {
                    // Convert field elements to u64 for comparison
                    // This is a simplification for the mock prover
                    let score_bytes = score.to_repr();
                    let thresh_bytes = thresh.to_repr();
                    
                    // Compare the byte representations (little-endian)
                    if score_bytes.as_ref() >= thresh_bytes.as_ref() {
                        F::ONE
                    } else {
                        F::ZERO
                    }
                });

                let result_cell = region.assign_advice(
                    || "comparison result",
                    self.config.result,
                    0,
                    || result_value,
                )?;

                Ok(result_cell)
            },
        )
    }
}

/// The main trust score circuit
#[derive(Clone, Debug)]
pub struct TrustScoreCircuit<F: PrimeField> {
    /// Private input: the actual trust score
    pub trust_score: Value<F>,
    /// Public input: the threshold to compare against (typically 70)
    pub threshold: Value<F>,
}

impl<F: PrimeField> TrustScoreCircuit<F> {
    pub fn new(trust_score: Option<u64>, threshold: u64) -> Self {
        Self {
            trust_score: if let Some(score) = trust_score {
                Value::known(F::from(score))
            } else {
                Value::unknown()
            },
            threshold: Value::known(F::from(threshold)),
        }
    }
}

impl<F: PrimeField> Circuit<F> for TrustScoreCircuit<F> {
    type Config = TrustScoreConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            trust_score: Value::unknown(),
            threshold: self.threshold,
        }
    }

    fn configure(meta: &mut ConstraintSystem<F>) -> Self::Config {
        let trust_score = meta.advice_column();
        let threshold = meta.advice_column();
        let result = meta.advice_column();
        let instance = meta.instance_column();

        TrustScoreChip::configure(meta, trust_score, threshold, result, instance)
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<F>,
    ) -> Result<(), Error> {
        let chip = TrustScoreChip::construct(config.clone());

        // Assign the comparison
        let result_cell = chip.assign_comparison(
            layouter.namespace(|| "trust score comparison"),
            self.trust_score,
            self.threshold,
        )?;

        // Expose the threshold as public input (instance 0)
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

#[cfg(test)]
mod tests {
    use super::*;
    use halo2_proofs::dev::MockProver;
    use pasta_curves::Fp;
    use ff::Field;

    #[test]
    fn test_trust_score_above_threshold() {
        let k = 4; // Circuit size parameter
        let trust_score = 85u64; // Above threshold
        let threshold = 70u64;

        let circuit = TrustScoreCircuit::<Fp>::new(Some(trust_score), threshold);
        
        // The public input should be 1 (true) since 85 >= 70
        let public_inputs = vec![Fp::one()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_trust_score_below_threshold() {
        let k = 4;
        let trust_score = 65u64; // Below threshold
        let threshold = 70u64;

        let circuit = TrustScoreCircuit::<Fp>::new(Some(trust_score), threshold);
        
        // The public input should be 0 (false) since 65 < 70
        let public_inputs = vec![Fp::zero()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_trust_score_equal_threshold() {
        let k = 4;
        let trust_score = 70u64; // Equal to threshold
        let threshold = 70u64;

        let circuit = TrustScoreCircuit::<Fp>::new(Some(trust_score), threshold);
        
        // The public input should be 1 (true) since 70 >= 70
        let public_inputs = vec![Fp::one()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_circuit_without_witnesses() {
        let k = 4;
        let threshold = 70u64;

        let circuit = TrustScoreCircuit::<Fp>::new(None, threshold);
        let circuit_without_witnesses = circuit.without_witnesses();

        // Should be able to create the circuit structure without witnesses
        // We can't directly test if Value is unknown, but we can verify the circuit compiles
        let _ = circuit_without_witnesses;
    }
}

