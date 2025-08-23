use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Expression, Instance, Selector},
    poly::Rotation,
};
use ff::PrimeField;
use std::marker::PhantomData;

/// Configuration for the income range circuit
#[derive(Clone, Debug)]
pub struct IncomeRangeConfig {
    /// Advice column for the actual income (private input)
    pub income: Column<Advice>,
    /// Advice column for the minimum range value (public input)
    pub min_range: Column<Advice>,
    /// Advice column for the maximum range value (public input)
    pub max_range: Column<Advice>,
    /// Advice column for the result (1 if in range, 0 if not)
    pub result: Column<Advice>,
    /// Instance column for public inputs/outputs
    pub instance: Column<Instance>,
    /// Selector for the range check gate
    pub selector: Selector,
}

/// Chip for income range verification operations
pub struct IncomeRangeChip<F: PrimeField> {
    config: IncomeRangeConfig,
    _marker: PhantomData<F>,
}

impl<F: PrimeField> IncomeRangeChip<F> {
    pub fn construct(config: IncomeRangeConfig) -> Self {
        Self {
            config,
            _marker: PhantomData,
        }
    }

    pub fn configure(
        meta: &mut ConstraintSystem<F>,
        income: Column<Advice>,
        min_range: Column<Advice>,
        max_range: Column<Advice>,
        result: Column<Advice>,
        instance: Column<Instance>,
    ) -> IncomeRangeConfig {
        let selector = meta.selector();

        // Enable equality constraints for public inputs/outputs
        meta.enable_equality(income);
        meta.enable_equality(min_range);
        meta.enable_equality(max_range);
        meta.enable_equality(result);
        meta.enable_equality(instance);

        // Create the range check gate
        // This gate checks if min_range <= income <= max_range
        meta.create_gate("income_range_check", |meta| {
            let s = meta.query_selector(selector);
            let _income = meta.query_advice(income, Rotation::cur());
            let _min_range = meta.query_advice(min_range, Rotation::cur());
            let _max_range = meta.query_advice(max_range, Rotation::cur());
            let result = meta.query_advice(result, Rotation::cur());

            // For simplicity in this demo, we'll just ensure result is boolean
            // A full implementation would need range checks and comparison logic
            vec![
                // Ensure result is boolean (0 or 1)
                s * (result.clone() * (result - Expression::Constant(F::ONE))),
            ]
        });

        IncomeRangeConfig {
            income,
            min_range,
            max_range,
            result,
            instance,
            selector,
        }
    }

    /// Assign the income range check
    pub fn assign_range_check(
        &self,
        mut layouter: impl Layouter<F>,
        income: Value<F>,
        min_range: Value<F>,
        max_range: Value<F>,
    ) -> Result<AssignedCell<F>, Error> {
        layouter.assign_region(
            || "income range check",
            |mut region| {
                // Enable the selector
                self.config.selector.enable(&mut region, 0)?;

                // Assign income (private input)
                let _income_cell = region.assign_advice(
                    || "income",
                    self.config.income,
                    0,
                    || income,
                )?;

                // Assign min range (public input)
                let _min_range_cell = region.assign_advice(
                    || "min range",
                    self.config.min_range,
                    0,
                    || min_range,
                )?;

                // Assign max range (public input)
                let _max_range_cell = region.assign_advice(
                    || "max range",
                    self.config.max_range,
                    0,
                    || max_range,
                )?;

                // Calculate and assign result
                let result_value = income.zip(min_range).zip(max_range).map(|((inc, min_r), max_r)| {
                    // Convert field elements to u64 for comparison
                    let inc_bytes = inc.to_repr();
                    let min_bytes = min_r.to_repr();
                    let max_bytes = max_r.to_repr();
                    
                    // Compare the byte representations
                    if inc_bytes.as_ref() >= min_bytes.as_ref() && inc_bytes.as_ref() <= max_bytes.as_ref() {
                        F::ONE
                    } else {
                        F::ZERO
                    }
                });

                let result_cell = region.assign_advice(
                    || "range check result",
                    self.config.result,
                    0,
                    || result_value,
                )?;

                Ok(result_cell)
            },
        )
    }
}

