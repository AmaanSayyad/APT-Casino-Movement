const { Movement, AptosConfig, Network, Ed25519PrivateKey, Account } = require('@aptos-labs/ts-sdk');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Movement Bardock Testnet Configuration
const MOVEMENT_CONFIG = {
  network: Network.CUSTOM,
  fullnode: 'https://testnet.movementnetwork.xyz/v1',
  faucet: 'https://faucet.testnet.movementnetwork.xyz/',
  chainId: 250
};

async function fundMovementWallet() {
  try {
    console.log('💰 Funding Movement testnet wallet...\n');

    if (!process.env.TREASURY_PRIVATE_KEY) {
      throw new Error('TREASURY_PRIVATE_KEY not found in .env file');
    }

    // Create account from private key
    const privateKey = new Ed25519PrivateKey(process.env.TREASURY_PRIVATE_KEY);
    const account = Account.fromPrivateKey({ privateKey });
    const address = account.accountAddress.toString();

    console.log(`📋 Wallet Address: ${address}`);

    // Create Movement client
    const config = new AptosConfig({ 
      network: MOVEMENT_CONFIG.network,
      fullnode: MOVEMENT_CONFIG.fullnode,
      faucet: MOVEMENT_CONFIG.faucet
    });
    const movement = new Aptos(config);

    // Check current balance
    console.log('\n🔍 Checking current balance...');
    try {
      const resources = await movement.getAccountResources({ accountAddress: address });
      const coinResource = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
      
      if (coinResource) {
        const currentBalance = parseInt(coinResource.data.coin.value) / 100000000; // Convert from octas to MOVE
        console.log(`   Current Balance: ${currentBalance} MOVE`);
      } else {
        console.log('   Account not found on-chain (balance: 0 MOVE)');
      }
    } catch (error) {
      console.log('   Account not found on-chain (balance: 0 MOVE)');
    }

    // Fund from faucet
    console.log('\n💧 Requesting funds from faucet...');
    try {
      // Try using the Movement SDK faucet method first
      await movement.fundAccount({
        accountAddress: address,
        amount: 100000000, // 1 MOVE in octas
      });
      console.log('   ✅ Successfully funded via SDK');
    } catch (error) {
      console.log('   ⚠️  SDK funding failed, trying direct API call...');
      
      // Try direct API call to faucet
      try {
        const response = await axios.post('https://faucet.testnet.movementnetwork.xyz/mint', {
          address: address,
          amount: 100000000 // 1 MOVE in octas
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        if (response.status === 200) {
          console.log('   ✅ Successfully funded via direct API');
        } else {
          throw new Error(`Faucet API returned status: ${response.status}`);
        }
      } catch (apiError) {
        console.log('   ❌ Direct API funding also failed');
        console.log('\n🌐 Manual funding required:');
        console.log(`   1. Visit: https://faucet.movementnetwork.xyz`);
        console.log(`   2. Enter address: ${address}`);
        console.log(`   3. Request testnet MOVE tokens`);
        return;
      }
    }

    // Wait a moment for the transaction to be processed
    console.log('\n⏳ Waiting for transaction to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check new balance
    console.log('\n🔍 Checking updated balance...');
    try {
      const resources = await movement.getAccountResources({ accountAddress: address });
      const coinResource = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
      
      if (coinResource) {
        const newBalance = parseInt(coinResource.data.coin.value) / 100000000;
        console.log(`   New Balance: ${newBalance} MOVE`);
        
        if (newBalance > 0) {
          console.log('\n🎉 Wallet funded successfully!');
          console.log('\n📋 Summary:');
          console.log(`   Address: ${address}`);
          console.log(`   Balance: ${newBalance} MOVE`);
          console.log(`   Network: Movement Bardock Testnet`);
          console.log(`   Explorer: https://explorer.movementnetwork.xyz/?network=bardock+testnet`);
          
          console.log('\n✅ Ready for contract deployment!');
        } else {
          console.log('\n⚠️  Balance is still 0. Please try manual funding.');
        }
      } else {
        console.log('   ❌ Could not fetch updated balance');
      }
    } catch (error) {
      console.log('   ❌ Error checking balance:', error.message);
    }

  } catch (error) {
    console.error('\n❌ Funding failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check internet connection');
    console.error('   2. Verify TREASURY_PRIVATE_KEY in .env');
    console.error('   3. Try manual funding at: https://faucet.movementnetwork.xyz');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fundMovementWallet();
}

module.exports = { fundMovementWallet };