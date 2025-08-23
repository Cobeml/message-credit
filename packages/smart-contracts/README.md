# Community Lending Smart Contracts

A privacy-preserving, community-based lending platform built on Sui Move with zero-knowledge proof verification and two-party consent mechanisms.

## Overview

This platform enables secure, transparent lending while preserving user privacy through:
- **ZK Proof Verification**: Validates borrower credentials without exposing sensitive data
- **Two-Party Consent**: Ensures both borrower and lender must agree on critical loan actions
- **Encrypted Details**: Keeps loan purpose and terms private
- **Community-Based**: Supports multiple lending communities with different risk profiles

## Key Features

### 🔐 Privacy & Security
- **Zero-Knowledge Proofs**: Verify borrower trustworthiness, income range, and identity without exposing actual data
- **Encrypted Loan Details**: Loan purpose and specific terms remain private
- **Secure Payment Handling**: All transactions are on-chain and verifiable

### 🤝 Two-Party Consent System
- **Loan Resolution**: Both parties must agree to mark a loan as completed
- **Early Termination**: Mutual consent required for early loan closure
- **Dispute Resolution**: Enhanced dispute handling with consent mechanisms
- **Payment Plan Modifications**: Changes require mutual agreement

### 🏗️ Smart Contract Architecture
- **Modular Design**: Separate modules for loan management, ZK verification, and utilities
- **Event-Driven**: Comprehensive event emission for transparency and tracking
- **Gas Optimized**: Efficient Move implementation for cost-effective operations

## Smart Contract Modules

### 1. Loan Manager (`loan_manager.move`)
Core lending functionality with two-party consent mechanisms.

**Key Functions:**
- `create_loan_with_proof()`: Create loan with ZK proof verification
- `fund_loan()`: Lender provides loan amount
- `make_payment()`: Process loan payments
- `request_loan_resolution()`: Initiate two-party consent for loan completion
- `consent_to_resolution()`: Give consent for loan resolution
- `request_early_termination()`: Initiate early termination consent
- `consent_to_termination()`: Give consent for early termination
- `withdraw_consent_request()`: Withdraw initiated consent request

**Loan Statuses:**
- `STATUS_PENDING` (0): Loan created, awaiting funding
- `STATUS_FUNDED` (1): Loan funded, not yet active
- `STATUS_ACTIVE` (2): Loan active, payments being made
- `STATUS_COMPLETED` (3): Loan fully repaid and resolved
- `STATUS_DEFAULTED` (4): Loan in default
- `STATUS_DISPUTED` (5): Loan under dispute
- `STATUS_PENDING_RESOLUTION` (6): Awaiting consent for resolution
- `STATUS_PENDING_TERMINATION` (7): Awaiting consent for early termination

### 2. ZK Verifier (`zk_verifier.move`)
Handles zero-knowledge proof verification for different credential types.

**Supported Proof Types:**
- **Trust Score**: Verify minimum trust threshold without revealing actual score
- **Income Range**: Confirm income within specified range
- **Identity**: Validate identity attributes without exposing PII
- **Loan History**: Verify repayment patterns without exposing details

## Two-Party Consent Flow

### Loan Resolution Process
1. **Payment Completion**: Borrower makes final payment
2. **Resolution Request**: Either party requests loan resolution
3. **Consent Collection**: Both parties must give consent
4. **Automatic Completion**: Loan marked as completed when both consent
5. **Event Emission**: Completion events emitted for transparency

### Early Termination Process
1. **Termination Request**: Either party requests early termination
2. **Consent Collection**: Both parties must agree
3. **Automatic Completion**: Loan closed when both consent
4. **Event Emission**: Termination events for tracking

### Consent Expiration
- **24-Hour Window**: Consent requests expire after 24 hours
- **Automatic Reset**: Expired requests reset loan to active status
- **Event Tracking**: Expiration events for transparency

## Events & Transparency

The platform emits comprehensive events for all actions:

```move
// Consent Events
ConsentRequested: When consent is requested
ConsentGiven: When a party gives consent
ConsentWithdrawn: When consent request is withdrawn
ConsentExpired: When consent request expires

// Loan Events
LoanCreated: When loan is created
LoanFunded: When loan is funded
PaymentMade: When payment is made
LoanCompleted: When loan is completed
```

## Security Features

### Access Control
- **Participant Verification**: Only loan participants can perform actions
- **Role-Based Permissions**: Different functions for borrowers vs lenders
- **Unauthorized Access Prevention**: Clear error codes and assertions

### Data Integrity
- **Immutable Loan Terms**: Core terms cannot be modified after creation
- **Payment Verification**: All payments verified against loan terms
- **Status Validation**: State transitions validated at each step

## Usage Examples

### Creating a Loan
```move
let loan_address = loan_manager::create_loan_with_proof(
    &mut registry,
    1000000,        // 1 SUI
    500,            // 5% interest (basis points)
    30,             // 30 days
    zk_proof,       // Verified ZK proof
    encrypted_details,
    community_id,
    &clock,
    ctx
);
```

### Requesting Loan Resolution
```move
loan_manager::request_loan_resolution(
    &mut loan,
    &clock,
    ctx
);
```

### Giving Consent
```move
loan_manager::consent_to_resolution(
    &mut loan,
    &clock,
    ctx
);
```

## Testing

Run the test suite to verify functionality:

```bash
sui move test
```

**Test Coverage:**
- Loan creation with ZK proofs
- Two-party consent mechanisms
- Consent expiration handling
- Payment processing
- Error conditions

## Deployment

1. **Compile Contracts**:
   ```bash
   sui move build
   ```

2. **Deploy to Network**:
   ```bash
   sui client publish --gas-budget 10000000
   ```

3. **Initialize Registry**:
   ```bash
   sui client call --package <PACKAGE_ID> --module loan_manager --function init
   ```

## Gas Optimization

- **Efficient Data Structures**: Minimal storage overhead
- **Batch Operations**: Single transactions for multiple actions
- **Event Optimization**: Events only when necessary
- **Memory Management**: Proper Move memory patterns

## Future Enhancements

- **Multi-Signature Support**: Enhanced consent mechanisms
- **Automated Dispute Resolution**: AI-powered mediation
- **Dynamic Interest Rates**: Market-based rate adjustments
- **Liquidity Pools**: Automated lending pools
- **Cross-Chain Integration**: Multi-chain lending support

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request with detailed description

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For questions and support:
- Create an issue in the repository
- Review the test files for usage examples
- Check the Move documentation for language specifics