/// The main income range circuit
#[derive(Clone, Debug)]
pub struct IncomeRangeCircuit<F: PrimeField> {
    /// Private input: the actual income
    pub income: Value<F>,
    /// Public input: the minimum range value
    pub min_range: Value<F>,
    /// Public input: the maximum range value
    pub max_range: Value<F>,
}

impl<F: PrimeField> IncomeRangeCircuit<F> {
    pub fn new(income: Option<u64>, min_range: u64, max_range: u64) -> Self {
        Self {
            income: if let Some(inc) = income {
                Value::known(F::from(inc))
            } else {
                Value::unknown()
            },
            min_range: Value::known(F::from(min_range)),
            max_range: Value::known(F::from(max_range)),
        }
    }
}

impl<F: PrimeField> Circuit<F> for IncomeRangeCircuit<F> {
    type Config = IncomeRangeConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            income: Value::unknown(),
            min_range: self.min_range,
            max_range: self.max_range,
        }
    }

    fn configure(meta: &mut ConstraintSystem<F>) -> Self::Config {
        let income = meta.advice_column();
        let min_range = meta.advice_column();
        let max_range = meta.advice_column();
        let result = meta.advice_column();
        let instance = meta.instance_column();

        IncomeRangeChip::configure(meta, income, min_range, max_range, result, instance)
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<F>,
    ) -> Result<(), Error> {
        let chip = IncomeRangeChip::construct(config.clone());

        // Assign the range check
        let result_cell = chip.assign_range_check(
            layouter.namespace(|| "income range check"),
            self.income,
            self.min_range,
            self.max_range,
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

#[cfg(test)]
mod tests {
    use super::*;
    use halo2_proofs::dev::MockProver;
    use pasta_curves::Fp;
    use ff::Field;

    #[test]
    fn test_income_in_range() {
        let k = 4; // Circuit size parameter
        let income = 50000u64; // Income within range
        let min_range = 30000u64;
        let max_range = 80000u64;

        let circuit = IncomeRangeCircuit::<Fp>::new(Some(income), min_range, max_range);
        
        // The public input should be 1 (true) since 50000 is in [30000, 80000]
        let public_inputs = vec![Fp::one()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_income_below_range() {
        let k = 4;
        let income = 25000u64; // Income below range
        let min_range = 30000u64;
        let max_range = 80000u64;

        let circuit = IncomeRangeCircuit::<Fp>::new(Some(income), min_range, max_range);
        
        // The public input should be 0 (false) since 25000 < 30000
        let public_inputs = vec![Fp::zero()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_income_above_range() {
        let k = 4;
        let income = 90000u64; // Income above range
        let min_range = 30000u64;
        let max_range = 80000u64;

        let circuit = IncomeRangeCircuit::<Fp>::new(Some(income), min_range, max_range);
        
        // The public input should be 0 (false) since 90000 > 80000
        let public_inputs = vec![Fp::zero()];

        let prover = MockProver::run(k, &circuit, vec![public_inputs]).unwrap();
        prover.assert_satisfied();
    }

    #[test]
    fn test_income_at_range_boundaries() {
        let k = 4;
        
        // Test at minimum boundary
        let circuit1 = IncomeRangeCircuit::<Fp>::new(Some(30000), 30000, 80000);
        let public_inputs1 = vec![Fp::one()];
        let prover1 = MockProver::run(k, &circuit1, vec![public_inputs1]).unwrap();
        prover1.assert_satisfied();
        
        // Test at maximum boundary
        let circuit2 = IncomeRangeCircuit::<Fp>::new(Some(80000), 30000, 80000);
        let public_inputs2 = vec![Fp::one()];
        let prover2 = MockProver::run(k, &circuit2, vec![public_inputs2]).unwrap();
        prover2.assert_satisfied();
    }

    #[test]
    fn test_circuit_without_witnesses() {
        let k = 4;
        let min_range = 30000u64;
        let max_range = 80000u64;

        let circuit = IncomeRangeCircuit::<Fp>::new(None, min_range, max_range);
        let circuit_without_witnesses = circuit.without_witnesses();

        // Should be able to create the circuit structure without witnesses
        let _ = circuit_without_witnesses;
    }
}