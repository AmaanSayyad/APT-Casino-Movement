/**
 * Movement Game Logger Hook
 * 
 * Hook for logging game results to Movement blockchain via game_logger contract.
 * Implements retry logic and transaction hash storage as per requirements.
 */

import { useState, useCallback } from 'react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { MOVEMENT_BARDOCK, MOVEMENT_ENV_CONFIG } from '@/config/movement';
import { 
  storeGameTransaction, 
  updateTransactionStatus, 
  getTransactionHashByGameId,
  getPendingTransactions,
  cleanupOldEntries,
  findStoredTransactionByHash
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
  const { account } = useWallet();

  // Initialize Movement client for Movement Bardock (only used for reading game history)
  const aptosConfig = new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_BARDOCK.rpcUrl,
  });
  const movement = new Aptos(aptosConfig);

  /**
   * Log a game result to Movement blockchain via API endpoint
   */
  const logGame = useCallback(async (params: GameLogParams): Promise<LogResult> => {
    if (!account?.address) {
      return { success: false, error: 'Wallet not connected' };
    }

    setIsLogging(true);
    setError(null);

    const maxRetries = 3;
    let lastError: string = '';
    let pendingTxHash: string | null = null;

    // Create a single pending transaction entry at the start
    pendingTxHash = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    storeGameTransaction(pendingTxHash, {
      gameType: params.gameType,
      playerAddress: params.playerAddress,
      betAmount: params.betAmount.toString(),
      result: params.result,
      payout: params.payout.toString(),
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Logging game to Movement via API (attempt ${attempt}/${maxRetries})

        // Call the API endpoint
        const response = await fetch('/api/log-game', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gameType: params.gameType,
            playerAddress: params.playerAddress,
            betAmount: Number(params.betAmount) / 100000000, // Convert octas to MOVE
            result: params.result,
            payout: Number(params.payout) / 100000000, // Convert octas to MOVE
            randomSeed: params.randomSeed.toString(),
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Game successfully logged to Movement via API

          // Update the existing pending transaction with the real transaction hash
          if (result.transactionHash && pendingTxHash) {
            // Remove the pending entry
            const pendingEntry = findStoredTransactionByHash(pendingTxHash);
            if (pendingEntry) {
              localStorage.removeItem(pendingEntry.key);
            }

            // Store the successful transaction
            storeGameTransaction(result.transactionHash, {
              gameType: params.gameType,
              playerAddress: params.playerAddress,
              betAmount: params.betAmount.toString(),
              result: params.result,
              payout: params.payout.toString(),
            });

            // Update status to confirmed
            updateTransactionStatus(result.transactionHash, 'confirmed');
          }

          // Cleanup old entries periodically
          cleanupOldEntries();

          setIsLogging(false);
          return {
            success: true,
            transactionHash: result.transactionHash,
            explorerUrl: result.explorerUrl,
          };
        } else {
          lastError = result.error || 'API request failed';
          // Attempt ${attempt} failed: ${lastError}
        }
      } catch (err: any) {
        lastError = err.message || 'Network error occurred';
        // Attempt ${attempt} failed: ${lastError}
        
        // If it's the last attempt, don't wait
        if (attempt < maxRetries) {
          // Exponential backoff: wait 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed - mark the existing pending transaction as failed
    const errorMsg = `Failed to log game after ${maxRetries} attempts: ${lastError}`;
    setError(errorMsg);
    // Failed to log game after retries

    // Mark the existing pending transaction as failed
    if (pendingTxHash) {
      updateTransactionStatus(pendingTxHash, 'failed');
    }

    // Stored failed game log as pending

    setIsLogging(false);
    return { 
      success: false, 
      error: errorMsg,
      transactionHash: pendingTxHash, // Return pending hash for tracking
    };
  }, [account]);

  /**
   * Get game history from Movement blockchain
   */
  const getGameHistory = useCallback(async (limit = 50): Promise<GameHistoryEntry[]> => {
    if (!MOVEMENT_ENV_CONFIG.treasuryAddress) {
      // Treasury address not configured
      return [];
    }

    try {
      const result = await movement.view({
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
      // Error fetching game history from Movement
      return [];
    }
  }, [movement]);

  /**
   * Retry all pending game logs
   */
  const retryPendingLogs = useCallback(async () => {
    const pendingLogs = getPendingTransactions();
    let attempted = 0;
    let successful = 0;
    let failed = 0;

    // Retrying pending game logs

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
          // Error retrying pending log
          failed++;
        }

        // Add delay between retries to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Retry completed
    
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