const { Movement, AptosConfig, Network, Ed25519PrivateKey, Account } = require('@aptos-labs/ts-sdk');
const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Movement Bardock Testnet Configuration
const MOVEMENT_BARDOCK_CONFIG = {
  network: Network.CUSTOM,
  fullnode: 'https://testnet.movementnetwork.xyz/v1',
  faucet: 'https://faucet.testnet.movementnetwork.xyz/',
  chainId: 250,
  explorerUrl: 'https://explorer.movementnetwork.xyz/?network=bardock+testnet'
};

async function deployToMovement() {
  try {
    console.log('🚀 Starting Movement Bardock deployment...\n');

    // Validate environment variables
    if (!process.env.TREASURY_PRIVATE_KEY) {
      throw new Error('TREASURY_PRIVATE_KEY environment variable is required');
    }

    // Create Movement client for Movement Bardock
    const config = new AptosConfig({ 
      network: MOVEMENT_BARDOCK_CONFIG.network,
      fullnode: MOVEMENT_BARDOCK_CONFIG.fullnode,
      faucet: MOVEMENT_BARDOCK_CONFIG.faucet
    });
    const movement = new Aptos(config);

    // Create treasury account from private key
    const privateKey = new Ed25519PrivateKey(process.env.TREASURY_PRIVATE_KEY);
    const treasuryAccount = Account.fromPrivateKey({ privateKey });
    const treasuryAddress = treasuryAccount.accountAddress.toString();

    console.log('📋 Deployment Configuration:');
    console.log(`   Network: Movement Bardock Testnet (Chain ID: ${MOVEMENT_BARDOCK_CONFIG.chainId})`);
    console.log(`   RPC URL: ${MOVEMENT_BARDOCK_CONFIG.fullnode}`);
    console.log(`   Treasury Address: ${treasuryAddress}`);
    console.log(`   Explorer: ${MOVEMENT_BARDOCK_CONFIG.explorerUrl}\n`);

    // Check treasury account balance
    try {
      const resources = await movement.getAccountResources({ accountAddress: treasuryAddress });
      const coinResource = resources.find(r => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
      if (coinResource) {
        const balance = parseInt(coinResource.data.coin.value) / 100000000; // Convert from octas to MOVE
        console.log(`💰 Treasury Balance: ${balance} MOVE\n`);
        
        if (balance < 0.1) {
          console.log('⚠️  Low balance detected. You may need to fund your account at:');
          console.log(`   ${MOVEMENT_BARDOCK_CONFIG.faucet}\n`);
        }
      }
    } catch (error) {
      console.log('⚠️  Could not fetch account balance. Account may not exist yet.\n');
    }

    // Step 1: Compile the Move module
    console.log('🔨 Step 1: Compiling Move module...');
    const moveContractsPath = path.join(__dirname, '..', 'move-contracts');
    
    try {
      // Use movement CLI to compile (falls back to movement CLI if movement not available)
      let compileCommand;
      try {
        execSync('movement --version', { stdio: 'ignore' });
        compileCommand = `cd ${moveContractsPath} && movement move compile --named-addresses movement_casino=${treasuryAddress}`;
      } catch {
        console.log('   Movement CLI not found, using Movement CLI...');
        compileCommand = `cd ${moveContractsPath} && movement move compile --named-addresses movement_casino=${treasuryAddress}`;
      }
      
      const compileOutput = execSync(compileCommand, { encoding: 'utf8' });
      console.log('   ✅ Compilation successful\n');
    } catch (error) {
      console.error('   ❌ Compilation failed:', error.message);
      throw error;
    }

    // Step 2: Publish the module
    console.log('📦 Step 2: Publishing module to Movement Bardock...');
    
    try {
      let publishCommand;
      // Windows compatible approach
      const fs = require('fs');
      const tempKeyFile = path.join(__dirname, 'temp_private_key.txt');
      let publishOutput = '';
      
      try {
        // Write private key to temporary file
        fs.writeFileSync(tempKeyFile, process.env.TREASURY_PRIVATE_KEY);
        
        // Try movement CLI first, then movement CLI
        let publishCommand;
        try {
          execSync('movement --version', { stdio: 'ignore' });
          publishCommand = `movement move publish --named-addresses movement_casino=${treasuryAddress} --url ${MOVEMENT_BARDOCK_CONFIG.fullnode} --private-key-file ${tempKeyFile} --assume-yes`;
        } catch {
          publishCommand = `movement move publish --named-addresses movement_casino=${treasuryAddress} --url ${MOVEMENT_BARDOCK_CONFIG.fullnode} --private-key-file ${tempKeyFile} --assume-yes`;
        }
        
        publishOutput = execSync(publishCommand, { 
          encoding: 'utf8',
          cwd: moveContractsPath
        });
        
        // Clean up temporary file
        fs.unlinkSync(tempKeyFile);
      } catch (error) {
        // Clean up temporary file on error
        if (fs.existsSync(tempKeyFile)) {
          fs.unlinkSync(tempKeyFile);
        }
        throw error;
      }
      
      // Extract transaction hash from output
      const hashMatch = publishOutput.match(/Transaction submitted: .*\/txn\/([a-fA-F0-9]+)/);
      const transactionHash = hashMatch ? hashMatch[1] : null;
      
      console.log('   ✅ Module published successfully');
      if (transactionHash) {
        console.log(`   📋 Transaction Hash: ${transactionHash}`);
        console.log(`   🔍 Explorer: ${MOVEMENT_BARDOCK_CONFIG.explorerUrl}&txn=${transactionHash}`);
      }
      console.log('');
    } catch (error) {
      console.error('   ❌ Publishing failed:', error.message);
      throw error;
    }

    // Step 3: Initialize Game Logger contract
    console.log('🎮 Step 3: Initializing Game Logger contract...');
    
    try {
      const transaction = await movement.transaction.build.simple({
        sender: treasuryAccount.accountAddress,
        data: {
          function: `${treasuryAddress}::game_logger::initialize`,
          functionArguments: [],
        },
      });

      const committedTxn = await movement.signAndSubmitTransaction({
        signer: treasuryAccount,
        transaction,
      });

      console.log(`   📋 Initialization Transaction Hash: ${committedTxn.hash}`);

      // Wait for transaction confirmation
      const executedTransaction = await movement.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      console.log('   ✅ Game Logger initialized successfully');
      console.log(`   🔍 Explorer: ${MOVEMENT_BARDOCK_CONFIG.explorerUrl}&txn=${committedTxn.hash}\n`);

    } catch (error) {
      console.error('   ❌ Initialization failed:', error.message);
      throw error;
    }

    // Step 4: Verify deployment
    console.log('✅ Step 4: Verifying deployment...');
    
    try {
      // Check if GameLog resource exists
      const resources = await movement.getAccountResources({ accountAddress: treasuryAddress });
      const gameLogResource = resources.find(r => r.type.includes('game_logger::GameLog'));
      
      if (gameLogResource) {
        console.log('   ✅ GameLog resource found');
        console.log(`   📊 Initial game count: ${gameLogResource.data.games.length}`);
      } else {
        throw new Error('GameLog resource not found');
      }
    } catch (error) {
      console.error('   ⚠️  Verification warning:', error.message);
    }

    // Success summary
    console.log('\n🎉 Deployment completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Contract Address: ${treasuryAddress}`);
    console.log(`   Module: ${treasuryAddress}::game_logger`);
    console.log(`   Network: Movement Bardock Testnet`);
    console.log(`   Explorer: ${MOVEMENT_BARDOCK_CONFIG.explorerUrl}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Update your .env file with the contract address');
    console.log('   2. Configure your frontend to use Movement Bardock network');
    console.log('   3. Test game logging functionality');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure TREASURY_PRIVATE_KEY is set in .env');
    console.error('   2. Check account has sufficient MOVE tokens');
    console.error('   3. Verify network connectivity to Movement Bardock');
    console.error(`   4. Fund account at: ${MOVEMENT_BARDOCK_CONFIG.faucet}`);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  deployToMovement();
}

module.exports = { deployToMovement, MOVEMENT_BARDOCK_CONFIG };