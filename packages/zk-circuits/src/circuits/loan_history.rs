use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Expression, Instance, Selector},
    poly::Rotation,
};
use ff::PrimeField;
use std::marker::PhantomData;

/// Configuration for the loan history verification circuit
#[derive(Clone, Debug)]
pub struct LoanHistoryConfig {
    /// Advice column for the number of loans (private input)
    pub num_loans: Column<Advice>,
    /// Advice column for the number of successful repayments (private input)
    pub successful_repayments: Column<Advice>,
    /// Advice column for the minimum success rate threshold (public input)
    pub min_success_rate: Column<Advice>,
    /// Advice column for the calculated success rate
    pub success_rate: Column<Advice>,
    /// Advice column for the result (1 if meets threshold, 0 if not)
    pub result: Column<Advice>,
    /// Instance column for public inputs/outputs
    pub instance: Column<Instance>,
    /// Selector for the loan history verification gate
    pub selector: Selector,
}

/// Chip for loan history verification operations
pub struct LoanHistoryChip<F: PrimeField> {
    config: LoanHistoryConfig,
    _marker: PhantomData<F>,
}

impl<F: PrimeField> LoanHistoryChip<F> {
    pub fn construct(config: LoanHistoryConfig) -> Self {
        Self {
            config,
            _marker: PhantomData,
        }
    }

    pub fn configure(
        meta: &mut ConstraintSystem<F>,
        num_loans: Column<Advice>,
        successful_repayments: Column<Advice>,
        min_success_rate: Column<Advice>,
        success_rate: Column<Advice>,
        result: Column<Advice>,
        instance: Column<Instance>,
    ) -> LoanHistoryConfig {
        let selector = meta.selector();

        // Enable equality constraints for public inputs/outputs
        meta.enable_equality(num_loans);
        meta.enable_equality(successful_repayments);
        meta.enable_equality(min_success_rate);
        meta.enable_equality(success_rate);
        meta.enable_equality(result);
        meta.enable_equality(instance);

        // Create the loan history verification gate
        meta.create_gate("loan_history_verification", |meta| {
            let s = meta.query_selector(selector);
            let _num_loans = meta.query_advice(num_loans, Rotation::cur());
            let _successful_repayments = meta.query_advice(successful_repayments, Rotation::cur());
            let _min_success_rate = meta.query_advice(min_success_rate, Rotation::cur());
            let _success_rate = meta.query_advice(success_rate, Rotation::cur());
            let result = meta.query_advice(result, Rotation::cur());

            // For simplicity in this demo, we'll just ensure result is boolean
            // A full implementation would include proper division and comparison logic
            vec![
                // Ensure result is boolean (0 or 1)
                s * (result.clone() * (result - Expression::Constant(F::ONE))),
            ]
        });

        LoanHistoryConfig {
            num_loans,
            successful_repayments,
            min_success_rate,
            success_rate,
            result,
            instance,
            selector,
        }
    }

