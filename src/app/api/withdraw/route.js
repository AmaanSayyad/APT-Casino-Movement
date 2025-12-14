import { NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network, Ed25519PrivateKey, Account } from '@aptos-labs/ts-sdk';
import { MOVEMENT_BARDOCK } from '@/config/movement';

// Movement Bardock testnet configuration
const config = new AptosConfig({ 
  network: Network.CUSTOM,
  fullnode: MOVEMENT_BARDOCK.rpcUrl,
  faucet: MOVEMENT_BARDOCK.faucetEndpoint,
  indexer: MOVEMENT_BARDOCK.indexerUrl,
});
const movement = new Aptos(config);
const FEE_RECIPIENT = (process.env.NEXT_PUBLIC_FEE_RECIPIENT || '0xbfd4cae37a399079687652a29f06d0f42924accc3d4c5f1d5fdc4f75d9233744').toLowerCase();
const FEE_BPS = Number(process.env.WITHDRAW_PROFIT_FEE_BPS || 100); // 1% = 100 bps

export async function POST(request) {
  try {
    const { playerAddress, amount } = await request.json();
    
    console.log('📥 Received withdrawal request:', { playerAddress, amount });
    
    // Validate input
    if (!playerAddress || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: playerAddress and amount' },
        { status: 400 }
      );
    }

    // Create treasury account from private key
    const rawPk = process.env.TREASURY_PRIVATE_KEY;
    if (!rawPk) {
      return NextResponse.json({ error: 'TREASURY_PRIVATE_KEY missing' }, { status: 500 });
    }
    
    // Handle Movement private key format: ed25519-priv-0x...
    let cleanPrivateKey = rawPk;
    if (rawPk.startsWith('ed25519-priv-0x')) {
      cleanPrivateKey = rawPk.replace('ed25519-priv-0x', '0x');
    } else if (!rawPk.startsWith('0x')) {
      cleanPrivateKey = `0x${rawPk}`;
    }
    
    const privateKey = new Ed25519PrivateKey(cleanPrivateKey);
    const treasuryAccount = Account.fromPrivateKey({ privateKey });
    
    // Convert amount to octas (1 MOVE = 100,000,000 octas)
    const amountOctas = Math.floor(Number(amount) * 100000000);
    
    console.log(`🏦 Processing withdrawal: ${amount} MOVE to ${playerAddress}`);
    console.log(`📍 Treasury: ${treasuryAccount.accountAddress.toString()}`);
    
    // Check treasury balance first
    try {
      const treasuryBalance = await movement.getAccountAPTAmount({
        accountAddress: treasuryAccount.accountAddress,
      });

      console.log(`💰 Treasury balance: ${treasuryBalance / 100000000} MOVE`);

      if (treasuryBalance < amountOctas) {
        return NextResponse.json(
          { error: `Insufficient treasury balance. Available: ${treasuryBalance / 100000000} MOVE, Requested: ${amount} MOVE` },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error checking treasury balance:', error);
      return NextResponse.json(
        { error: 'Failed to check treasury balance' },
        { status: 500 }
      );
    }
    
    // Build transfer transaction
    const transaction = await movement.transaction.build.simple({
      sender: treasuryAccount.accountAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [
          playerAddress, // recipient
          amountOctas,   // amount in octas
        ],
      },
      options: {
        maxGasAmount: 200000,
        gasUnitPrice: 100,
      },
    });

    // Sign and submit transaction
    const committedTxn = await movement.signAndSubmitTransaction({
      signer: treasuryAccount,
      transaction,
    });

    // Wait for transaction confirmation
    const executedTransaction = await movement.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    // Console log for debugging
    console.log('💰 WITHDRAWAL PROCESSED:');
    console.log('├── Player Address:', playerAddress);
    console.log('├── Amount:', amount, 'MOVE');
    console.log('├── Amount (octas):', amountOctas);
    console.log('├── Transaction Hash:', committedTxn.hash);
    console.log('├── Treasury Address:', treasuryAccount.accountAddress.toString());
    console.log('├── VM Status:', executedTransaction.vm_status);
    console.log('├── Success:', executedTransaction.success);
    console.log('└── 🌐 Explorer URL:', `https://explorer.movementnetwork.xyz/txn/${committedTxn.hash}?network=bardock+testnet`);

    if (!executedTransaction.success) {
      return NextResponse.json(
        { error: 'Transaction failed on blockchain' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionHash: committedTxn.hash,
      explorerUrl: `https://explorer.movementnetwork.xyz/txn/${committedTxn.hash}?network=bardock+testnet`,
      amount: amount,
      amountOctas: amountOctas,
      playerAddress: playerAddress,
      treasuryAddress: treasuryAccount.accountAddress.toString()
    });
    
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { error: `Failed to process withdrawal: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET endpoint to check treasury balance
export async function GET() {
  try {
    const rawPk = process.env.TREASURY_PRIVATE_KEY;
    if (!rawPk) {
      return NextResponse.json({ error: 'TREASURY_PRIVATE_KEY missing' }, { status: 500 });
    }
    
    // Handle Movement private key format
    let cleanPrivateKey = rawPk;
    if (rawPk.startsWith('ed25519-priv-0x')) {
      cleanPrivateKey = rawPk.replace('ed25519-priv-0x', '0x');
    } else if (!rawPk.startsWith('0x')) {
      cleanPrivateKey = `0x${rawPk}`;
    }
    
    const privateKey = new Ed25519PrivateKey(cleanPrivateKey);
    const treasuryAccount = Account.fromPrivateKey({ privateKey });
    
    try {
      const balance = await movement.getAccountAPTAmount({
        accountAddress: treasuryAccount.accountAddress,
      });
      
      return NextResponse.json({
        treasuryAddress: treasuryAccount.accountAddress.toString(),
        balance: balance / 100000000, // Convert to MOVE
        balanceOctas: balance.toString(),
        status: 'active'
      });
    } catch (balanceError) {
      return NextResponse.json({
        treasuryAddress: treasuryAccount.accountAddress.toString(),
        balance: 0,
        balanceOctas: '0',
        status: 'initializing',
        note: 'Treasury wallet is being initialized. Please wait a few minutes.'
      });
    }
    
  } catch (error) {
    console.error('Treasury balance check error:', error);
    return NextResponse.json(
      { error: 'Failed to check treasury balance: ' + error.message },
      { status: 500 }
    );
  }
}