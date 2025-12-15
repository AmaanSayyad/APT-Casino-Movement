/**
 * Unified Wallet Hook
 * 
 * Combines Privy and Movement wallet states into a single interface.
 * Only one wallet type can be active at a time.
 */

import { useMemo } from 'react';
import { useMovementWallet } from './useMovementWallet';
import { usePrivyWallet } from './usePrivyWallet';

export type WalletType = 'privy' | 'movement' | null;

export interface UseUnifiedWallet {
  // Which wallet is connected
  activeWallet: WalletType;
  
  // Is any wallet connected
  isConnected: boolean;
  
  // Current address (from whichever wallet is connected)
  address: string | null;
  shortAddress: string | null;
  
  // Individual wallet states for conditional rendering
  isPrivyConnected: boolean;
  isMovementConnected: boolean;
  
  // Loading states
  isPrivyLoading: boolean;
  isMovementLoading: boolean;
}

export function useUnifiedWallet(): UseUnifiedWallet {
  const privyWallet = usePrivyWallet();
  const movementWallet = useMovementWallet();

  const activeWallet = useMemo((): WalletType => {
    // Movement wallet takes priority if connected
    if (movementWallet.isConnected) return 'movement';
    // Then check Privy
    if (privyWallet.isConnected) return 'privy';
    return null;
  }, [movementWallet.isConnected, privyWallet.isConnected]);

  const isConnected = activeWallet !== null;

  const address = useMemo(() => {
    if (activeWallet === 'movement') return movementWallet.address;
    if (activeWallet === 'privy') return privyWallet.address;
    return null;
  }, [activeWallet, movementWallet.address, privyWallet.address]);

  const shortAddress = useMemo(() => {
    if (activeWallet === 'movement') return movementWallet.shortAddress;
    if (activeWallet === 'privy') return privyWallet.shortAddress;
    return null;
  }, [activeWallet, movementWallet.shortAddress, privyWallet.shortAddress]);

  return {
    activeWallet,
    isConnected,
    address,
    shortAddress,
    isPrivyConnected: privyWallet.isConnected,
    isMovementConnected: movementWallet.isConnected,
    isPrivyLoading: privyWallet.isLoading,
    isMovementLoading: movementWallet.isLoading,
  };
}

export default useUnifiedWallet;
