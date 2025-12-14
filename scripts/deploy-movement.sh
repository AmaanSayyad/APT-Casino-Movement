#!/bin/bash

echo "🚀 Deploying to Movement Bardock Testnet..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create .env file with TREASURY_PRIVATE_KEY."
    exit 1
fi

# Run the deployment script
node scripts/deploy-movement.js

echo ""
echo "✅ Deployment script completed."