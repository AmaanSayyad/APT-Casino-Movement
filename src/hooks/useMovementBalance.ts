/**
 * Movement Balance Hook
 * 
 * Custom hook for managing user balance operations on Movement Bardock testnet.
 * Handles deposits, withdrawals, and balance fetching from user_balance contract.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Aptos, AptosConfig, Network, Account } from '@aptos-labs/ts-sdk';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { MOVEMENT_BARDOCK, MOVEMENT_ENV_CONFIG } from '@/config/movement';
import { formatBalance, moveToOctas, octasToMove } from '@/lib/movement';
import { validateDeposit as validateDepositAmount, validateWithdrawal as validateWithdrawalAmount, type ValidationResult } from '@/lib/movementValidation';

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface UseMovementBalance {
  userBalance: bigint;
  formattedBalance: string;
  treasuryAddress: string;
  walletBalance: bigint;
  formattedWalletBalance: string;
  deposit: (amount: bigint) => Promise<TransactionResult>;
  withdraw: (amount: bigint) => Promise<TransactionResult>;
  refreshBalance: () => Promise<void>;
  refreshWalletBalance: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  validateDeposit: (amount: bigint) => ValidationResult;
  validateWithdrawal: (amount: bigint) => ValidationResult;
}

/**
 * Hook for managing Movement balance operations
 * 
 * @returns UseMovementBalance interface with balance state and functions
 */
