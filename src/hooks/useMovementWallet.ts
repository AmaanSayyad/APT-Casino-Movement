/**
 * Movement Wallet Hook
 * 
 * Custom hook for managing wallet connections to Movement Bardock testnet.
 * Uses @aptos-labs/wallet-adapter-react for wallet integration.
 */

import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useCallback, useMemo } from 'react';
import { MOVEMENT_BARDOCK, type MovementConfig } from '@/config/movement';
import { Network } from '@aptos-labs/ts-sdk';

export interface UseMovementWallet {
  isConnected: boolean;
  address: string | null;
  shortAddress: string | null;
  network: MovementConfig;
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  isCorrectNetwork: boolean;
  isLoading: boolean;
  wallet: any;
  error: string | null;
}

/**
 * Hook for managing Movement wallet connections
 * 
 * @returns UseMovementWallet interface with wallet state and functions
 */
export function useMovementWallet(): UseMovementWallet {
  const {
    connected,
    account,
    wallet,
    connect: walletConnect,
    disconnect: walletDisconnect,
    changeNetwork,
    isLoading,
    network: currentNetwork
  } = useWallet();

  // Get current address as string
  const address = account?.address ? String(account.address) : null;

  // Create shortened address format: 0x{first4}...{last4}
  const shortAddress = useMemo(() => {
    if (!address) return null;
    if (address.length < 10) return address;
    
    // Remove 0x prefix for processing
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
    if (cleanAddress.length < 8) return address;
    
    const first4 = cleanAddress.slice(0, 4);
    const last4 = cleanAddress.slice(-4);
    return `0x${first4}...${last4}`;
  }, [address]);

  // Check if connected to correct network (Movement Bardock)
  const isCorrectNetwork = useMemo(() => {
    if (!connected || !currentNetwork) return false;
    
    // Check if current network matches Movement Bardock
    // Movement uses chainId 250 for Bardock testnet
    const chainIdStr = String(currentNetwork.chainId);
    const targetChainId = String(MOVEMENT_BARDOCK.chainId);
    
    return chainIdStr === targetChainId ||
           currentNetwork.name?.toLowerCase().includes('movement') ||
           currentNetwork.name?.toLowerCase().includes('bardock');
  }, [connected, currentNetwork]);

  // Connect to wallet with Movement network validation
  const connect = useCallback(async (walletName?: string) => {
    try {
      if (walletName) {
        await walletConnect(walletName);
      } else {
        // For now, we'll require a wallet name to be specified
        throw new Error('Please specify a wallet name to connect');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, [walletConnect]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    try {
      walletDisconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }, [walletDisconnect]);

  // Switch to Movement Bardock network
  const switchNetwork = useCallback(async () => {
    try {
      if (!changeNetwork) {
        throw new Error('Network switching not supported by current wallet');
      }

      // Try to switch to Movement Bardock testnet
      await changeNetwork(Network.CUSTOM);
    } catch (error) {
      console.error('Failed to switch network:', error);
      throw error;
    }
  }, [changeNetwork]);

  // Error handling
  const error = useMemo(() => {
    if (connected && !isCorrectNetwork) {
      return 'Please switch to Movement Bardock testnet';
    }
    return null;
  }, [connected, isCorrectNetwork]);

  return {
    isConnected: connected,
    address,
    shortAddress,
    network: MOVEMENT_BARDOCK,
    connect,
    disconnect,
    switchNetwork,
    isCorrectNetwork,
    isLoading,
    wallet,
    error
  };
}

export default useMovementWallet;