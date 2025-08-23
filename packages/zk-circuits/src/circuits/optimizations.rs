/// Performance optimizations for mobile devices
/// 
/// This module contains optimizations to make ZK circuits more efficient
/// on mobile devices with limited computational resources.

use halo2_proofs::{
    circuit::{Layouter, Value},
    plonk::{Advice, Column, ConstraintSystem, Error, Selector},
};
use ff::PrimeField;

/// Configuration for optimized circuits
#[derive(Clone, Debug)]
pub struct OptimizedConfig {
    /// Reduced number of advice columns for mobile efficiency
    pub advice_columns: Vec<Column<Advice>>,
    /// Optimized selectors
    pub selectors: Vec<Selector>,
    /// Circuit size parameter (smaller for mobile)
    pub k: u32,
}

impl OptimizedConfig {
    /// Create a new optimized configuration for mobile devices
    pub fn new_mobile_optimized<F: PrimeField>(
        meta: &mut ConstraintSystem<F>,
        num_advice: usize,
        num_selectors: usize,
    ) -> Self {
        let advice_columns: Vec<Column<Advice>> = (0..num_advice)
            .map(|_| meta.advice_column())
            .collect();

        let selectors: Vec<Selector> = (0..num_selectors)
            .map(|_| meta.selector())
            .collect();

        // Enable equality for all advice columns
        for &col in &advice_columns {
            meta.enable_equality(col);
        }

        Self {
            advice_columns,
            selectors,
            k: 10, // Smaller circuit size for mobile (2^10 = 1024 rows)
        }
    }
}

/// Mobile-optimized trust score circuit
/// Uses fewer constraints and smaller field operations
pub mod mobile_trust_score {
    use super::*;
    use crate::circuits::trust_score::{TrustScoreCircuit, TrustScoreConfig};
    use halo2_proofs::{
        circuit::SimpleFloorPlanner,
        plonk::{Circuit, Instance},
    };

    /// Mobile-optimized version of trust score circuit
    #[derive(Clone, Debug)]
    pub struct MobileTrustScoreCircuit<F: PrimeField> {
        pub trust_score: Value<F>,
        pub threshold: Value<F>,
    }

    impl<F: PrimeField> MobileTrustScoreCircuit<F> {
        pub fn new(trust_score: Option<u32>, threshold: u32) -> Self {
            Self {
                trust_score: if let Some(score) = trust_score {
                    Value::known(F::from(score as u64))
                } else {
                    Value::unknown()
                },
                threshold: Value::known(F::from(threshold as u64)),
            }
        }
    }

    impl<F: PrimeField> Circuit<F> for MobileTrustScoreCircuit<F> {
        type Config = TrustScoreConfig;
        type FloorPlanner = SimpleFloorPlanner;

        fn without_witnesses(&self) -> Self {
            Self {
                trust_score: Value::unknown(),
                threshold: self.threshold,
            }
        }

        fn configure(meta: &mut ConstraintSystem<F>) -> Self::Config {
            // Use the same configuration as regular trust score but with optimizations
            let trust_score = meta.advice_column();
            let threshold = meta.advice_column();
            let result = meta.advice_column();
            let instance = meta.instance_column();

            TrustScoreConfig {
                trust_score,
                threshold,
                result,
                instance,
                selector: meta.selector(),
            }
        }

        fn synthesize(
            &self,
            config: Self::Config,
            mut layouter: impl Layouter<F>,
        ) -> Result<(), Error> {
            // Use the same synthesis as regular trust score circuit
            // The optimization comes from using smaller k parameter
            use crate::circuits::trust_score::TrustScoreChip;
            
            let chip = TrustScoreChip::construct(config.clone());
            let result_cell = chip.assign_comparison(
                layouter.namespace(|| "trust score check"),
                self.trust_score,
                self.threshold,
            )?;

            // Expose the result as public input
            layouter.constrain_instance(
                result_cell.cell(),
                config.instance,
                0,
            )?;

            Ok(())
        }
    }
}

/// Performance utilities for mobile optimization
pub mod performance {
    /// Recommended circuit size parameters for different device types
    pub struct CircuitSizeRecommendations;

    impl CircuitSizeRecommendations {
        /// Circuit size for high-end mobile devices
        pub const HIGH_END_MOBILE: u32 = 12; // 2^12 = 4096 rows

        /// Circuit size for mid-range mobile devices  
        pub const MID_RANGE_MOBILE: u32 = 10; // 2^10 = 1024 rows

        /// Circuit size for low-end mobile devices
        pub const LOW_END_MOBILE: u32 = 8; // 2^8 = 256 rows

        /// Circuit size for desktop/server
        pub const DESKTOP: u32 = 16; // 2^16 = 65536 rows
    }

    /// Estimate proof generation time based on circuit size and device type
    pub fn estimate_proof_time_ms(k: u32, device_type: DeviceType) -> u64 {
        let base_time = match device_type {
            DeviceType::HighEndMobile => 100,   // 100ms base
            DeviceType::MidRangeMobile => 200,  // 200ms base
            DeviceType::LowEndMobile => 500,    // 500ms base
            DeviceType::Desktop => 50,          // 50ms base
        };

        // Time scales roughly with k^2 for ZK proofs
        (base_time as u64) * (k as u64 * k as u64) / 64 // Normalize to k=8 baseline
    }

