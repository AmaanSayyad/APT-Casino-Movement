/**
 * Game History Storage Utilities
 * 
 * Utilities for storing and retrieving game transaction hashes in local storage.
 * Implements requirements 5.3 and 5.5 for transaction hash storage.
 */

export interface StoredGameEntry {
  gameId?: number;
  transactionHash: string;
  gameType: string;
  playerAddress: string;
  betAmount: string;
  result: string;
  payout: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

const STORAGE_KEYS = {
  GAME_TX_INDEX: 'movement_game_tx_index',
  GAME_TX_PREFIX: 'movement_game_tx_',
} as const;

const MAX_STORED_ENTRIES = 100;

/**
 * Store transaction hash and game data in local storage
 */
export function storeGameTransaction(
  txHash: string,
  gameData: {
    gameType: string;
    playerAddress: string;
    betAmount: string;
    result: string;
    payout: string;
  }
): void {
  try {
    const key = `${STORAGE_KEYS.GAME_TX_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: StoredGameEntry = {
      transactionHash: txHash,
      gameType: gameData.gameType,
      playerAddress: gameData.playerAddress,
      betAmount: gameData.betAmount,
      result: gameData.result,
      payout: gameData.payout,
      timestamp: Date.now(),
      status: 'pending', // Initially pending until confirmed
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
    
    // Update index
    updateStorageIndex(key);
    
    console.log('📝 Stored game transaction:', {
      key,
      txHash,
      gameType: gameData.gameType,
    });
  } catch (error) {
    console.warn('Failed to store game transaction:', error);
  }
}

/**
 * Update transaction status (pending -> confirmed/failed)
 */
export function updateTransactionStatus(
  txHash: string,
  status: 'confirmed' | 'failed',
  gameId?: number
): void {
  try {
    const entry = findStoredTransaction(txHash);
    if (entry) {
      const updatedEntry: StoredGameEntry = {
        ...entry.data,
        status,
        gameId,
      };
      
      localStorage.setItem(entry.key, JSON.stringify(updatedEntry));
      
      console.log('🔄 Updated transaction status:', {
        txHash,
        status,
        gameId,
      });
    }
  } catch (error) {
    console.warn('Failed to update transaction status:', error);
  }
}

/**
 * Get transaction hash for a specific game ID
 */
export function getTransactionHashByGameId(gameId: number): string | null {
  try {
    const index = getStorageIndex();
    
    for (const key of index) {
      const data = getStoredEntry(key);
      if (data && data.gameId === gameId) {
        return data.transactionHash;
      }
    }
  } catch (error) {
    console.warn('Failed to get transaction hash by game ID:', error);
  }
  
  return null;
}

/**
 * Get all stored game transactions
 */
export function getAllStoredTransactions(): StoredGameEntry[] {
  try {
    const index = getStorageIndex();
    const transactions: StoredGameEntry[] = [];
    
    for (const key of index) {
      const data = getStoredEntry(key);
      if (data) {
        transactions.push(data);
      }
    }
    
    // Sort by timestamp (newest first)
    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.warn('Failed to get all stored transactions:', error);
    return [];
  }
}

/**
 * Get pending transactions (not yet confirmed)
 */
export function getPendingTransactions(): StoredGameEntry[] {
  return getAllStoredTransactions().filter(tx => tx.status === 'pending');
}

/**
 * Clean up old entries to prevent storage bloat
 */
export function cleanupOldEntries(): void {
  try {
    const index = getStorageIndex();
    
    if (index.length <= MAX_STORED_ENTRIES) {
      return;
    }
    
    // Get all entries with timestamps
    const entriesWithTime = index
      .map(key => {
        const data = getStoredEntry(key);
        return data ? { key, timestamp: data.timestamp } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.timestamp - b!.timestamp); // Sort oldest first
    
    // Remove oldest entries
    const toRemove = entriesWithTime.slice(0, entriesWithTime.length - MAX_STORED_ENTRIES);
    
    for (const entry of toRemove) {
      if (entry) {
        localStorage.removeItem(entry.key);
      }
    }
    
    // Update index
    const newIndex = index.filter(key => 
      !toRemove.some(removed => removed?.key === key)
    );
    
    localStorage.setItem(STORAGE_KEYS.GAME_TX_INDEX, JSON.stringify(newIndex));
    
    console.log(`🧹 Cleaned up ${toRemove.length} old game transaction entries`);
  } catch (error) {
    console.warn('Failed to cleanup old entries:', error);
  }
}

/**
 * Find stored transaction by hash
 */
function findStoredTransaction(txHash: string): { key: string; data: StoredGameEntry } | null {
  try {
    const index = getStorageIndex();
    
    for (const key of index) {
      const data = getStoredEntry(key);
      if (data && data.transactionHash === txHash) {
        return { key, data };
      }
    }
  } catch (error) {
    console.warn('Failed to find stored transaction:', error);
  }
  
  return null;
}

/**
 * Get storage index
 */
function getStorageIndex(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.GAME_TX_INDEX) || '[]');
  } catch (error) {
    console.warn('Failed to get storage index:', error);
    return [];
  }
}

/**
 * Update storage index with new key
 */
function updateStorageIndex(newKey: string): void {
  try {
    const index = getStorageIndex();
    index.push(newKey);
    
    // Keep only recent entries
    if (index.length > MAX_STORED_ENTRIES) {
      const oldKey = index.shift();
      if (oldKey) {
        localStorage.removeItem(oldKey);
      }
    }
    
    localStorage.setItem(STORAGE_KEYS.GAME_TX_INDEX, JSON.stringify(index));
  } catch (error) {
    console.warn('Failed to update storage index:', error);
  }
}

/**
 * Get stored entry by key
 */
function getStoredEntry(key: string): StoredGameEntry | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn('Failed to get stored entry:', error);
    return null;
  }
}

export default {
  storeGameTransaction,
  updateTransactionStatus,
  getTransactionHashByGameId,
  getAllStoredTransactions,
  getPendingTransactions,
  cleanupOldEntries,
};