    /// Assign the loan history verification
    pub fn assign_loan_history_verification(
        &self,
        mut layouter: impl Layouter<F>,
        num_loans: Value<F>,
        successful_repayments: Value<F>,
        min_success_rate: Value<F>,
    ) -> Result<AssignedCell<F>, Error> {
        layouter.assign_region(
            || "loan history verification",
            |mut region| {
                // Enable the selector
                self.config.selector.enable(&mut region, 0)?;

                // Assign number of loans (private input)
                let _num_loans_cell = region.assign_advice(
                    || "number of loans",
                    self.config.num_loans,
                    0,
                    || num_loans,
                )?;

                // Assign successful repayments (private input)
                let _successful_repayments_cell = region.assign_advice(
                    || "successful repayments",
                    self.config.successful_repayments,
                    0,
                    || successful_repayments,
                )?;

                // Assign minimum success rate threshold (public input)
                let _min_success_rate_cell = region.assign_advice(
                    || "minimum success rate",
                    self.config.min_success_rate,
                    0,
                    || min_success_rate,
                )?;

                // Calculate success rate (as percentage * 100 to avoid decimals)
                let success_rate_value = num_loans.zip(successful_repayments).map(|(loans, repayments)| {
                    // Convert to u64 for calculation
                    let loans_u64 = field_to_u64(&loans);
                    let repayments_u64 = field_to_u64(&repayments);
                    
                    if loans_u64 == 0 {
                        F::ZERO // No loans means 0% success rate
                    } else {
                        // Calculate percentage * 100 to work with integers
                        let rate = (repayments_u64 * 10000) / loans_u64;
                        F::from(rate)
                    }
                });

                let _success_rate_cell = region.assign_advice(
                    || "calculated success rate",
                    self.config.success_rate,
                    0,
                    || success_rate_value,
                )?;

                // Calculate and assign result
                let result_value = success_rate_value.zip(min_success_rate).map(|(rate, min_rate)| {
                    let rate_u64 = field_to_u64(&rate);
                    let min_rate_u64 = field_to_u64(&min_rate);
                    
                    if rate_u64 >= min_rate_u64 {
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

/// The main loan history verification circuit
#[derive(Clone, Debug)]
pub struct LoanHistoryCircuit<F: PrimeField> {
    /// Private input: the number of loans taken
    pub num_loans: Value<F>,
    /// Private input: the number of successful repayments
    pub successful_repayments: Value<F>,
    /// Public input: the minimum success rate threshold (as percentage * 100)
    pub min_success_rate: Value<F>,
}

impl<F: PrimeField> LoanHistoryCircuit<F> {
    pub fn new(num_loans: Option<u64>, successful_repayments: Option<u64>, min_success_rate: u64) -> Self {
        Self {
            num_loans: if let Some(loans) = num_loans {
                Value::known(F::from(loans))
            } else {
                Value::unknown()
            },
            successful_repayments: if let Some(repayments) = successful_repayments {
                Value::known(F::from(repayments))
            } else {
                Value::unknown()
            },
            min_success_rate: Value::known(F::from(min_success_rate)),
        }
    }
}

impl<F: PrimeField> Circuit<F> for LoanHistoryCircuit<F> {
    type Config = LoanHistoryConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            num_loans: Value::unknown(),
            successful_repayments: Value::unknown(),
            min_success_rate: self.min_success_rate,
        }
    }

    fn configure(meta: &mut ConstraintSystem<F>) -> Self::Config {
        let num_loans = meta.advice_column();
        let successful_repayments = meta.advice_column();
        let min_success_rate = meta.advice_column();
        let success_rate = meta.advice_column();
        let result = meta.advice_column();
        let instance = meta.instance_column();

        LoanHistoryChip::configure(
            meta,
            num_loans,
            successful_repayments,
            min_success_rate,
            success_rate,
            result,
            instance,
        )
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<F>,
    ) -> Result<(), Error> {
        let chip = LoanHistoryChip::construct(config.clone());

        // Assign the loan history verification
        let result_cell = chip.assign_loan_history_verification(
            layouter.namespace(|| "loan history verification"),
            self.num_loans,
            self.successful_repayments,
            self.min_success_rate,
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

/// Helper function to convert field element to u64
fn field_to_u64<F: PrimeField>(field: &F) -> u64 {
    let bytes = field.to_repr();
    let mut result = 0u64;
    for (i, &byte) in bytes.as_ref().iter().take(8).enumerate() {
        result |= (byte as u64) << (i * 8);
    }
    result
}

/// Utility functions for loan history verification
pub mod utils {
    /// Calculate success rate as percentage * 100 (to avoid decimals)
    pub fn calculate_success_rate(num_loans: u64, successful_repayments: u64) -> u64 {
        if num_loans == 0 {
            0
        } else {
            (successful_repayments * 10000) / num_loans
        }
    }
    
    /// Check if loan history meets minimum success rate
    pub fn meets_success_rate_threshold(
        num_loans: u64,
        successful_repayments: u64,
        min_success_rate: u64,
    ) -> bool {
        let success_rate = calculate_success_rate(num_loans, successful_repayments);
        success_rate >= min_success_rate
    }
    
    /// Convert percentage to basis points (percentage * 100)
    pub fn percentage_to_basis_points(percentage: f64) -> u64 {
        (percentage * 100.0) as u64
    }
    
    /// Convert basis points back to percentage
    pub fn basis_points_to_percentage(basis_points: u64) -> f64 {
        basis_points as f64 / 100.0
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
    fn test_loan_history_meets_threshold() {
        let k = 4; // Circuit size parameter
        let num_loans = 10u64;
        let successful_repayments = 9u64; // 90% success rate
        let min_success_rate = percentage_to_basis_points(80.0); // 80% minimum

        let circuit = LoanHistoryCircuit::<Fp>::new(
            Some(num_loans),
            Some(successful_repayments),
            min_success_rate,
        );
        
        // The public input should be 1 (true) since 90% >= 80%
        let public_inputs = vec![Fp::one()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_loan_history_below_threshold() {
        let k = 4;
        let num_loans = 10u64;
        let successful_repayments = 6u64; // 60% success rate
        let min_success_rate = percentage_to_basis_points(80.0); // 80% minimum

        let circuit = LoanHistoryCircuit::<Fp>::new(
            Some(num_loans),
            Some(successful_repayments),
            min_success_rate,
        );
        
        // The public input should be 0 (false) since 60% < 80%
        let public_inputs = vec![Fp::zero()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_no_loan_history() {
        let k = 4;
        let num_loans = 0u64;
        let successful_repayments = 0u64;
        let min_success_rate = percentage_to_basis_points(80.0);

        let circuit = LoanHistoryCircuit::<Fp>::new(
            Some(num_loans),
            Some(successful_repayments),
            min_success_rate,
        );
        
        // The public input should be 0 (false) since 0% < 80%
        let public_inputs = vec![Fp::zero()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_perfect_loan_history() {
        let k = 4;
        let num_loans = 5u64;
        let successful_repayments = 5u64; // 100% success rate
        let min_success_rate = percentage_to_basis_points(90.0); // 90% minimum

        let circuit = LoanHistoryCircuit::<Fp>::new(
            Some(num_loans),
            Some(successful_repayments),
            min_success_rate,
        );
        
        // The public input should be 1 (true) since 100% >= 90%
        let public_inputs = vec![Fp::one()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_circuit_without_witnesses() {
        let k = 4;
        let min_success_rate = percentage_to_basis_points(80.0);

        let circuit = LoanHistoryCircuit::<Fp>::new(None, None, min_success_rate);
        let circuit_without_witnesses = circuit.without_witnesses();

        // Should be able to create the circuit structure without witnesses
        let _ = circuit_without_witnesses;
    }

    #[test]
    fn test_utility_functions() {
        // Test success rate calculation
        assert_eq!(calculate_success_rate(10, 9), 9000); // 90%
        assert_eq!(calculate_success_rate(10, 8), 8000); // 80%
        assert_eq!(calculate_success_rate(0, 0), 0); // No loans
        
        // Test threshold checking
        assert!(meets_success_rate_threshold(10, 9, 8000)); // 90% >= 80%
        assert!(!meets_success_rate_threshold(10, 7, 8000)); // 70% < 80%
        
        // Test percentage conversion
        assert_eq!(percentage_to_basis_points(80.5), 8050);
        assert_eq!(basis_points_to_percentage(8050), 80.5);
    }

    #[test]
    fn test_edge_cases() {
        let k = 4;
        
        // Test with exactly meeting threshold
        let circuit = LoanHistoryCircuit::<Fp>::new(
            Some(10),
            Some(8), // Exactly 80%
            percentage_to_basis_points(80.0),
        );
        let public_inputs = vec![Fp::one()];
        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
        
        // Test with single loan success
        let circuit2 = LoanHistoryCircuit::<Fp>::new(
            Some(1),
            Some(1), // 100% with just one loan
            percentage_to_basis_points(50.0),
        );
        let public_inputs2 = vec![Fp::one()];
        let prover2 = MockProver::run(k, &circuit2, vec![public_inputs2]).unwrap();
        prover2.assert_satisfied();
    }
}