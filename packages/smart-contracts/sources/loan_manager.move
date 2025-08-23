// Sui Move smart contracts for loan management with privacy-preserving features
// Implements encrypted loan details, ZK proof verification, and secure payment handling

module community_lending::loan_manager {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::vector;
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use community_lending::zk_verifier::{Self, ZKProof, VerificationResult};

    // Error codes
    const E_INVALID_ZK_PROOF: u64 = 1;
    const E_LOAN_NOT_FOUND: u64 = 2;
    const E_UNAUTHORIZED: u64 = 3;
    const E_LOAN_ALREADY_FUNDED: u64 = 4;
    const E_INSUFFICIENT_PAYMENT: u64 = 5;
    const E_LOAN_NOT_ACTIVE: u64 = 6;
    const E_INVALID_LOAN_STATUS: u64 = 7;
    const E_EXPIRED_LOAN: u64 = 8;

    // Loan status constants
    const STATUS_PENDING: u8 = 0;
    const STATUS_FUNDED: u8 = 1;
    const STATUS_ACTIVE: u8 = 2;
    const STATUS_COMPLETED: u8 = 3;
    const STATUS_DEFAULTED: u8 = 4;
    const STATUS_DISPUTED: u8 = 5;
    const STATUS_PENDING_RESOLUTION: u8 = 6;
    const STATUS_PENDING_TERMINATION: u8 = 7;

    // Consent type constants
    const CONSENT_RESOLUTION: u8 = 0;
    const CONSENT_DISPUTE: u8 = 1;
    const CONSENT_TERMINATION: u8 = 2;
    const CONSENT_MODIFICATION: u8 = 3;

    // Consent expiration time (24 hours in milliseconds)
    const CONSENT_EXPIRATION_TIME: u64 = 86400000;

    /// Consent state for two-party agreement mechanisms
    public struct ConsentState has store, drop {
        borrower_consent: bool,
        lender_consent: bool,
        consent_type: u8, // 0: resolution, 1: dispute, 2: termination, 3: modification
        requested_at: u64,
        expires_at: u64,
    }

    /// Main loan structure with encrypted details and ZK proof verification
    public struct Loan has key, store {
        id: UID,
        borrower: address,
        lender: address,
        amount: u64,
        interest_rate: u64, // Basis points (e.g., 500 = 5%)
        duration_days: u64,
        status: u8,
        zk_proof_hash: vector<u8>,
        encrypted_details: vector<u8>, // Encrypted loan purpose, terms, etc.
        created_at: u64,
        funded_at: u64,
        due_date: u64,
        total_repaid: u64,
        community_id: String,
        consent_state: Option<ConsentState>, // New field for consent tracking
    }

    /// Loan registry to track all loans
    public struct LoanRegistry has key {
        id: UID,
        loans: vector<address>, // Addresses of loan objects
        total_loans: u64,
        total_volume: u64,
    }



    /// Payment record for loan servicing
    public struct Payment has key, store {
        id: UID,
        loan_id: address,
        payer: address,
        amount: u64,
        payment_type: u8, // 0: principal, 1: interest, 2: penalty
        timestamp: u64,
    }

    // Events
    public struct LoanCreated has copy, drop {
        loan_id: address,
        borrower: address,
        amount: u64,
        community_id: String,
        zk_proof_verified: bool,
    }

    public struct LoanFunded has copy, drop {
        loan_id: address,
        lender: address,
        amount: u64,
    }

    public struct PaymentMade has copy, drop {
        loan_id: address,
        payer: address,
        amount: u64,
        remaining_balance: u64,
    }

    public struct LoanCompleted has copy, drop {
        loan_id: address,
        total_repaid: u64,
    }

    public struct ConsentRequested has copy, drop {
        loan_id: address,
        requester: address,
        consent_type: u8,
        expires_at: u64,
    }

    public struct ConsentGiven has copy, drop {
        loan_id: address,
        consenter: address,
        consent_type: u8,
        all_parties_consented: bool,
    }

    public struct ConsentWithdrawn has copy, drop {
        loan_id: address,
        withdrawer: address,
        consent_type: u8,
    }

