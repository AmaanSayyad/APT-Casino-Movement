/**
 * Movement Game Logger Hook
 * 
 * Hook for logging game results to Movement blockchain via game_logger contract.
 * Implements retry logic and transaction hash storage as per requirements.
 */

import { useState, useCallback } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { MOVEMENT_BARDOCK, MOVEMENT_ENV_CONFIG, getMovementExplorerTxUrl } from '@/config/movement';
import { 
  storeGameTransaction, 
  updateTransactionStatus, 
  getTransactionHashByGameId,
  getPendingTransactions,
  cleanupOldEntries 
} from '@/lib/gameHistoryStorage';

// Game type constants matching the Move contract
const GAME_TYPES = {
  plinko: 1,
  mines: 2,
  roulette: 3,
  wheel: 4,
} as const;

export interface GameLogParams {
  gameType: 'plinko' | 'mines' | 'roulette' | 'wheel';
  playerAddress: string;
  betAmount: bigint;
  result: string;
  payout: bigint;
  randomSeed: bigint;
}

export interface LogResult {
  success: boolean;
  transactionHash?: string;
  explorerUrl?: string;
  error?: string;
}

export interface GameHistoryEntry {
  gameId: number;
  gameType: number;
  playerAddress: string;
  betAmount: bigint;
  result: string;
  payout: bigint;
  timestamp: number;
  randomSeed: bigint;
  transactionHash?: string;
}

export interface UseMovementGameLogger {
  logGame: (params: GameLogParams) => Promise<LogResult>;
  getGameHistory: (limit?: number) => Promise<GameHistoryEntry[]>;
  retryPendingLogs: () => Promise<{ attempted: number; successful: number; failed: number }>;
  getPendingLogsCount: () => number;
  isLogging: boolean;
  error: string | null;
}

/**
 * Hook for logging games to Movement blockchain
 */
