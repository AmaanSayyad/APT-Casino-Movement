/**
 * Movement Wallet Hook
 * 
 * Hook for managing wallet connections to Movement Bardock testnet.
 * Uses Movement Wallet Adapter for Movement-compatible wallets (OKX, Razor, Nightly).
 */

import { useMemo, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { MOVEMENT_BARDOCK, type MovementConfig } from '@/config/movement';

export interface UseMovementWallet {
  isConnected: boolean;
  address: string | null;
  shortAddress: string | null;
  network: MovementConfig;
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  isCorrectNetwork: boolean;
  isLoading: boolean;
  error: string | null;
  walletName: string | null;
  availableWallets: string[];
}

/**
 * Hook for managing Movement wallet connections using Movement Wallet Adapter
 * 
 * @returns UseMovementWallet interface with wallet state and functions
 */
export function useMovementWallet(): UseMovementWallet {
  const { 
    connected, 
    account, 
    connect: aptosConnect, 
    disconnect: aptosDisconnect,
    wallet,
    wallets,
    isLoading
  } = useWallet();

  // Extract address from account and ensure it's a string
  const address = account?.address ? String(account.address) : null;

  // Create shortened address format: 0x{first4}...{last4}
  const shortAddress = useMemo(() => {
    if (!address || typeof address !== 'string') return null;
    if (address.length < 10) return address;
    
    // Remove 0x prefix for processing
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
    if (cleanAddress.length < 8) return address;
    
    const first4 = cleanAddress.slice(0, 4);
    const last4 = cleanAddress.slice(-4);
    return `0x${first4}...${last4}`;
  }, [address]);

  // For Movement, assume correct network if connected (wallet should handle network switching)
  const isCorrectNetwork = useMemo(() => {
    return connected; // Movement wallets should connect to correct network
  }, [connected]);

  // Get available wallet names (deduplicated)
  const availableWallets = useMemo(() => {
    if (!wallets) return [];
    
    // Create a Set to ensure unique wallet names
    const uniqueNames = new Set<string>();
    wallets.forEach(wallet => {
      if (wallet.name) {
        uniqueNames.add(wallet.name);
      }
    });
    
    return Array.from(uniqueNames);
  }, [wallets]);

  // Debug logging (after all variables are defined)
  useEffect(() => {
    console.log('🔍 Movement Wallet State Changed:', {
      connected,
      address,
      addressType: typeof address,
      shortAddress,
      walletName: wallet?.name,
      availableWallets: availableWallets.length,
      isLoading,
      account: account ? 'exists' : 'null'
    });
  }, [connected, address, shortAddress, wallet?.name, availableWallets.length, isLoading, account]);

  // Current wallet name
  const walletName = wallet?.name || null;

  // Connect to wallet - if no walletName provided, use first available
  const connect = async (walletName?: string) => {
    try {
      // If already connected, don't try to connect again
      if (connected && address) {
        console.log('✅ Wallet already connected:', { walletName: wallet?.name, address });
        return;
      }

      if (!wallets || wallets.length === 0) {
        throw new Error('No Movement-compatible wallets found. Please install OKX Wallet, Razor, or Nightly.');
      }

      // If no specific wallet requested, use first available
      const targetWalletName = walletName || wallets[0].name;
      console.log('🔗 Connecting to wallet:', targetWalletName);
      
      await aptosConnect(targetWalletName);
    } catch (error) {
      console.error('❌ Failed to connect Movement wallet:', error);
      
      // Handle "already connected" error gracefully
      if (error instanceof Error && error.message.includes('already connected')) {
        console.log('ℹ️ Wallet already connected, ignoring error');
        return;
      }
      
      throw error;
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    try {
      await aptosDisconnect();
    } catch (error) {
      console.error('Failed to disconnect Movement wallet:', error);
      throw error;
    }
  };

  return {
    isConnected: connected,
    address,
    shortAddress,
    network: MOVEMENT_BARDOCK,
    connect,
    disconnect,
    isCorrectNetwork,
    isLoading,
    error: null, // Movement wallet adapter handles errors internally
    walletName,
    availableWallets
  };
}

export default useMovementWallet;