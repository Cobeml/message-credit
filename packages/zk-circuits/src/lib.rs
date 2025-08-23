//! Halo2 zero-knowledge proof circuits for community P2P lending
//! 
//! This crate provides privacy-preserving circuits for:
//! - Trust score verification without revealing actual scores
//! - Income range proofs without exposing exact amounts
//! - Identity verification with commitment schemes
//! - Loan history verification with privacy protection

pub mod circuits;
pub mod ffi;

// Re-export main circuit types for easy access
pub use circuits::*;

// Common types used across circuits
pub use halo2_proofs::{
    circuit::{Layouter, Value},
    plonk::{Circuit, Error},
};
pub use pasta_curves::Fp;