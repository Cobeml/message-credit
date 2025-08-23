use crate::circuits::trust_score::TrustScoreCircuit;
use halo2_proofs::{
    dev::MockProver,
    plonk::{create_proof, keygen_pk, keygen_vk, verify_proof, ProvingKey, VerifyingKey, SingleVerifier},
    poly::commitment::Params,
    transcript::{Blake2bRead, Blake2bWrite, Challenge255},
};
use pasta_curves::{Fp, EqAffine};
use ff::Field;
use rand::rngs::OsRng;
use std::ffi::CString;
use std::os::raw::{c_char, c_int};
use napi_derive::napi;
use napi::{Result, Error, Status};

/// Result structure for proof operations
#[repr(C)]
pub struct ProofResult {
    pub success: bool,
    pub proof_data: *mut u8,
    pub proof_len: usize,
    pub error_message: *mut c_char,
}

/// Parameters for trust score proof generation
#[repr(C)]
pub struct TrustScoreParams {
    pub trust_score: u64,
    pub threshold: u64,
}

/// Setup parameters for the circuit (simplified for demo)
static mut SETUP_PARAMS: Option<Params<EqAffine>> = None;
static mut PROVING_KEY: Option<ProvingKey<EqAffine>> = None;
static mut VERIFYING_KEY: Option<VerifyingKey<EqAffine>> = None;

/// Initialize the ZK proof system with setup parameters
#[napi]
pub fn initialize_zk_system() -> Result<bool> {
    unsafe {
        // Create setup parameters (in production, these would be from a trusted setup)
        let k = 4; // Circuit size parameter
        let params = Params::<EqAffine>::new(k);
        
        // Create a dummy circuit for key generation
        let circuit = TrustScoreCircuit::<Fp>::new(Some(75), 70);
        
        // Generate verification key
        let vk = keygen_vk(&params, &circuit)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to generate VK: {:?}", e)))?;
        
        // Generate proving key
        let pk = keygen_pk(&params, vk.clone(), &circuit)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to generate PK: {:?}", e)))?;
        
        SETUP_PARAMS = Some(params);
        PROVING_KEY = Some(pk);
        VERIFYING_KEY = Some(vk);
        
        Ok(true)
    }
}

/// Generate a trust score proof
#[napi]
pub fn generate_trust_score_proof(trust_score: u32, threshold: u32) -> Result<Vec<u8>> {
    unsafe {
        let params = SETUP_PARAMS.as_ref()
            .ok_or_else(|| Error::new(Status::GenericFailure, "ZK system not initialized"))?;
        let pk = PROVING_KEY.as_ref()
            .ok_or_else(|| Error::new(Status::GenericFailure, "Proving key not available"))?;
        
        // Create the circuit with the actual trust score
        let circuit = TrustScoreCircuit::<Fp>::new(Some(trust_score as u64), threshold as u64);
        
        // Determine the expected public input (result of comparison)
        let public_input = if trust_score >= threshold {
            Fp::one()
        } else {
            Fp::zero()
        };
        
        // Create proof
        let mut transcript = Blake2bWrite::<Vec<u8>, EqAffine, Challenge255<_>>::init(vec![]);
        
        create_proof(
            params,
            pk,
            &[circuit],
            &[&[&[public_input]]],
            OsRng,
            &mut transcript,
        ).map_err(|e| Error::new(Status::GenericFailure, format!("Failed to create proof: {:?}", e)))?;
        
        Ok(transcript.finalize())
    }
}

/// Verify a trust score proof
#[napi]
pub fn verify_trust_score_proof(proof_data: Vec<u8>, threshold: u32, expected_result: bool) -> Result<bool> {
    unsafe {
        let params = SETUP_PARAMS.as_ref()
            .ok_or_else(|| Error::new(Status::GenericFailure, "ZK system not initialized"))?;
        let vk = VERIFYING_KEY.as_ref()
            .ok_or_else(|| Error::new(Status::GenericFailure, "Verifying key not available"))?;
        
        // Expected public input based on the result
        let public_input = if expected_result {
            Fp::one()
        } else {
            Fp::zero()
        };
        
        // Verify proof
        let mut transcript = Blake2bRead::<&[u8], EqAffine, Challenge255<_>>::init(&proof_data[..]);
        let strategy = SingleVerifier::new(params);
        
        let verification_result = verify_proof(
            params,
            vk,
            strategy,
            &[&[&[public_input]]],
            &mut transcript,
        );
        
        Ok(verification_result.is_ok())
    }
}

