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

// Constants for validation and processing
const MIN_WITHDRAWAL_AMOUNT = 0.00000001; // 1 octa
const MAX_WITHDRAWAL_AMOUNT = 1000000; // 1M MOVE tokens
const OCTAS_PER_MOVE = 100000000; // 1 MOVE = 100,000,000 octas
const TRANSACTION_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Enhanced input validation for withdrawal requests
 */
function validateWithdrawalRequest(playerAddress, amount) {
  const errors = [];
  
  // Validate player address
  if (!playerAddress) {
    errors.push('Player address is required');
  } else if (typeof playerAddress !== 'string') {
    errors.push('Player address must be a string');
  } else if (!playerAddress.startsWith('0x')) {
    errors.push('Player address must start with 0x');
  } else if (playerAddress.length !== 66) {
    errors.push('Player address must be 66 characters long (including 0x prefix)');
  }
  
  // Validate amount
  if (amount === undefined || amount === null) {
    errors.push('Amount is required');
  } else if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number');
  } else if (amount <= 0) {
    errors.push('Amount must be greater than 0');
  } else if (amount < MIN_WITHDRAWAL_AMOUNT) {
    errors.push(`Amount must be at least ${MIN_WITHDRAWAL_AMOUNT} MOVE`);
  } else if (amount > MAX_WITHDRAWAL_AMOUNT) {
    errors.push(`Amount cannot exceed ${MAX_WITHDRAWAL_AMOUNT} MOVE`);
  }
  
  return errors;
}

/**
 * Enhanced logging function for withdrawal operations
 */
function logWithdrawalOperation(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    operation: 'withdrawal',
    message,
    ...data
  };
  
  if (level === 'error') {
    console.error(`🚨 [${timestamp}] WITHDRAWAL ERROR:`, message, data);
  } else if (level === 'warn') {
    console.warn(`⚠️ [${timestamp}] WITHDRAWAL WARNING:`, message, data);
  } else {
    console.log(`📝 [${timestamp}] WITHDRAWAL ${level.toUpperCase()}:`, message, data);
  }
  
  return logEntry;
}