export function useMovementBalance(): UseMovementBalance {
  const { account, signAndSubmitTransaction } = useWallet();
  
  // State
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [walletBalance, setWalletBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aptos client configuration for Movement Bardock
  const aptosConfig = useMemo(() => new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_BARDOCK.rpcUrl,
    faucet: MOVEMENT_BARDOCK.faucetEndpoint,
  }), []);

  const aptos = useMemo(() => new Aptos(aptosConfig), [aptosConfig]);

  // Treasury address from environment
  const treasuryAddress = MOVEMENT_ENV_CONFIG.treasuryAddress;
  const userBalanceModuleAddress = MOVEMENT_ENV_CONFIG.userBalanceAddress || treasuryAddress;

  // Formatted balances
  const formattedBalance = useMemo(() => formatBalance(userBalance, 4), [userBalance]);
  const formattedWalletBalance = useMemo(() => formatBalance(walletBalance, 4), [walletBalance]);

  /**
   * Fetch user balance from user_balance contract
   */
  const fetchUserBalance = useCallback(async (): Promise<bigint> => {
    if (!account?.address || !userBalanceModuleAddress) {
      return BigInt(0);
    }

    try {
      // Call the get_balance view function
      const result = await aptos.view({
        payload: {
          function: `${userBalanceModuleAddress}::user_balance::get_balance`,
          functionArguments: [String(account.address)]
        }
      });

      // Result should be an array with the balance as first element
      const balance = result[0] as string | number;
      return BigInt(balance);
    } catch (error) {
      console.error('Failed to fetch user balance:', error);
      // If user balance doesn't exist yet, return 0
      return BigInt(0);
    }
  }, [account?.address, userBalanceModuleAddress, aptos]);

  /**
   * Fetch wallet MOVE balance
   */
  const fetchWalletBalance = useCallback(async (): Promise<bigint> => {
    if (!account?.address) {
      return BigInt(0);
    }

    try {
      // Get APT coin balance (MOVE uses same coin type)
      const resource = await aptos.getAccountResource({
        accountAddress: String(account.address),
        resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      });

      const coinData = resource.coin as { value: string };
      return BigInt(coinData.value);
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
      return BigInt(0);
    }
  }, [account?.address, aptos]);

  /**
   * Refresh user balance from contract
   */
  const refreshBalance = useCallback(async () => {
    if (!account?.address) {
      setUserBalance(BigInt(0));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const balance = await fetchUserBalance();
      setUserBalance(balance);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      setError('Failed to fetch balance');
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, fetchUserBalance]);

  /**
   * Refresh wallet balance
   */
  const refreshWalletBalance = useCallback(async () => {
    if (!account?.address) {
      setWalletBalance(BigInt(0));
      return;
    }

    try {
      const balance = await fetchWalletBalance();
      setWalletBalance(balance);
    } catch (error) {
      console.error('Failed to refresh wallet balance:', error);
    }
  }, [account?.address, fetchWalletBalance]);

  /**
   * Validate deposit amount
   */
  const validateDeposit = useCallback((amount: bigint): ValidationResult => {
    return validateDepositAmount(amount, walletBalance);
  }, [walletBalance]);

  /**
   * Validate withdrawal amount
   */
  const validateWithdrawal = useCallback((amount: bigint): ValidationResult => {
    return validateWithdrawalAmount(amount, userBalance);
  }, [userBalance]);

  /**
   * Deposit MOVE tokens to treasury
   */
  const deposit = useCallback(async (amount: bigint): Promise<TransactionResult> => {
    if (!account?.address || !signAndSubmitTransaction || !treasuryAddress) {
      return { success: false, error: 'Wallet not connected or treasury not configured' };
    }

    // Validate deposit
    const validation = validateDeposit(amount);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create deposit transaction payload
      const transaction = {
        type: "entry_function_payload",
        function: `${userBalanceModuleAddress}::user_balance::deposit`,
        functionArguments: [amount.toString()]
      };

      // Sign and submit transaction
      const response = await signAndSubmitTransaction(transaction);
      
      // Wait for transaction confirmation
      const txResult = await aptos.waitForTransaction({
        transactionHash: response.hash
      });

      if (txResult.success) {
        // Refresh balances after successful deposit
        await Promise.all([refreshBalance(), refreshWalletBalance()]);
        
        return {
          success: true,
          transactionHash: response.hash
        };
      } else {
        return {
          success: false,
          error: 'Transaction failed'
        };
      }
    } catch (error) {
      console.error('Deposit failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Deposit failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, signAndSubmitTransaction, treasuryAddress, userBalanceModuleAddress, validateDeposit, aptos, refreshBalance, refreshWalletBalance]);

  /**
   * Withdraw MOVE tokens from treasury
   */
  const withdraw = useCallback(async (amount: bigint): Promise<TransactionResult> => {
    if (!account?.address || !signAndSubmitTransaction || !treasuryAddress) {
      return { success: false, error: 'Wallet not connected or treasury not configured' };
    }

    // Validate withdrawal
    const validation = validateWithdrawal(amount);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create withdrawal transaction payload
      const transaction = {
        type: "entry_function_payload",
        function: `${userBalanceModuleAddress}::user_balance::withdraw`,
        functionArguments: [amount.toString()]
      };

      // Sign and submit transaction
      const response = await signAndSubmitTransaction(transaction);
      
      // Wait for transaction confirmation
      const txResult = await aptos.waitForTransaction({
        transactionHash: response.hash
      });

      if (txResult.success) {
        // Refresh balances after successful withdrawal
        await Promise.all([refreshBalance(), refreshWalletBalance()]);
        
        return {
          success: true,
          transactionHash: response.hash
        };
      } else {
        return {
          success: false,
          error: 'Transaction failed'
        };
      }
    } catch (error) {
      console.error('Withdrawal failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Withdrawal failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, signAndSubmitTransaction, treasuryAddress, userBalanceModuleAddress, validateWithdrawal, aptos, refreshBalance, refreshWalletBalance]);

  // Auto-refresh balances when account changes
  useEffect(() => {
    if (account?.address) {
      refreshBalance();
      refreshWalletBalance();
    } else {
      setUserBalance(BigInt(0));
      setWalletBalance(BigInt(0));
    }
  }, [account?.address, refreshBalance, refreshWalletBalance]);

  // Polling for balance updates (every 30 seconds)
  useEffect(() => {
    if (!account?.address) return;

    const interval = setInterval(() => {
      refreshBalance();
      refreshWalletBalance();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [account?.address, refreshBalance, refreshWalletBalance]);

  return {
    userBalance,
    formattedBalance,
    treasuryAddress,
    walletBalance,
    formattedWalletBalance,
    deposit,
    withdraw,
    refreshBalance,
    refreshWalletBalance,
    isLoading,
    error,
    validateDeposit,
    validateWithdrawal
  };
}

export default useMovementBalance;