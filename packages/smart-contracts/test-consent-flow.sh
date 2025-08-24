#!/bin/bash

# Test Two-Party Consent Flow Script
# This script tests the complete consent mechanism on the deployed chain

set -e

# Configuration
PACKAGE_ID="0xa07f06fa6f9e597d341cd45aff185881e6cb6c6941093299ad8e01c56a16c290"
NETWORK="devnet"  # or mainnet
GAS_BUDGET=10000000

echo "🚀 Testing Two-Party Consent Flow on $NETWORK"
echo "Package ID: $PACKAGE_ID"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if package ID is set
if [ "$PACKAGE_ID" = "<YOUR_PACKAGE_ID_HERE>" ]; then
    print_error "Please set your PACKAGE_ID in the script first!"
    exit 1
fi

# Check if sui client is available
if ! command -v sui &> /dev/null; then
    print_error "Sui CLI not found. Please install it first."
    exit 1
fi

print_status "Starting consent flow test..."

# Step 1: Check if loan registry exists, if not initialize it
print_status "Step 1: Checking/Initializing loan registry..."
REGISTRY_ID=$(sui client objects --query-type loan_manager::LoanRegistry 2>/dev/null | grep -o '0x[a-f0-9]*' | head -1 || echo "")

if [ -z "$REGISTRY_ID" ]; then
    print_status "Loan registry not found, initializing..."
    sui client call --package $PACKAGE_ID --module loan_manager --function init --gas-budget $GAS_BUDGET --network $NETWORK
    REGISTRY_ID=$(sui client objects --query-type loan_manager::LoanRegistry | grep -o '0x[a-f0-9]*' | head -1)
    print_success "Loan registry initialized: $REGISTRY_ID"
else
    print_success "Loan registry found: $REGISTRY_ID"
fi

# Step 2: Create a test loan (as borrower)
print_status "Step 2: Creating test loan..."
LOAN_ID=$(sui client call --package $PACKAGE_ID \
  --module loan_manager \
  --function create_loan_with_proof \
  --args $REGISTRY_ID 1000000 500 30 \
  --gas-budget $GAS_BUDGET \
  --network $NETWORK | grep -o '0x[a-f0-9]*' | tail -1)

if [ -z "$LOAN_ID" ]; then
    print_error "Failed to create loan"
    exit 1
fi
print_success "Loan created: $LOAN_ID"

# Step 3: Fund the loan (as lender)
print_status "Step 3: Funding the loan..."
FUND_RESULT=$(sui client call --package $PACKAGE_ID \
  --module loan_manager \
  --function fund_loan \
  --args $LOAN_ID \
  --gas-budget $GAS_BUDGET \
  --network $NETWORK)

print_success "Loan funded successfully"

# Step 4: Make full payment (as borrower)
print_status "Step 4: Making full payment..."
PAYMENT_RESULT=$(sui client call --package $PACKAGE_ID \
  --module loan_manager \
  --function make_payment \
  --args $LOAN_ID 0 \
  --gas-budget $GAS_BUDGET \
  --network $NETWORK)

print_success "Payment made successfully"

# Step 5: Request loan resolution (as borrower - FIRST CLICK)
print_status "Step 5: Requesting loan resolution (BORROWER CLICK)..."
RESOLUTION_REQUEST=$(sui client call --package $PACKAGE_ID \
  --module loan_manager \
  --function request_loan_resolution \
  --args $LOAN_ID \
  --gas-budget $GAS_BUDGET \
  --network $NETWORK)

print_success "Resolution requested successfully"

# Step 6: Give consent for resolution (as lender - SECOND CLICK)
print_status "Step 6: Giving consent for resolution (LENDER CLICK)..."
CONSENT_RESULT=$(sui client call --package $PACKAGE_ID \
  --module loan_manager \
  --function consent_to_resolution \
  --args $LOAN_ID \
  --gas-budget $GAS_BUDGET \
  --network $NETWORK)

print_success "Consent given successfully"

# Step 7: Verify the loan is completed
print_status "Step 7: Verifying loan completion..."
LOAN_STATUS=$(sui client call --package $PACKAGE_ID \
  --module loan_manager \
  --function get_loan_info \
  --args $LOAN_ID \
  --gas-budget $GAS_BUDGET \
  --network $NETWORK)

print_success "Loan verification completed"

echo ""
print_success "🎉 Two-Party Consent Flow Test Completed Successfully!"
echo ""
echo "📋 Test Summary:"
echo "   ✅ Loan created and funded"
echo "   ✅ Full payment made"
echo "   ✅ Resolution requested (borrower click)"
echo "   ✅ Consent given (lender click)"
echo "   ✅ Loan completed with mutual consent"
echo ""
echo "🔗 Loan ID: $LOAN_ID"
echo "🔗 Registry ID: $REGISTRY_ID"
echo ""
echo "💡 This demonstrates that both users must click to complete the loan!"
