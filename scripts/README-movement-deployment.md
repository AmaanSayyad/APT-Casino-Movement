# Movement Bardock Deployment Guide

This guide explains how to deploy the Game Logger contract to Movement Bardock testnet.

## Prerequisites

1. **Node.js** installed (v16 or higher)
2. **Movement CLI** or **Aptos CLI** installed
3. **Treasury private key** with MOVE tokens

## Installation

### Movement CLI (Recommended)

For macOS ARM64:
```bash
curl -LO https://github.com/movementlabsxyz/homebrew-movement-cli/releases/download/bypass-homebrew/movement-move2-testnet-macos-arm64.tar.gz && mkdir -p temp_extract && tar -xzf movement-move2-testnet-macos-arm64.tar.gz -C temp_extract && chmod +x temp_extract/movement && sudo mv temp_extract/movement /usr/local/bin/movement && rm -rf temp_extract
```

For Linux x86_64:
```bash
curl -LO https://github.com/movementlabsxyz/homebrew-movement-cli/releases/download/bypass-homebrew/movement-move2-testnet-linux-x86_64.tar.gz && mkdir -p temp_extract && tar -xzf movement-move2-testnet-linux-x86_64.tar.gz -C temp_extract && chmod +x temp_extract/movement && sudo mv temp_extract/movement /usr/local/bin/movement && rm -rf temp_extract
```

### Alternative: Aptos CLI

If Movement CLI is not available, you can use Aptos CLI:
```bash
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
```

## Setup

1. **Create .env file** in project root:
```env
TREASURY_PRIVATE_KEY=0x1234567890abcdef...
```

2. **Fund your account** at Movement Bardock faucet:
   - Visit: https://faucet.testnet.movementnetwork.xyz/
   - Enter your treasury address
   - Request testnet MOVE tokens

## Deployment

### Option 1: Using Node.js script

```bash
# Unix/Linux/macOS
./scripts/deploy-movement.sh

# Windows
scripts\deploy-movement.bat

# Direct node execution
node scripts/deploy-movement.js
```

### Option 2: Manual CLI deployment

1. **Compile the contract:**
```bash
cd move-contracts
movement move compile --named-addresses movement_casino=YOUR_ADDRESS
```

2. **Publish the contract:**
```bash
movement move publish --named-addresses movement_casino=YOUR_ADDRESS --url https://testnet.movementnetwork.xyz/v1
```

3. **Initialize the contract:**
```bash
movement move run --function-id YOUR_ADDRESS::game_logger::initialize
```

## Network Configuration

- **Network**: Movement Bardock Testnet
- **Chain ID**: 250
- **RPC URL**: https://testnet.movementnetwork.xyz/v1
- **Faucet**: https://faucet.testnet.movementnetwork.xyz/
- **Explorer**: https://explorer.movementnetwork.xyz/?network=bardock+testnet

## Verification

After deployment, verify your contract:

1. **Check contract on explorer:**
   - Visit: https://explorer.movementnetwork.xyz/?network=bardock+testnet
   - Search for your treasury address
   - Verify the game_logger module is published

2. **Test contract functions:**
```javascript
// Example: Get game history
const gameHistory = await aptos.view({
  function: `${treasuryAddress}::game_logger::get_game_history`,
  functionArguments: [treasuryAddress]
});
```

## Troubleshooting

### Common Issues

1. **"Insufficient balance" error:**
   - Fund your account at the faucet
   - Wait a few minutes for tokens to arrive

2. **"Module already exists" error:**
   - The contract is already deployed
   - Skip to initialization step

3. **"Network connection" error:**
   - Check internet connection
   - Verify RPC URL is accessible

4. **"Private key invalid" error:**
   - Ensure private key starts with "0x"
   - Verify key is 64 characters (32 bytes) hex

### Getting Help

- **Movement Discord**: https://discord.gg/movementlabs
- **Documentation**: https://docs.movementnetwork.xyz/
- **Explorer**: https://explorer.movementnetwork.xyz/

## Environment Variables

Required environment variables for deployment:

```env
# Required
TREASURY_PRIVATE_KEY=0x...          # Treasury account private key

# Optional (for frontend integration)
NEXT_PUBLIC_MOVEMENT_RPC_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_CHAIN_ID=250
NEXT_PUBLIC_MOVEMENT_EXPLORER_URL=https://explorer.movementnetwork.xyz/?network=bardock+testnet
NEXT_PUBLIC_TREASURY_ADDRESS=0x...   # Will be derived from private key
```

## Security Notes

- **Never commit private keys** to version control
- **Use environment variables** for sensitive data
- **Test on testnet first** before mainnet deployment
- **Backup your private key** securely