/**
 * Movement Transactions Hook
 * 
 * Hook for handling MOVE token transactions on Movement Bardock testnet.
 * Uses Movement Wallet Adapter for transaction signing and submission.
 */

import { useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { MOVEMENT_ENV_CONFIG } from '@/config/movement';

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export function useMovementTransactions() {
  const { account, connected, signAndSubmitTransaction } = useWallet();

  /**
   * Send MOVE tokens to treasury (deposit)
   */
  const depositToTreasury = useCallback(async (amount: number): Promise<TransactionResult> => {
    if (!connected || !account?.address) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (!MOVEMENT_ENV_CONFIG.treasuryAddress) {
      return { success: false, error: 'Treasury address not configured' };
    }

    try {
      // Convert amount to octas (MOVE uses 8 decimals like MOVE)
      const amountOctas = Math.floor(amount * 100000000);

      // Create MOVE transfer transaction using Movement coin structure
      const transaction = {
        data: {
          function: "0x1::coin::transfer" as const,
          typeArguments: ["0x1::aptos_coin::AptosCoin"], // Movement uses same coin type as Movement
          functionArguments: [MOVEMENT_ENV_CONFIG.treasuryAddress, amountOctas]
        }
      };

      console.log('💰 Submitting MOVE deposit transaction:', {
        from: account.address,
        to: MOVEMENT_ENV_CONFIG.treasuryAddress,
        amount: amount,
        amountOctas: amountOctas
      });

      // Submit transaction using Movement wallet adapter
      const result = await signAndSubmitTransaction(transaction);

      if (result?.hash) {
        return {
          success: true,
          transactionHash: result.hash
        };
      } else {
        return { success: false, error: 'Transaction failed - no hash returned' };
      }

    } catch (error) {
      console.error('❌ Deposit transaction failed:', error);
      
      let errorMessage = 'Transaction failed';
      if (error instanceof Error) {
        if (error.message.includes('User rejected') || error.message.includes('User denied')) {
          errorMessage = 'Transaction cancelled by user';
        } else if (error.message.toLowerCase().includes('insufficient')) {
          errorMessage = 'Insufficient MOVE balance';
        } else if (error.message.includes('Network not supported')) {
          errorMessage = 'Please switch to Movement Bardock testnet in your wallet';
        } else {
          errorMessage = error.message;
        }
      }

      return { success: false, error: errorMessage };
    }
  }, [connected, account, signAndSubmitTransaction]);

  /**
   * Request withdrawal from treasury (placeholder for backend integration)
   */
  const requestWithdrawal = useCallback(async (amount: number): Promise<TransactionResult> => {
    if (!connected || !account?.address) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      // In a real implementation, this would call your backend API
      // to process withdrawal from treasury to user's wallet
      
      console.log('📤 Withdrawal request:', { address: account.address, amount });
      
      // For now, just return success (backend integration needed)
      return {
        success: true,
        transactionHash: 'withdrawal_request_' + Date.now()
      };

    } catch (error) {
      console.error('❌ Withdrawal request failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Withdrawal request failed' 
      };
    }
  }, [connected, account]);

  return {
    depositToTreasury,
    requestWithdrawal
  };
}

export default useMovementTransactions;