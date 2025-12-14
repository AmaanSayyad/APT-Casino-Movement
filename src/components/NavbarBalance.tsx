/**
 * NavbarBalance Component
 * 
 * Displays user balance in the navbar with deposit/withdraw functionality.
 * Shows formatted balance with 4 decimal precision and treasury address on hover.
 */

import React, { useState } from 'react';
import { formatBalance } from '@/lib/movement';

export interface NavbarBalanceProps {
  balance: bigint;
  treasuryAddress: string;
  isConnected: boolean;
  isLoading: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}

/**
 * NavbarBalance component for displaying user balance and actions
 */
export function NavbarBalance({
  balance,
  treasuryAddress,
  isConnected,
  isLoading,
  onDeposit,
  onWithdraw
}: NavbarBalanceProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Format balance with 4 decimal precision
  const formattedBalance = formatBalance(balance, 4);

  if (!isConnected) {
    return (
      <div className="flex items-center">
        <span className="text-white/70 text-sm">Connect Wallet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {/* Balance Display */}
      <div 
        className="relative bg-gradient-to-r from-purple-900/20 to-purple-800/10 rounded-lg border border-purple-800/30 px-3 py-2"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-300">Balance:</span>
          <span className="text-sm text-purple-300 font-medium">
            {isLoading ? 'Loading...' : `${formattedBalance} MOVE`}
          </span>
        </div>

        {/* Treasury Address Tooltip */}
        {showTooltip && treasuryAddress && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-gray-700 whitespace-nowrap">
              <div className="text-gray-400 mb-1">Treasury Address:</div>
              <div className="font-mono">{treasuryAddress}</div>
              {/* Tooltip arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onDeposit}
          disabled={isLoading}
          className="text-xs bg-green-600/30 hover:bg-green-500/30 disabled:bg-gray-600/30 disabled:cursor-not-allowed text-green-300 disabled:text-gray-400 px-2 py-1 rounded transition-colors"
          title="Deposit MOVE tokens"
        >
          Deposit
        </button>
        <button
          onClick={onWithdraw}
          disabled={isLoading || balance === BigInt(0)}
          className="text-xs bg-blue-600/30 hover:bg-blue-500/30 disabled:bg-gray-600/30 disabled:cursor-not-allowed text-blue-300 disabled:text-gray-400 px-2 py-1 rounded transition-colors"
          title="Withdraw MOVE tokens"
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}

export default NavbarBalance;