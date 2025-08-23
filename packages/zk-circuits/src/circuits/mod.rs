// ZK circuit modules
// This file will be implemented in subsequent tasks

pub mod trust_score;
pub mod income_range;
pub mod identity;
pub mod loan_history;
pub mod optimizations;

// Re-export circuit types
pub use trust_score::*;
pub use income_range::*;
pub use identity::*;
pub use loan_history::*;
pub use optimizations::*;