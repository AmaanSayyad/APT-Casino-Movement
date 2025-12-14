const { Ed25519PrivateKey, Account } = require('@aptos-labs/ts-sdk');
const fs = require('fs');
const path = require('path');

/**
 * Movement Testnet Wallet Creator
 * Creates a new wallet for Movement Bardock testnet
 */

function createMovementWallet() {
  console.log('🔐 Creating new Movement testnet wallet...\n');

  // Generate new private key and account
  const privateKey = Ed25519PrivateKey.generate();
  const account = Account.fromPrivateKey({ privateKey });
  
  const walletInfo = {
    address: account.accountAddress.toString(),
    privateKey: privateKey.toString(),
    publicKey: account.publicKey.toString(),
    network: 'Movement Bardock Testnet',
    chainId: 250,
    rpcUrl: 'https://testnet.movementnetwork.xyz/v1',
    faucetUrl: 'https://faucet.movementnetwork.xyz',
    explorerUrl: 'https://explorer.movementnetwork.xyz/?network=bardock+testnet'
  };

  console.log('✅ Wallet created successfully!');
  console.log('\n📋 Wallet Information:');
  console.log(`   Address: ${walletInfo.address}`);
  console.log(`   Public Key: ${walletInfo.publicKey}`);
  console.log(`   Private Key: ${walletInfo.privateKey}`);
  console.log(`   Network: ${walletInfo.network}`);
  console.log(`   Chain ID: ${walletInfo.chainId}`);
  
  console.log('\n🌐 Network Information:');
  console.log(`   RPC URL: ${walletInfo.rpcUrl}`);
  console.log(`   Faucet: ${walletInfo.faucetUrl}`);
  console.log(`   Explorer: ${walletInfo.explorerUrl}`);

  console.log('\n💰 Next Steps:');
  console.log('1. Fund your wallet at the faucet:');
  console.log(`   ${walletInfo.faucetUrl}`);
  console.log('2. Add the private key to your .env file:');
  console.log(`   TREASURY_PRIVATE_KEY=${walletInfo.privateKey}`);
  console.log('3. Update environment variables:');
  console.log(`   NEXT_PUBLIC_MOVEMENT_TREASURY_ADDRESS=${walletInfo.address}`);

  // Save wallet info to file
  const walletFile = path.join(__dirname, 'movement-wallet.json');
  fs.writeFileSync(walletFile, JSON.stringify(walletInfo, null, 2));
  console.log(`\n💾 Wallet info saved to: ${walletFile}`);
  
  // Create .env template
  const envTemplate = `
# Movement Bardock Testnet Configuration
TREASURY_PRIVATE_KEY=${walletInfo.privateKey}
NEXT_PUBLIC_MOVEMENT_TREASURY_ADDRESS=${walletInfo.address}
NEXT_PUBLIC_MOVEMENT_GAME_LOGGER_ADDRESS=${walletInfo.address}
NEXT_PUBLIC_MOVEMENT_USER_BALANCE_ADDRESS=${walletInfo.address}
`;

  const envFile = path.join(__dirname, '..', '.env.movement');
  fs.writeFileSync(envFile, envTemplate.trim());
  console.log(`📝 Environment template saved to: .env.movement`);
  
  console.log('\n⚠️  SECURITY WARNING:');
  console.log('   - Keep your private key secure and never share it');
  console.log('   - Add .env files to .gitignore');
  console.log('   - This is a testnet wallet - do not use for mainnet');

  return walletInfo;
}

// Run if called directly
if (require.main === module) {
  createMovementWallet();
}

module.exports = { createMovementWallet };