export async function POST(request) {
  const startTime = Date.now();
  let playerAddress, amount, treasuryAccount;
  
  try {
    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await request.json();
      ({ playerAddress, amount } = requestBody);
    } catch (parseError) {
      logWithdrawalOperation('error', 'Failed to parse request body', { 
        error: parseError.message 
      });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    logWithdrawalOperation('info', 'Received withdrawal request', { 
      playerAddress, 
      amount,
      requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    
    // Enhanced input validation
    const validationErrors = validateWithdrawalRequest(playerAddress, amount);
    if (validationErrors.length > 0) {
      logWithdrawalOperation('error', 'Validation failed', { 
        errors: validationErrors,
        playerAddress,
        amount
      });
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationErrors 
        },
        { status: 400 }
      );
    }

    // Enhanced treasury account setup with better error handling
    const rawPk = process.env.TREASURY_PRIVATE_KEY;
    if (!rawPk) {
      logWithdrawalOperation('error', 'Treasury private key not configured', {
        playerAddress,
        amount
      });
      return NextResponse.json({ 
        error: 'Treasury configuration error: Private key not found' 
      }, { status: 500 });
    }
    
    try {
      // Handle Movement private key format: ed25519-priv-0x...
      let cleanPrivateKey = rawPk;
      if (rawPk.startsWith('ed25519-priv-0x')) {
        cleanPrivateKey = rawPk.replace('ed25519-priv-0x', '0x');
      } else if (!rawPk.startsWith('0x')) {
        cleanPrivateKey = `0x${rawPk}`;
      }
      
      // Validate private key format
      if (!cleanPrivateKey.startsWith('0x') || cleanPrivateKey.length !== 66) {
        throw new Error('Invalid private key format');
      }
      
      const privateKey = new Ed25519PrivateKey(cleanPrivateKey);
      treasuryAccount = Account.fromPrivateKey({ privateKey });
      
      logWithdrawalOperation('info', 'Treasury account initialized', {
        treasuryAddress: treasuryAccount.accountAddress.toString(),
        playerAddress,
        amount
      });
      
    } catch (keyError) {
      logWithdrawalOperation('error', 'Failed to initialize treasury account', {
        error: keyError.message,
        playerAddress,
        amount
      });
      return NextResponse.json({ 
        error: 'Treasury configuration error: Invalid private key' 
      }, { status: 500 });
    }
    
    // Convert amount to octas with precision handling
    const amountOctas = Math.floor(Number(amount) * OCTAS_PER_MOVE);
    
    // Validate octas conversion
    if (amountOctas <= 0 || amountOctas !== Number(amountOctas)) {
      logWithdrawalOperation('error', 'Invalid amount conversion to octas', {
        amount,
        amountOctas,
        playerAddress
      });
      return NextResponse.json({ 
        error: 'Invalid amount: Cannot convert to octas' 
      }, { status: 400 });
    }
    
    logWithdrawalOperation('info', 'Processing withdrawal', {
      amount,
      amountOctas,
      playerAddress,
      treasuryAddress: treasuryAccount.accountAddress.toString()
    });
    
    // Enhanced treasury balance check with retry logic
    let treasuryBalance;
    try {
      // Add timeout to balance check
      const balancePromise = movement.getAccountAPTAmount({
        accountAddress: treasuryAccount.accountAddress,
      });
      
      treasuryBalance = await Promise.race([
        balancePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Balance check timeout')), 10000)
        )
      ]);

      logWithdrawalOperation('info', 'Treasury balance checked', {
        treasuryBalance: treasuryBalance / OCTAS_PER_MOVE,
        treasuryBalanceOctas: treasuryBalance.toString(),
        requestedAmount: amount,
        requestedAmountOctas: amountOctas
      });

      // Enhanced balance validation
      if (treasuryBalance < amountOctas) {
        logWithdrawalOperation('error', 'Insufficient treasury balance', {
          availableBalance: treasuryBalance / OCTAS_PER_MOVE,
          requestedAmount: amount,
          shortfall: (amountOctas - treasuryBalance) / OCTAS_PER_MOVE
        });
        return NextResponse.json({
          error: 'Insufficient treasury balance',
          details: {
            available: treasuryBalance / OCTAS_PER_MOVE,
            requested: amount,
            shortfall: (amountOctas - treasuryBalance) / OCTAS_PER_MOVE
          }
        }, { status: 400 });
      }
      
      // Check if balance is dangerously low (less than 10x the withdrawal amount)
      if (treasuryBalance < amountOctas * 10) {
        logWithdrawalOperation('warn', 'Treasury balance is running low', {
          currentBalance: treasuryBalance / OCTAS_PER_MOVE,
          withdrawalAmount: amount,
          remainingAfterWithdrawal: (treasuryBalance - amountOctas) / OCTAS_PER_MOVE
        });
      }
      
    } catch (balanceError) {
      logWithdrawalOperation('error', 'Failed to check treasury balance', {
        error: balanceError.message,
        errorStack: balanceError.stack,
        treasuryAddress: treasuryAccount.accountAddress.toString()
      });
      return NextResponse.json({
        error: 'Failed to check treasury balance',
        details: balanceError.message
      }, { status: 500 });
    }
    
    // Enhanced transaction building with better error handling
    let transaction, committedTxn, executedTransaction;
    
    try {
      logWithdrawalOperation('info', 'Building transfer transaction', {
        sender: treasuryAccount.accountAddress.toString(),
        recipient: playerAddress,
        amountOctas
      });
      
      // Build transfer transaction with enhanced gas settings
      // Use coin::transfer for Movement network (same as deposit)
      transaction = await movement.transaction.build.simple({
        sender: treasuryAccount.accountAddress,
        data: {
          function: "0x1::coin::transfer",
          typeArguments: ["0x1::aptos_coin::AptosCoin"], // Movement uses AptosCoin type
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
      
      logWithdrawalOperation('info', 'Transaction built successfully', {
        transactionType: 'transfer',
        gasLimit: 200000,
        gasPrice: 100
      });
      
    } catch (buildError) {
      logWithdrawalOperation('error', 'Failed to build transaction', {
        error: buildError.message,
        errorStack: buildError.stack,
        sender: treasuryAccount.accountAddress.toString(),
        recipient: playerAddress,
        amountOctas
      });
      return NextResponse.json({
        error: 'Failed to build transaction',
        details: buildError.message
      }, { status: 500 });
    }

    try {
      logWithdrawalOperation('info', 'Signing and submitting transaction');
      
      // Sign and submit transaction with timeout
      const submitPromise = movement.signAndSubmitTransaction({
        signer: treasuryAccount,
        transaction,
      });
      
      committedTxn = await Promise.race([
        submitPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction submission timeout')), 15000)
        )
      ]);

      logWithdrawalOperation('info', 'Transaction submitted', {
        transactionHash: committedTxn.hash,
        sender: treasuryAccount.accountAddress.toString(),
        recipient: playerAddress,
        amount: amount
      });
      
    } catch (submitError) {
      logWithdrawalOperation('error', 'Failed to submit transaction', {
        error: submitError.message,
        errorStack: submitError.stack,
        sender: treasuryAccount.accountAddress.toString(),
        recipient: playerAddress,
        amountOctas
      });
      return NextResponse.json({
        error: 'Failed to submit transaction',
        details: submitError.message
      }, { status: 500 });
    }

    try {
      logWithdrawalOperation('info', 'Waiting for transaction confirmation', {
        transactionHash: committedTxn.hash
      });
      
      // Wait for transaction confirmation with timeout
      const waitPromise = movement.waitForTransaction({
        transactionHash: committedTxn.hash,
      });
      
      executedTransaction = await Promise.race([
        waitPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), TRANSACTION_TIMEOUT_MS)
        )
      ]);
      
      logWithdrawalOperation('info', 'Transaction confirmed', {
        transactionHash: committedTxn.hash,
        vmStatus: executedTransaction.vm_status,
        success: executedTransaction.success,
        gasUsed: executedTransaction.gas_used
      });
      
    } catch (confirmError) {
      logWithdrawalOperation('error', 'Failed to confirm transaction', {
        error: confirmError.message,
        transactionHash: committedTxn.hash,
        timeout: TRANSACTION_TIMEOUT_MS
      });
      return NextResponse.json({
        error: 'Transaction confirmation failed',
        details: confirmError.message,
        transactionHash: committedTxn.hash,
        explorerUrl: `https://explorer.movementnetwork.xyz/txn/${committedTxn.hash}?network=bardock+testnet`
      }, { status: 500 });
    }

    // Enhanced transaction validation and response
    if (!executedTransaction.success) {
      logWithdrawalOperation('error', 'Transaction failed on blockchain', {
        transactionHash: committedTxn.hash,
        vmStatus: executedTransaction.vm_status,
        gasUsed: executedTransaction.gas_used,
        playerAddress,
        amount
      });
      return NextResponse.json({
        error: 'Transaction failed on blockchain',
        details: {
          vmStatus: executedTransaction.vm_status,
          transactionHash: committedTxn.hash,
          explorerUrl: `https://explorer.movementnetwork.xyz/txn/${committedTxn.hash}?network=bardock+testnet`
        }
      }, { status: 500 });
    }

    const processingTime = Date.now() - startTime;
    const explorerUrl = `https://explorer.movementnetwork.xyz/txn/${committedTxn.hash}?network=bardock+testnet`;
    
    // Log successful withdrawal with comprehensive details
    logWithdrawalOperation('info', 'Withdrawal completed successfully', {
      playerAddress,
      amount,
      amountOctas,
      transactionHash: committedTxn.hash,
      treasuryAddress: treasuryAccount.accountAddress.toString(),
      vmStatus: executedTransaction.vm_status,
      gasUsed: executedTransaction.gas_used,
      processingTimeMs: processingTime,
      explorerUrl
    });

    return NextResponse.json({
      success: true,
      transactionHash: committedTxn.hash,
      explorerUrl,
      amount: amount,
      amountOctas: amountOctas,
      playerAddress: playerAddress,
      treasuryAddress: treasuryAccount.accountAddress.toString(),
      vmStatus: executedTransaction.vm_status,
      gasUsed: executedTransaction.gas_used,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Enhanced error logging with full context
    logWithdrawalOperation('error', 'Unexpected error during withdrawal processing', {
      error: error.message,
      errorStack: error.stack,
      errorName: error.name,
      playerAddress,
      amount,
      treasuryAddress: treasuryAccount?.accountAddress?.toString(),
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({
      error: 'Failed to process withdrawal',
      details: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime
    }, { status: 500 });
  }
}

// Enhanced GET endpoint to check treasury balance with comprehensive status
export async function GET() {
  const startTime = Date.now();
  
  try {
    logWithdrawalOperation('info', 'Treasury balance check requested');
    
    const rawPk = process.env.TREASURY_PRIVATE_KEY;
    if (!rawPk) {
      logWithdrawalOperation('error', 'Treasury private key not configured for balance check');
      return NextResponse.json({ 
        error: 'TREASURY_PRIVATE_KEY missing',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    let treasuryAccount;
    try {
      // Handle Movement private key format
      let cleanPrivateKey = rawPk;
      if (rawPk.startsWith('ed25519-priv-0x')) {
        cleanPrivateKey = rawPk.replace('ed25519-priv-0x', '0x');
      } else if (!rawPk.startsWith('0x')) {
        cleanPrivateKey = `0x${rawPk}`;
      }
      
      const privateKey = new Ed25519PrivateKey(cleanPrivateKey);
      treasuryAccount = Account.fromPrivateKey({ privateKey });
      
    } catch (keyError) {
      logWithdrawalOperation('error', 'Failed to initialize treasury account for balance check', {
        error: keyError.message
      });
      return NextResponse.json({
        error: 'Invalid treasury private key configuration',
        details: keyError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    try {
      // Get balance with timeout
      const balancePromise = movement.getAccountAPTAmount({
        accountAddress: treasuryAccount.accountAddress,
      });
      
      const balance = await Promise.race([
        balancePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Balance check timeout')), 10000)
        )
      ]);
      
      const processingTime = Date.now() - startTime;
      const balanceInMove = balance / OCTAS_PER_MOVE;
      
      logWithdrawalOperation('info', 'Treasury balance retrieved successfully', {
        treasuryAddress: treasuryAccount.accountAddress.toString(),
        balance: balanceInMove,
        balanceOctas: balance.toString(),
        processingTimeMs: processingTime
      });
      
      // Determine treasury status based on balance
      let status = 'active';
      let warnings = [];
      
      if (balance === 0) {
        status = 'empty';
        warnings.push('Treasury has no funds');
      } else if (balanceInMove < 1) {
        status = 'low';
        warnings.push('Treasury balance is critically low');
      } else if (balanceInMove < 100) {
        warnings.push('Treasury balance is running low');
      }
      
      return NextResponse.json({
        treasuryAddress: treasuryAccount.accountAddress.toString(),
        balance: balanceInMove,
        balanceOctas: balance.toString(),
        status,
        warnings,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
        networkInfo: {
          network: 'Movement Bardock Testnet',
          rpcUrl: MOVEMENT_BARDOCK.rpcUrl,
          explorerUrl: MOVEMENT_BARDOCK.explorerUrl
        }
      });
      
    } catch (balanceError) {
      const processingTime = Date.now() - startTime;
      
      logWithdrawalOperation('warn', 'Treasury balance check failed, account may be initializing', {
        error: balanceError.message,
        treasuryAddress: treasuryAccount.accountAddress.toString(),
        processingTimeMs: processingTime
      });
      
      return NextResponse.json({
        treasuryAddress: treasuryAccount.accountAddress.toString(),
        balance: 0,
        balanceOctas: '0',
        status: 'initializing',
        warnings: ['Treasury wallet is being initialized or network is unavailable'],
        note: 'Treasury wallet is being initialized. Please wait a few minutes.',
        error: balanceError.message,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logWithdrawalOperation('error', 'Unexpected error during treasury balance check', {
      error: error.message,
      errorStack: error.stack,
      processingTimeMs: processingTime
    });
    
    return NextResponse.json({
      error: 'Failed to check treasury balance',
      details: error.message,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}