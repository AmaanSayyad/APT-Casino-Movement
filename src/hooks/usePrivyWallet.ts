/**
 * Privy Wallet Hook
 * 
 * Hook for managing Privy embedded wallet connections.
 * Works alongside existing Movement wallet adapters.
 */

import { useMemo, useCallback, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { MOVEMENT_BARDOCK, type MovementConfig } from '@/config/movement';

export interface UsePrivyWallet {
  // Connection state
  isConnected: boolean;
  isAuthenticated: boolean;
  isReady: boolean;
  
  // Address info
  address: string | null;
  shortAddress: string | null;
  
  // User info
  user: any | null;
  email: string | null;
  
  // Wallet info
  embeddedWallet: any | null;
  allWallets: any[];
  
  // Network
  network: MovementConfig;
  
  // Actions
  login: () => Promise<void>;
  logout: () => Promise<void>;
  signMessage: (message: string) => Promise<string | undefined>;
  exportWallet: () => Promise<void>;
  
  // Loading states
  isLoading: boolean;
}

/**
 * Hook for managing Privy embedded wallet
 */
export function usePrivyWallet(): UsePrivyWallet {
  const { 
    ready,
    authenticated,
    user,
    login: privyLogin,
    logout: privyLogout,
    signMessage: privySignMessage,
    exportWallet: privyExportWallet,
    createWallet,
  } = usePrivy();
  
  const { wallets } = useWallets();

  // Auto-create embedded wallet if authenticated but no embedded wallet exists
  useEffect(() => {
    const hasEmbeddedWallet = wallets.some(wallet => wallet.walletClientType === 'privy');
    if (authenticated && ready && !hasEmbeddedWallet) {
      console.log('🔧 Creating embedded wallet for authenticated user...');
      createWallet().catch(error => {
        console.error('❌ Failed to create embedded wallet:', error);
      });
    }
  }, [authenticated, ready, wallets, createWallet]);

  // Find the embedded (Privy) wallet
  const embeddedWallet = useMemo(() => {
    return wallets.find(wallet => wallet.walletClientType === 'privy') || null;
  }, [wallets]);

  // Get address from embedded wallet
  const address = embeddedWallet?.address || null;

  // Create shortened address
  const shortAddress = useMemo(() => {
    if (!address || typeof address !== 'string') return null;
    if (address.length < 10) return address;
    
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
    if (cleanAddress.length < 8) return address;
    
    const first4 = cleanAddress.slice(0, 4);
    const last4 = cleanAddress.slice(-4);
    return `0x${first4}...${last4}`;
  }, [address]);

  // Get user email if available
  const email = useMemo(() => {
    if (!user) return null;
    return user.email?.address || null;
  }, [user]);

  // Login handler
  const login = useCallback(async () => {
    try {
      // Check if already authenticated to avoid "already logged in" error
      if (authenticated) {
        console.log('✅ User already authenticated with Privy');
        return;
      }
      await privyLogin();
    } catch (error) {
      console.error('❌ Privy login failed:', error);
      throw error;
    }
  }, [privyLogin, authenticated]);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      if (!authenticated) {
        console.log('✅ User already logged out from Privy');
        return;
      }
      await privyLogout();
    } catch (error) {
      console.error('❌ Privy logout failed:', error);
      throw error;
    }
  }, [privyLogout, authenticated]);

  // Sign message handler
  const signMessage = useCallback(async (message: string) => {
    try {
      const signature = await privySignMessage(message);
      return signature;
    } catch (error) {
      console.error('❌ Privy sign message failed:', error);
      throw error;
    }
  }, [privySignMessage]);

  // Export wallet handler
  const exportWallet = useCallback(async () => {
    try {
      await privyExportWallet();
    } catch (error) {
      console.error('❌ Privy export wallet failed:', error);
      throw error;
    }
  }, [privyExportWallet]);

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Privy Debug:', {
      authenticated,
      ready,
      embeddedWallet: !!embeddedWallet,
      walletsCount: wallets.length,
      address,
      isConnected: authenticated && !!embeddedWallet
    });
  }

  return {
    isConnected: authenticated && !!embeddedWallet,
    isAuthenticated: authenticated,
    isReady: ready,
    address,
    shortAddress,
    user,
    email,
    embeddedWallet,
    allWallets: wallets,
    network: MOVEMENT_BARDOCK,
    login,
    logout,
    signMessage,
    exportWallet,
    isLoading: !ready,
  };
}

export default usePrivyWallet;