    public struct ConsentExpired has copy, drop {
        loan_id: address,
        consent_type: u8,
    }

    /// Initialize the loan registry (called once during deployment)
    fun init(ctx: &mut TxContext) {
        let registry = LoanRegistry {
            id: object::new(ctx),
            loans: vector::empty(),
            total_loans: 0,
            total_volume: 0,
        };
        transfer::share_object(registry);
    }

    /// Create a new loan with ZK proof verification
    public fun create_loan_with_proof(
        registry: &mut LoanRegistry,
        amount: u64,
        interest_rate: u64,
        duration_days: u64,
        zk_proof: ZKProof,
        encrypted_details: vector<u8>,
        community_id: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): address {
        // Verify ZK proof
        let current_time = clock::timestamp_ms(clock);
        assert!(verify_zk_proof(&zk_proof, current_time), E_INVALID_ZK_PROOF);
        
        let borrower = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        
        let loan = Loan {
            id: object::new(ctx),
            borrower,
            lender: @0x0, // Will be set when funded
            amount,
            interest_rate,
            duration_days,
            status: STATUS_PENDING,
            zk_proof_hash: hash_proof(&zk_proof),
            encrypted_details,
            created_at: current_time,
            funded_at: 0,
            due_date: 0,
            total_repaid: 0,
            community_id,
            consent_state: option::none(), // Initialize consent state
        };

        let loan_address = object::uid_to_address(&loan.id);
        
        // Update registry
        vector::push_back(&mut registry.loans, loan_address);
        registry.total_loans = registry.total_loans + 1;
        registry.total_volume = registry.total_volume + amount;

        // Emit event
        event::emit(LoanCreated {
            loan_id: loan_address,
            borrower,
            amount,
            community_id,
            zk_proof_verified: true,
        });

        transfer::share_object(loan);
        loan_address
    }

    /// Fund a loan (lender provides the loan amount)
    public fun fund_loan(
        loan: &mut Loan,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_PENDING, E_LOAN_ALREADY_FUNDED);
        assert!(coin::value(&payment) >= loan.amount, E_INSUFFICIENT_PAYMENT);
        
        let lender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        
        // Update loan status
        loan.lender = lender;
        loan.status = STATUS_ACTIVE;
        loan.funded_at = current_time;
        loan.due_date = current_time + (loan.duration_days * 24 * 60 * 60 * 1000);

        // Transfer funds to borrower
        transfer::public_transfer(payment, loan.borrower);

