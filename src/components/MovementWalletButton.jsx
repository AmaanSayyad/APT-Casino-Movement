"use client";
import React, { useState } from 'react';
import { useMovementWallet } from '@/hooks/useMovementWallet';

export default function MovementWalletButton() {
  const { 
    isConnected, 
    shortAddress, 
    connect, 
    disconnect, 
    isLoading, 
    error,
    walletName,
    availableWallets
  } = useMovementWallet();

  const [showWalletOptions, setShowWalletOptions] = useState(false);

  // Debug logging
  console.log('🔘 MovementWalletButton State:', {
    isConnected,
    shortAddress,
    walletName,
    availableWallets: availableWallets.length,
    isLoading
  });

  const handleConnect = async (selectedWallet) => {
    try {
      setShowWalletOptions(false);
      await connect(selectedWallet);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      
      // Don't show error for "already connected" case
      if (error.message && error.message.includes('already connected')) {
        console.log('Wallet already connected, ignoring error');
        return;
      }
      
      // For other errors, you might want to show a notification
      // notification.error(`Connection failed: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  if (isConnected && shortAddress) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-gradient-to-r from-green-900/20 to-green-800/10 rounded-lg border border-green-800/30 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-sm text-green-300 font-medium">
              {shortAddress}
            </span>
            {walletName && (
              <span className="text-xs text-green-400/70">
                {walletName}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs bg-red-600/30 hover:bg-red-500/30 text-red-300 px-2 py-1 rounded transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end relative">
      {availableWallets.length > 1 ? (
        <>
          <button
            onClick={() => setShowWalletOptions(!showWalletOptions)}
            disabled={isLoading}
            className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></div>
                Connecting...
              </>
            ) : (
              <>
                Connect Wallet
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
          
          {showWalletOptions && !isLoading && (
            <div className="absolute top-full mt-2 right-0 bg-[#1A0015]/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl z-50 min-w-48">
              <div className="p-2">
                <div className="text-xs text-gray-400 px-2 py-1 mb-1">Choose Wallet:</div>
                {availableWallets.map((wallet, index) => (
                  <button
                    key={`wallet-${wallet}-${index}`}
                    onClick={() => handleConnect(wallet)}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-purple-500/20 rounded-md transition-colors"
                  >
                    {wallet}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          onClick={() => handleConnect()}
          disabled={isLoading}
          className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></div>
              Connecting...
            </>
          ) : (
            'Connect Wallet'
          )}
        </button>
      )}
      
      {error && (
        <div className="text-xs text-red-400 mt-1 max-w-48 text-right">
          {error}
        </div>
      )}
      
      {!isConnected && !error && availableWallets.length === 0 && (
        <div className="text-xs text-red-400 mt-1 max-w-48 text-right">
          No Movement wallets found. Install OKX, Razor, or Nightly.
        </div>
      )}
      
      {!isConnected && !error && availableWallets.length > 0 && (
        <div className="text-xs text-gray-400 mt-1 max-w-48 text-right">
          {availableWallets.length} wallet{availableWallets.length > 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
}