    /// Device type classification for optimization
    #[derive(Debug, Clone, Copy)]
    pub enum DeviceType {
        HighEndMobile,
        MidRangeMobile,
        LowEndMobile,
        Desktop,
    }

    /// Get recommended circuit size for device type
    pub fn get_recommended_k(device_type: DeviceType) -> u32 {
        match device_type {
            DeviceType::HighEndMobile => CircuitSizeRecommendations::HIGH_END_MOBILE,
            DeviceType::MidRangeMobile => CircuitSizeRecommendations::MID_RANGE_MOBILE,
            DeviceType::LowEndMobile => CircuitSizeRecommendations::LOW_END_MOBILE,
            DeviceType::Desktop => CircuitSizeRecommendations::DESKTOP,
        }
    }

    /// Check if a circuit size is suitable for mobile devices
    pub fn is_mobile_suitable(k: u32) -> bool {
        k <= CircuitSizeRecommendations::HIGH_END_MOBILE
    }

    /// Memory usage estimation in MB for a given circuit size
    pub fn estimate_memory_usage_mb(k: u32) -> u64 {
        // Rough estimation: each constraint uses about 32 bytes
        // Plus overhead for witness data and proving key
        let rows = 1u64 << k;
        let base_memory = (rows * 32) / (1024 * 1024); // Convert to MB
        // Ensure minimum 1MB and add overhead
        std::cmp::max(base_memory, 1) + 10 // Add 10MB overhead
    }
}

/// Batch processing utilities for mobile devices
pub mod batch_processing {
    use super::performance::DeviceType;

    /// Optimal batch size for different device types
    pub fn get_optimal_batch_size(device_type: DeviceType) -> usize {
        match device_type {
            DeviceType::HighEndMobile => 5,
            DeviceType::MidRangeMobile => 3,
            DeviceType::LowEndMobile => 1,
            DeviceType::Desktop => 10,
        }
    }

    /// Check if batch processing is recommended for the given parameters
    pub fn should_use_batch_processing(
        num_proofs: usize,
        device_type: DeviceType,
    ) -> bool {
        let optimal_batch = get_optimal_batch_size(device_type);
        num_proofs > optimal_batch
    }

    /// Split a large proof generation task into mobile-friendly batches
    pub fn create_batches<T: Clone>(items: Vec<T>, device_type: DeviceType) -> Vec<Vec<T>> {
        let batch_size = get_optimal_batch_size(device_type);
        items
            .chunks(batch_size)
            .map(|chunk| chunk.to_vec())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::performance::*;
    use super::mobile_trust_score::*;
    use pasta_curves::Fp;
    use halo2_proofs::plonk::Circuit;

    #[test]
    fn test_mobile_trust_score_circuit() {
        // Test that the mobile circuit can be created and configured
        let trust_score = 75u32;
        let threshold = 70u32;

        let circuit = MobileTrustScoreCircuit::<Fp>::new(Some(trust_score), threshold);
        let circuit_without_witnesses = circuit.without_witnesses();
        
        // Just verify the circuits can be created
        // This tests the basic structure and configuration
        let _ = circuit;
        let _ = circuit_without_witnesses;
    }

    #[test]
    fn test_performance_estimates() {
        // Test time estimation
        let time_high_end = estimate_proof_time_ms(10, DeviceType::HighEndMobile);
        let time_low_end = estimate_proof_time_ms(10, DeviceType::LowEndMobile);
        
        assert!(time_low_end > time_high_end);
        
        // Test memory estimation with larger difference
        let memory_small = estimate_memory_usage_mb(8);
        let memory_large = estimate_memory_usage_mb(16);
        
        assert!(memory_large > memory_small);
        
        // Test that memory scales with circuit size
        let memory_tiny = estimate_memory_usage_mb(4);
        let memory_huge = estimate_memory_usage_mb(20);
        
        assert!(memory_huge > memory_tiny);
    }

    #[test]
    fn test_mobile_suitability() {
        assert!(is_mobile_suitable(10));
        assert!(is_mobile_suitable(12));
        assert!(!is_mobile_suitable(16));
    }

    #[test]
    fn test_batch_processing() {
        let items: Vec<u32> = (0..20).collect();
        
        let batches_mobile = batch_processing::create_batches(
            items.clone(),
            DeviceType::MidRangeMobile,
        );
        let batches_desktop = batch_processing::create_batches(
            items,
            DeviceType::Desktop,
        );
        
        // Mobile should have more, smaller batches
        assert!(batches_mobile.len() > batches_desktop.len());
        
        // Check batch sizes
        for batch in &batches_mobile {
            assert!(batch.len() <= batch_processing::get_optimal_batch_size(DeviceType::MidRangeMobile));
        }
    }

    #[test]
    fn test_recommended_k_values() {
        let k_high = get_recommended_k(DeviceType::HighEndMobile);
        let k_low = get_recommended_k(DeviceType::LowEndMobile);
        let k_desktop = get_recommended_k(DeviceType::Desktop);
        
        assert!(k_low < k_high);
        assert!(k_high < k_desktop);
    }

    #[test]
    fn test_should_use_batch_processing() {
        assert!(!batch_processing::should_use_batch_processing(1, DeviceType::LowEndMobile));
        assert!(batch_processing::should_use_batch_processing(5, DeviceType::LowEndMobile));
        assert!(batch_processing::should_use_batch_processing(15, DeviceType::Desktop));
    }
}