        // Emit event
        event::emit(LoanFunded {
            loan_id: object::uid_to_address(&loan.id),
            lender,
            amount: loan.amount,
        });
    }

    /// Make a payment towards the loan
    public fun make_payment(
        loan: &mut Loan,
        payment: Coin<SUI>,
        payment_type: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_ACTIVE, E_LOAN_NOT_ACTIVE);
        
        let payer = tx_context::sender(ctx);
        let payment_amount = coin::value(&payment);
        let current_time = clock::timestamp_ms(clock);
        
        // Update loan repayment
        loan.total_repaid = loan.total_repaid + payment_amount;
        
        // Create payment record
        let payment_record = Payment {
            id: object::new(ctx),
            loan_id: object::uid_to_address(&loan.id),
            payer,
            amount: payment_amount,
            payment_type,
            timestamp: current_time,
        };

        // Calculate remaining balance
        let total_due = calculate_total_due(loan);
        let remaining_balance = if (loan.total_repaid >= total_due) {
            // Don't automatically complete - require consent
            // loan.status = STATUS_COMPLETED;
            0
        } else {
            total_due - loan.total_repaid
        };

        // Transfer payment to lender
        transfer::public_transfer(payment, loan.lender);
        transfer::share_object(payment_record);

        // Emit events
        event::emit(PaymentMade {
            loan_id: object::uid_to_address(&loan.id),
            payer,
            amount: payment_amount,
            remaining_balance,
        });

        // Note: Loan completion now requires two-party consent via request_loan_resolution
        // if (loan.status == STATUS_COMPLETED) {
        //     event::emit(LoanCompleted {
        //         loan_id: object::uid_to_address(&loan.id),
        //         total_repaid: loan.total_repaid,
        //     });
        // };
    }

    /// Mark loan as defaulted (can be called by lender after due date)
    public fun mark_defaulted(
        loan: &mut Loan,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(loan.status == STATUS_ACTIVE, E_INVALID_LOAN_STATUS);
        assert!(tx_context::sender(ctx) == loan.lender, E_UNAUTHORIZED);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time > loan.due_date, E_EXPIRED_LOAN);
        
        loan.status = STATUS_DEFAULTED;
    }

    /// Dispute a loan (can be called by borrower or lender)
    public fun dispute_loan(
        loan: &mut Loan,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == loan.borrower || sender == loan.lender, E_UNAUTHORIZED);
        assert!(loan.status == STATUS_ACTIVE || loan.status == STATUS_DEFAULTED, E_INVALID_LOAN_STATUS);
        
        loan.status = STATUS_DISPUTED;
    }

    /// Request loan resolution (requires both parties to agree)
    public fun request_loan_resolution(
        loan: &mut Loan,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == loan.borrower || sender == loan.lender, E_UNAUTHORIZED);
        assert!(loan.status == STATUS_ACTIVE, E_INVALID_LOAN_STATUS);
        
        let current_time = clock::timestamp_ms(clock);
        let total_due = calculate_total_due(loan);
        
        // Only allow resolution if loan is fully paid
        assert!(loan.total_repaid >= total_due, E_INSUFFICIENT_PAYMENT);
        
        // Create consent state
        let mut consent_state = ConsentState {
            borrower_consent: false,
            lender_consent: false,
            consent_type: CONSENT_RESOLUTION,
            requested_at: current_time,
            expires_at: current_time + CONSENT_EXPIRATION_TIME,
        };
        
        // Set initial consent based on who requested
        if (sender == loan.borrower) {
            consent_state.borrower_consent = true;
        } else {
            consent_state.lender_consent = true;
        };
        
        loan.consent_state = option::some(consent_state);
        loan.status = STATUS_PENDING_RESOLUTION;
        
        // Emit consent requested event
        event::emit(ConsentRequested {
            loan_id: object::uid_to_address(&loan.id),
            requester: sender,
            consent_type: CONSENT_RESOLUTION,
            expires_at: current_time + CONSENT_EXPIRATION_TIME,
        });
    }

    /// Give consent for loan resolution
    public fun consent_to_resolution(
        loan: &mut Loan,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == loan.borrower || sender == loan.lender, E_UNAUTHORIZED);
        assert!(loan.status == STATUS_PENDING_RESOLUTION, E_INVALID_LOAN_STATUS);
        
        let consent_state = option::borrow_mut(&mut loan.consent_state);
        let current_time = clock::timestamp_ms(clock);
        
        // Check if consent has expired
        assert!(current_time <= consent_state.expires_at, E_EXPIRED_LOAN);
        
        // Update consent based on sender
        if (sender == loan.borrower) {
            consent_state.borrower_consent = true;
        } else {
            consent_state.lender_consent = true;
        };
        
        // Check if both parties have consented
        if (consent_state.borrower_consent && consent_state.lender_consent) {
            loan.status = STATUS_COMPLETED;
            loan.consent_state = option::none();
            
            // Emit completion event
            event::emit(LoanCompleted {
                loan_id: object::uid_to_address(&loan.id),
                total_repaid: loan.total_repaid,
            });
        } else {
            // Emit consent given event
            event::emit(ConsentGiven {
                loan_id: object::uid_to_address(&loan.id),
                consenter: sender,
                consent_type: CONSENT_RESOLUTION,
                all_parties_consented: false,
            });
        };
    }

    /// Request early loan termination (requires both parties to agree)
    public fun request_early_termination(
        loan: &mut Loan,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == loan.borrower || sender == loan.lender, E_UNAUTHORIZED);
        assert!(loan.status == STATUS_ACTIVE, E_INVALID_LOAN_STATUS);
        
        let current_time = clock::timestamp_ms(clock);
        
        // Create consent state for termination
        let mut consent_state = ConsentState {
            borrower_consent: false,
            lender_consent: false,
            consent_type: CONSENT_TERMINATION,
            requested_at: current_time,
            expires_at: current_time + CONSENT_EXPIRATION_TIME,
        };
        
        // Set initial consent based on who requested
        if (sender == loan.borrower) {
            consent_state.borrower_consent = true;
        } else {
            consent_state.lender_consent = true;
        };
        
        loan.consent_state = option::some(consent_state);
        loan.status = STATUS_PENDING_TERMINATION;
        
        // Emit consent requested event
        event::emit(ConsentRequested {
            loan_id: object::uid_to_address(&loan.id),
            requester: sender,
            consent_type: CONSENT_TERMINATION,
            expires_at: current_time + CONSENT_EXPIRATION_TIME,
        });
    }

    /// Give consent for early termination
    public fun consent_to_termination(
        loan: &mut Loan,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == loan.borrower || sender == loan.lender, E_UNAUTHORIZED);
        assert!(loan.status == STATUS_PENDING_TERMINATION, E_INVALID_LOAN_STATUS);
        
        let consent_state = option::borrow_mut(&mut loan.consent_state);
        let current_time = clock::timestamp_ms(clock);
        
        // Check if consent has expired
        assert!(current_time <= consent_state.expires_at, E_EXPIRED_LOAN);
        
        // Update consent based on sender
        if (sender == loan.borrower) {
            consent_state.borrower_consent = true;
        } else {
            consent_state.lender_consent = true;
        };
        
        // Check if both parties have consented
        if (consent_state.borrower_consent && consent_state.lender_consent) {
            loan.status = STATUS_COMPLETED;
            loan.consent_state = option::none();
            
            // Emit completion event
            event::emit(LoanCompleted {
                loan_id: object::uid_to_address(&loan.id),
                total_repaid: loan.total_repaid,
            });
        } else {
            // Emit consent given event
            event::emit(ConsentGiven {
                loan_id: object::uid_to_address(&loan.id),
                consenter: sender,
                consent_type: CONSENT_TERMINATION,
                all_parties_consented: false,
            });
        };
    }

    /// Withdraw consent request (can be called by the party who initiated it)
    public fun withdraw_consent_request(
        loan: &mut Loan,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == loan.borrower || sender == loan.lender, E_UNAUTHORIZED);
        assert!(loan.status == STATUS_PENDING_RESOLUTION || loan.status == STATUS_PENDING_TERMINATION, E_INVALID_LOAN_STATUS);
        
        let consent_state = option::borrow(&loan.consent_state);
        let consent_type = consent_state.consent_type;
        
        // Only the initiator can withdraw (the one who has consent = true)
        if (sender == loan.borrower && consent_state.borrower_consent) {
            loan.consent_state = option::none();
            loan.status = STATUS_ACTIVE;
            
            // Emit consent withdrawn event
            event::emit(ConsentWithdrawn {
                loan_id: object::uid_to_address(&loan.id),
                withdrawer: sender,
                consent_type,
            });
        } else if (sender == loan.lender && consent_state.lender_consent) {
            loan.consent_state = option::none();
            loan.status = STATUS_ACTIVE;
            
            // Emit consent withdrawn event
            event::emit(ConsentWithdrawn {
                loan_id: object::uid_to_address(&loan.id),
                withdrawer: sender,
                consent_type,
            });
        } else {
            abort E_UNAUTHORIZED
        };
    }

    /// Check if consent has expired and reset loan status if needed
    public fun check_consent_expiration(
        loan: &mut Loan,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        if (option::is_some(&loan.consent_state)) {
            let consent_state = option::borrow(&loan.consent_state);
            let current_time = clock::timestamp_ms(clock);
            
            if (current_time > consent_state.expires_at) {
                // Consent expired, reset to active status
                let consent_type = consent_state.consent_type;
                loan.consent_state = option::none();
                if (loan.status == STATUS_PENDING_RESOLUTION || loan.status == STATUS_PENDING_TERMINATION) {
                    loan.status = STATUS_ACTIVE;
                };
                
                // Emit consent expired event
                event::emit(ConsentExpired {
                    loan_id: object::uid_to_address(&loan.id),
                    consent_type,
                });
            };
        };
    }

    /// Verify ZK proof using the enhanced verifier module
    fun verify_zk_proof(proof: &ZKProof, current_timestamp: u64): bool {
        let result = zk_verifier::verify_zk_proof(proof, current_timestamp);
        zk_verifier::is_verification_valid(&result)
    }

    /// Hash ZK proof for storage using the verifier module
    fun hash_proof(proof: &ZKProof): vector<u8> {
        zk_verifier::get_proof_hash(proof)
    }

    /// Calculate total amount due including interest
    fun calculate_total_due(loan: &Loan): u64 {
        let principal = loan.amount;
        let interest = (principal * loan.interest_rate) / 10000; // Basis points conversion
        principal + interest
    }

    // View functions

    /// Get loan details (public information only)
    public fun get_loan_info(loan: &Loan): (address, address, u64, u64, u64, u8, u64, u64) {
        (
            loan.borrower,
            loan.lender,
            loan.amount,
            loan.interest_rate,
            loan.duration_days,
            loan.status,
            loan.created_at,
            loan.total_repaid
        )
    }

    /// Get loan registry statistics
    public fun get_registry_stats(registry: &LoanRegistry): (u64, u64) {
        (registry.total_loans, registry.total_volume)
    }

    /// Check if loan is active
    public fun is_loan_active(loan: &Loan): bool {
        loan.status == STATUS_ACTIVE
    }

    /// Check if loan is completed
    public fun is_loan_completed(loan: &Loan): bool {
        loan.status == STATUS_COMPLETED
    }

    /// Get remaining balance
    public fun get_remaining_balance(loan: &Loan): u64 {
        let total_due = calculate_total_due(loan);
        if (loan.total_repaid >= total_due) {
            0
        } else {
            total_due - loan.total_repaid
        }
    }

    /// Get loan community ID
    public fun get_community_id(loan: &Loan): String {
        loan.community_id
    }

    /// Check if sender is loan participant
    public fun is_loan_participant(loan: &Loan, sender: address): bool {
        sender == loan.borrower || sender == loan.lender
    }

    /// Get consent status information
    public fun get_consent_status(loan: &Loan): (bool, u8, u64, u64) {
        if (option::is_some(&loan.consent_state)) {
            let consent_state = option::borrow(&loan.consent_state);
            (
                true, // has_consent_state
                consent_state.consent_type,
                consent_state.requested_at,
                consent_state.expires_at
            )
        } else {
            (false, 0, 0, 0) // no consent state
        }
    }

    /// Check if a specific party has given consent
    public fun has_party_consented(loan: &Loan, party: address): bool {
        if (option::is_some(&loan.consent_state)) {
            let consent_state = option::borrow(&loan.consent_state);
            if (party == loan.borrower) {
                consent_state.borrower_consent
            } else if (party == loan.lender) {
                consent_state.lender_consent
            } else {
                false
            }
        } else {
            false
        }
    }

    /// Check if both parties have consented
    public fun have_both_parties_consented(loan: &Loan): bool {
        if (option::is_some(&loan.consent_state)) {
            let consent_state = option::borrow(&loan.consent_state);
            consent_state.borrower_consent && consent_state.lender_consent
        } else {
            false
        }
    }

    /// Check if consent request has expired
    public fun is_consent_expired(loan: &Loan, current_time: u64): bool {
        if (option::is_some(&loan.consent_state)) {
            let consent_state = option::borrow(&loan.consent_state);
            current_time > consent_state.expires_at
        } else {
            false
        }
    }

    // Test-only functions
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_test_zk_proof(): ZKProof {
        zk_verifier::create_test_trust_score_proof(70, 1000000000)
    }

    #[test_only]
    public fun create_invalid_zk_proof(): ZKProof {
        // Create a proof with invalid data that will fail verification
        zk_verifier::create_zk_proof(
            vector[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // All zeros - invalid
            vector[70],
            0,
            1000000000,
            1
        )
    }
}