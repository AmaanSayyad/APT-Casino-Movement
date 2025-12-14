/**
 * Movement Balance Hook
 * 
 * Custom hook for managing wallet balance on Movement Bardock testnet.
 * Uses direct wallet balance without user_balance contract.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { MOVEMENT_BARDOCK } from '@/config/movement';
import { formatBalance } from '@/lib/movement';

export interface UseMovementBalance {
  walletBalance: bigint;
  formattedWalletBalance: string;
  refreshWalletBalance: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing Movement wallet balance
 * 
 * @returns UseMovementBalance interface with wallet balance state and functions
 */
export function useMovementBalance(): UseMovementBalance {
  const { account, connected } = useWallet();
  
  // State
  const [walletBalance, setWalletBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Movement client configuration for Movement Bardock
  const aptosConfig = useMemo(() => new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_BARDOCK.rpcUrl,
    faucet: MOVEMENT_BARDOCK.faucetEndpoint,
    indexer: MOVEMENT_BARDOCK.indexerUrl,
  }), []);

  const movement = useMemo(() => new Aptos(aptosConfig), [aptosConfig]);

  // Formatted balance
  const formattedWalletBalance = useMemo(() => formatBalance(walletBalance, 4), [walletBalance]);



  /**
   * Fetch wallet MOVE balance
   * TODO: Implement proper Movement balance fetching
   */
  const fetchWalletBalance = useCallback(async (): Promise<bigint> => {
    if (!account?.address) {
      return BigInt(0);
    }

    try {
      console.log('🔍 Fetching MOVE balance for:', account.address);

      // Use Movement SDK method to get MOVE amount (Movement uses same structure)
      const balance = await movement.getAccountAPTAmount({
        accountAddress: account.address
      });

      console.log('💰 MOVE balance fetched:', balance);
      return BigInt(balance);
    } catch (error) {
      console.error('❌ Failed to fetch wallet balance:', error);
      
      // If account doesn't exist, return 0
      if (error instanceof Error && error.message.includes('not found')) {
        return BigInt(0);
      }
      
      return BigInt(0);
    }
  }, [account?.address, movement]);

  /**
   * Refresh wallet balance
   */
  const refreshWalletBalance = useCallback(async () => {
    if (!account?.address) {
      setWalletBalance(BigInt(0));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const balance = await fetchWalletBalance();
      setWalletBalance(balance);
    } catch (error) {
      console.error('❌ Failed to refresh wallet balance:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch balance');
      setWalletBalance(BigInt(0));
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, fetchWalletBalance]);

  // Auto-refresh balance when account changes
  useEffect(() => {
    if (account?.address && connected) {
      refreshWalletBalance();
    } else {
      setWalletBalance(BigInt(0));
      setError(null);
    }
  }, [account?.address, connected, refreshWalletBalance]);

  // Polling disabled for now
  // useEffect(() => {
  //   if (!address || !isConnected) return;
  //   const interval = setInterval(() => {
  //     refreshWalletBalance();
  //   }, 30000);
  //   return () => clearInterval(interval);
  // }, [address, isConnected, refreshWalletBalance]);

  return {
    walletBalance,
    formattedWalletBalance,
    refreshWalletBalance,
    isLoading,
    error
  };
}

export default useMovementBalance;