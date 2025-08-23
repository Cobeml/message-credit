Step 1: Install Sui CLI

  # Install Sui CLI
  curl -fLJO https://github.com/MystenLabs/sui/releases/latest/downl
  oad/sui-macos-x86_64.tgz
  tar -xf sui-macos-x86_64.tgz
  sudo mv sui /usr/local/bin/

  Step 2: Generate New Keypair

  # Generate new ED25519 keypair
  sui client new-address ed25519

  # Or generate with CLI keytool
  sui keytool generate ed25519

  Step 3: Export Private Key

  # List all addresses
  sui keytool list

  # Export private key (choose your preferred format)
  # Option A: Bech32 format (2024+ recommended)
  sui keytool export [your-address] --key-identity [key-identity]

  # Option B: Show key data
  sui keytool show [your-address]

  Step 4: Configure Environment

  In your .env file, update:

  # For Hex format (starts with 0x)
  SUI_PRIVATE_KEY="0x1a2b3c4d5e6f7890abcdef..."

  # For Base64 format  
  SUI_PRIVATE_KEY="AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA="

  # For Bech32 format (suiprivkey...)
  SUI_PRIVATE_KEY="suiprivkey1qq..."

  The service now supports all three formats automatically!

  Step 5: Network Configuration

  # Set network (optional, defaults to testnet)
  SUI_NETWORK="testnet"  # or "mainnet", "devnet", "localnet"

  # Set custom RPC URL (optional)
  SUI_RPC_URL="https://fullnode.testnet.sui.io:443"