/// Test the trust score circuit with mock prover (for testing)
#[napi]
pub fn test_trust_score_circuit(trust_score: u32, threshold: u32) -> Result<bool> {
    let k = 4;
    let circuit = TrustScoreCircuit::<Fp>::new(Some(trust_score as u64), threshold as u64);
    
    // Determine expected result
    let expected_result = if trust_score >= threshold {
        Fp::one()
    } else {
        Fp::zero()
    };
    
    let public_inputs = vec![expected_result];
    
    match MockProver::run(k, &circuit, vec![public_inputs]) {
        Ok(prover) => {
            match prover.verify() {
                Ok(_) => Ok(true),
                Err(e) => {
                    eprintln!("Circuit verification failed: {:?}", e);
                    Ok(false)
                }
            }
        }
        Err(e) => {
            Err(Error::new(Status::GenericFailure, format!("Failed to run mock prover: {:?}", e)))
        }
    }
}

// C-compatible FFI functions for direct integration
extern "C" {
    fn free(ptr: *mut std::ffi::c_void);
}

/// C-compatible function to generate trust score proof
#[no_mangle]
pub extern "C" fn generate_trust_proof(
    trust_score: u64,
    threshold: u64,
) -> *mut ProofResult {
    let result = Box::new(ProofResult {
        success: false,
        proof_data: std::ptr::null_mut(),
        proof_len: 0,
        error_message: std::ptr::null_mut(),
    });
    
    // For this demo, we'll use the mock prover approach
    let k = 4;
    let circuit = TrustScoreCircuit::<Fp>::new(Some(trust_score), threshold);
    
    let expected_result = if trust_score >= threshold {
        Fp::one()
    } else {
        Fp::zero()
    };
    
    let public_inputs = vec![expected_result];
    
    match MockProver::run(k, &circuit, vec![public_inputs]) {
        Ok(prover) => {
            match prover.verify() {
                Ok(_) => {
                    // Create a dummy proof for demonstration
                    let proof_data = b"mock_proof_data".to_vec();
                    let proof_len = proof_data.len();
                    
                    let mut result = result;
                    result.success = true;
                    result.proof_len = proof_len;
                    
                    // Allocate memory for proof data
                    let proof_ptr = unsafe {
                        libc::malloc(proof_len) as *mut u8
                    };
                    
                    if !proof_ptr.is_null() {
                        unsafe {
                            std::ptr::copy_nonoverlapping(proof_data.as_ptr(), proof_ptr, proof_len);
                        }
                        result.proof_data = proof_ptr;
                    }
                    
                    Box::into_raw(result)
                }
                Err(e) => {
                    let error_msg = CString::new(format!("Circuit verification failed: {:?}", e))
                        .unwrap_or_else(|_| CString::new("Unknown error").unwrap());
                    let mut result = result;
                    result.error_message = error_msg.into_raw();
                    Box::into_raw(result)
                }
            }
        }
        Err(e) => {
            let error_msg = CString::new(format!("Mock prover failed: {:?}", e))
                .unwrap_or_else(|_| CString::new("Unknown error").unwrap());
            let mut result = result;
            result.error_message = error_msg.into_raw();
            Box::into_raw(result)
        }
    }
}

/// C-compatible function to verify trust score proof
#[no_mangle]
pub extern "C" fn verify_trust_proof(
    proof_data: *const u8,
    proof_len: usize,
    _threshold: u64,
    _expected_result: bool,
) -> c_int {
    if proof_data.is_null() || proof_len == 0 {
        return 0; // false
    }
    
    // For this demo, we'll just check if the proof data matches our expected format
    let expected_proof = b"mock_proof_data";
    
    if proof_len == expected_proof.len() {
        let proof_slice = unsafe {
            std::slice::from_raw_parts(proof_data, proof_len)
        };
        
        if proof_slice == expected_proof {
            return 1; // true
        }
    }
    
    0 // false
}

/// Free memory allocated by proof generation
#[no_mangle]
pub extern "C" fn free_proof_result(result: *mut ProofResult) {
    if result.is_null() {
        return;
    }
    
    unsafe {
        let result = Box::from_raw(result);
        
        // Free proof data if allocated
        if !result.proof_data.is_null() {
            libc::free(result.proof_data as *mut std::ffi::c_void);
        }
        
        // Free error message if allocated
        if !result.error_message.is_null() {
            let _ = CString::from_raw(result.error_message);
        }
        
        // result is automatically dropped here
    }
}