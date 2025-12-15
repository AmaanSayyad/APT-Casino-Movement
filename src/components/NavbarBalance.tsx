/**
 * NavbarBalance Component
 * 
 * Displays user balance in the navbar with deposit/withdraw functionality.
 * Shows formatted balance with 4 decimal precision and treasury address on hover.
 */

import React, { useState } from 'react';
import { formatBalance } from '@/lib/movement';

export interface NavbarBalanceProps {
  balance: string; // User balance from Redux store (house balance)
  isConnected: boolean;
  isLoading: boolean;
  onDeposit: () => void;
}

/**
 * NavbarBalance component for displaying user house balance
 */
export function NavbarBalance({
  balance,
  isConnected,
  isLoading,
  onDeposit
}: NavbarBalanceProps) {
  // Balance is already formatted string from Redux store
  const formattedBalance = balance || "0";

  if (!isConnected) {
    // When wallet is not connected, don't show extra text in the navbar.
    // The dedicated wallet buttons handle connection UX.
    return null;
  }

  return (
    <div className="flex items-center space-x-3">
      {/* House Balance Display */}
      <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/10 rounded-lg border border-purple-800/30 px-3 py-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-300">Balance:</span>
          <span className="text-sm text-purple-300 font-medium">
            {isLoading ? 'Loading...' : `${formattedBalance} MOVE`}
          </span>
        </div>
      </div>

      {/* Deposit Button */}
      <button
        onClick={onDeposit}
        disabled={isLoading}
        className="text-xs bg-green-600/30 hover:bg-green-500/30 disabled:bg-gray-600/30 disabled:cursor-not-allowed text-green-300 disabled:text-gray-400 px-3 py-2 rounded transition-colors"
        title="Deposit MOVE tokens to your house balance"
      >
        Deposit
      </button>
    </div>
  );
}

export default NavbarBalance;