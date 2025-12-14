import { NextRequest, NextResponse } from 'next/server';
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

// Game types mapping
const GAME_TYPES = {
  plinko: 1,
  mines: 2,
  roulette: 3,
  wheel: 4,
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameType, playerAddress, betAmount, result, payout, randomSeed } = body;

    // Validate input
    if (!gameType || !playerAddress || !betAmount || !result || payout === undefined || !randomSeed) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!GAME_TYPES[gameType as keyof typeof GAME_TYPES]) {
      return NextResponse.json(
        { error: 'Invalid game type' },
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

    // Ensure GameLog resource exists for treasury; if not, initialize
    const moduleAddr = process.env.NEXT_PUBLIC_MOVEMENT_GAME_LOGGER_ADDRESS!;
    try {
      await movement.getAccountResource({
        accountAddress: String(treasuryAccount.accountAddress),
        resourceType: `${moduleAddr}::game_logger::GameLog`,
      });
    } catch {
      // Initialize logger
      const initTx = await movement.transaction.build.simple({
        sender: treasuryAccount.accountAddress,
        data: {
          function: `${moduleAddr}::game_logger::initialize`,
          functionArguments: [],
        },
        options: { maxGasAmount: 200000, gasUnitPrice: 100 },
      });
      await movement.signAndSubmitTransaction({ signer: treasuryAccount, transaction: initTx });
    }

    // Normalize amounts to octas (u64) and player address to string
    const toOctas = (n: number) => Math.floor(Number(n) * 100000000);
    const betAmountOctas = toOctas(betAmount);
    const payoutOctas = toOctas(payout);
    const playerStr = String(playerAddress);

    // Build transaction
    const transaction = await movement.transaction.build.simple({
      sender: treasuryAccount.accountAddress,
      data: {
        function: `${process.env.NEXT_PUBLIC_MOVEMENT_GAME_LOGGER_ADDRESS}::game_logger::log_game`,
        functionArguments: [
          GAME_TYPES[gameType as keyof typeof GAME_TYPES], // game_type
          playerStr, // player_address
          betAmountOctas, // bet_amount
          result, // result
          payoutOctas, // payout
          randomSeed.toString(), // random_seed
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
    console.log('🎮 GAME LOGGED TO MOVEMENT BLOCKCHAIN:');
    console.log('├── Game Type:', gameType);
    console.log('├── Player:', playerAddress);
    console.log('├── Bet Amount:', betAmount, 'MOVE');
    console.log('├── Result:', result);
    console.log('├── Payout:', payout, 'MOVE');
    console.log('├── Random Seed:', randomSeed);
    console.log('├── Transaction Hash:', committedTxn.hash);
    console.log('├── Treasury Address:', treasuryAccount.accountAddress.toString());
    console.log('├── VM Status:', executedTransaction.vm_status);
    console.log('├── Success:', executedTransaction.success);
    console.log('├── 🎲 Random seed provided by client');
    console.log('├── 🔐 Transaction signed by Treasury wallet');
    console.log('└── 🌐 Explorer URL:', `https://explorer.movementnetwork.xyz/txn/${committedTxn.hash}?network=bardock+testnet`);

    return NextResponse.json({
      success: true,
      transactionHash: committedTxn.hash,
      gameLogged: true,
      explorerUrl: `https://explorer.movementnetwork.xyz/txn/${committedTxn.hash}?network=bardock+testnet`,
    });

  } catch (error: any) {
    console.error('Error logging game:', error);
    return NextResponse.json(
      { error: `Failed to log game to blockchain: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}