export function useMovementGameLogger(): UseMovementGameLogger {
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { account, signAndSubmitTransaction } = useWallet();

  // Initialize Aptos client for Movement Bardock
  const aptosConfig = new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_BARDOCK.rpcUrl,
  });
  const aptos = new Aptos(aptosConfig);

  /**
   * Log a game result to Movement blockchain with retry logic
   */
  const logGame = useCallback(async (params: GameLogParams): Promise<LogResult> => {
    if (!account?.address) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (!MOVEMENT_ENV_CONFIG.treasuryAddress) {
      return { success: false, error: 'Treasury address not configured' };
    }

    setIsLogging(true);
    setError(null);

    const maxRetries = 3;
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎯 Logging game to Movement (attempt ${attempt}/${maxRetries}):`, {
          gameType: params.gameType,
          playerAddress: params.playerAddress,
          betAmount: params.betAmount.toString(),
          result: params.result,
          payout: params.payout.toString(),
          randomSeed: params.randomSeed.toString(),
        });

        // Build transaction payload
        const transaction = {
          type: "entry_function_payload",
          function: `${MOVEMENT_ENV_CONFIG.gameLoggerAddress}::game_logger::log_game`,
          functionArguments: [
            GAME_TYPES[params.gameType], // game_type: u8
            params.playerAddress,        // player_address: String
            params.betAmount.toString(), // bet_amount: u64
            params.result,              // result: String
            params.payout.toString(),   // payout: u64
            params.randomSeed.toString(), // random_seed: u64
          ],
        };

        // Submit transaction using wallet adapter (same pattern as balance hook)
        const response = await (signAndSubmitTransaction as any)(transaction);

        // Wait for transaction confirmation
        const txResult = await aptos.waitForTransaction({
          transactionHash: response.hash,
        });

        if (txResult.success) {
          const explorerUrl = getMovementExplorerTxUrl(response.hash);
          
          console.log('✅ Game successfully logged to Movement:');
          console.log('├── Transaction Hash:', response.hash);
          console.log('├── Explorer URL:', explorerUrl);
          console.log('├── Game Type:', params.gameType);
          console.log('├── Player:', params.playerAddress);
          console.log('├── Bet Amount:', params.betAmount.toString(), 'octas');
          console.log('├── Result:', params.result);
          console.log('├── Payout:', params.payout.toString(), 'octas');
          console.log('└── Random Seed:', params.randomSeed.toString());

          // Store transaction hash in local storage for history
          storeGameTransaction(response.hash, {
            gameType: params.gameType,
            playerAddress: params.playerAddress,
            betAmount: params.betAmount.toString(),
            result: params.result,
            payout: params.payout.toString(),
          });

          // Update status to confirmed
          updateTransactionStatus(response.hash, 'confirmed');

          // Cleanup old entries periodically
          cleanupOldEntries();

          return {
            success: true,
            transactionHash: response.hash,
            explorerUrl,
          };
        } else {
          lastError = `Transaction failed: ${txResult.vm_status}`;
          console.warn(`⚠️ Attempt ${attempt} failed:`, lastError);
        }
      } catch (err: any) {
        lastError = err.message || 'Unknown error occurred';
        console.warn(`⚠️ Attempt ${attempt} failed:`, lastError);
        
        // If it's the last attempt, don't wait
        if (attempt < maxRetries) {
          // Exponential backoff: wait 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed - mark as pending
    const errorMsg = `Failed to log game after ${maxRetries} attempts: ${lastError}`;
    setError(errorMsg);
    console.error('❌', errorMsg);

    // Store as pending transaction for potential manual retry later
    const pendingTxHash = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    storeGameTransaction(pendingTxHash, {
      gameType: params.gameType,
      playerAddress: params.playerAddress,
      betAmount: params.betAmount.toString(),
      result: params.result,
      payout: params.payout.toString(),
    });

    // Mark as failed status
    updateTransactionStatus(pendingTxHash, 'failed');

    console.log('📝 Stored failed game log as pending:', {
      pendingTxHash,
      gameType: params.gameType,
      error: errorMsg,
    });

    return { 
      success: false, 
      error: errorMsg,
      transactionHash: pendingTxHash, // Return pending hash for tracking
    };
  }, [account, signAndSubmitTransaction, aptos]);

  /**
   * Get game history from Movement blockchain
   */
  const getGameHistory = useCallback(async (limit = 50): Promise<GameHistoryEntry[]> => {
    if (!MOVEMENT_ENV_CONFIG.treasuryAddress) {
      console.error('Treasury address not configured');
      return [];
    }

    try {
      const result = await aptos.view({
        payload: {
          function: `${MOVEMENT_ENV_CONFIG.gameLoggerAddress}::game_logger::get_game_history`,
          functionArguments: [MOVEMENT_ENV_CONFIG.treasuryAddress],
        },
      });

      if (Array.isArray(result) && result.length > 0) {
        const games = result[0] as any[];
        
        return games
          .slice(-limit) // Get last N games
          .map((game: any) => ({
            gameId: Number(game.game_id),
            gameType: Number(game.game_type),
            playerAddress: game.player_address,
            betAmount: BigInt(game.bet_amount),
            result: game.result,
            payout: BigInt(game.payout),
            timestamp: Number(game.timestamp),
            randomSeed: BigInt(game.random_seed),
            transactionHash: getTransactionHashByGameId(Number(game.game_id)) || undefined,
          }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching game history from Movement:', error);
      return [];
    }
  }, [aptos]);

  /**
   * Retry all pending game logs
   */
  const retryPendingLogs = useCallback(async () => {
    const pendingLogs = getPendingTransactions();
    let attempted = 0;
    let successful = 0;
    let failed = 0;

    console.log(`🔄 Retrying ${pendingLogs.length} pending game logs...`);

    for (const pendingLog of pendingLogs) {
      if (pendingLog.status === 'failed' && pendingLog.transactionHash.startsWith('pending_')) {
        attempted++;
        
        try {
          const params: GameLogParams = {
            gameType: pendingLog.gameType as 'plinko' | 'mines' | 'roulette' | 'wheel',
            playerAddress: pendingLog.playerAddress,
            betAmount: BigInt(pendingLog.betAmount),
            result: pendingLog.result,
            payout: BigInt(pendingLog.payout),
            randomSeed: BigInt(Date.now()), // Generate new random seed for retry
          };

          const result = await logGame(params);
          
          if (result.success) {
            successful++;
            // Remove the old pending entry since we have a new successful one
            // This will be handled by the storage cleanup
          } else {
            failed++;
          }
        } catch (error) {
          console.error('Error retrying pending log:', error);
          failed++;
        }

        // Add delay between retries to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Retry completed: ${successful}/${attempted} successful, ${failed} failed`);
    
    return { attempted, successful, failed };
  }, [logGame]);

  /**
   * Get count of pending logs
   */
  const getPendingLogsCount = useCallback(() => {
    return getPendingTransactions().filter(tx => 
      tx.status === 'failed' && tx.transactionHash.startsWith('pending_')
    ).length;
  }, []);

  return {
    logGame,
    getGameHistory,
    retryPendingLogs,
    getPendingLogsCount,
    isLogging,
    error,
  };
}



export default useMovementGameLogger;