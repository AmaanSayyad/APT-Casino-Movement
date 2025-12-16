"use client";

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useMovementWallet } from '@/hooks/useMovementWallet';

/**
 * Privy Wallet Button Component
 * 
 * Provides login/logout functionality for Privy embedded wallets.
 * Shows user info and wallet address when connected.
 * Hidden when Movement wallet is connected.
 */
export default function PrivyWalletButton() {
  const {
    isConnected,
    isAuthenticated,
    isReady,
    shortAddress,
    email,
    login,
    logout,
    exportWallet,
    isLoading,
    embeddedWallet,
  } = usePrivyWallet();
  
  const { createWallet } = usePrivy();
  
  const movementWallet = useMovementWallet();

  const [showMenu, setShowMenu] = useState(false);

  // Hide if Movement wallet is connected
  if (movementWallet.isConnected) {
    return null;
  }

  // Not ready yet
  if (!isReady) {
    return (
      <button
        disabled
        className="bg-gradient-to-r from-purple-500/50 to-pink-500/50 text-white/50 px-4 py-2 rounded-lg font-medium cursor-not-allowed flex items-center gap-2"
      >
        <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></div>
        Loading...
      </button>
    );
  }

  // Authenticated but no embedded wallet - show create wallet button
  if (isAuthenticated && !isConnected && !embeddedWallet) {
    return (
      <button
        onClick={async () => {
          try {
            console.log('🔧 Creating embedded wallet...');
            await createWallet();
          } catch (error) {
            console.error('Failed to create wallet:', error);
          }
        }}
        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Create Wallet
      </button>
    );
  }

  // Connected state
  if (isAuthenticated && isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">{shortAddress}</span>
            {email && (
              <span className="text-xs text-purple-300/70">{email}</span>
            )}
            <span className="text-xs text-orange-300/70">Switch to Movement Testnet</span>
          </div>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute top-full mt-2 right-0 bg-[#1A0015]/95 backdrop-blur-md border border-purple-500/30 rounded-lg shadow-xl z-50 min-w-48 overflow-hidden">
            <div className="p-3 border-b border-purple-500/20">
              <div className="text-xs text-gray-400">Privy Wallet</div>
              <div className="text-sm text-white font-mono mt-1">{shortAddress}</div>
            </div>
            
            <div className="p-2">
              <button
                onClick={() => {
                  // Guide user to switch network manually
                  alert('To use MOVE tokens:\n\n1. Open your wallet settings\n2. Add Movement Testnet:\n   - Chain ID: 250\n   - RPC: https://testnet.movementnetwork.xyz/v1\n3. Switch to Movement Testnet');
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-orange-400 hover:bg-orange-500/20 rounded-md transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Switch to Movement Testnet
              </button>
              
              <button
                onClick={() => {
                  exportWallet();
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-purple-500/20 rounded-md transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Export Private Key
              </button>
              
              <button
                onClick={async () => {
                  setShowMenu(false);
                  try {
                    await logout();
                  } catch (error) {
                    console.error('Disconnect error:', error);
                  }
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-md transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not connected - show login button
  return (
    <button
      onClick={async () => {
        try {
          await login();
        } catch (error) {
          console.error('Login error:', error);
        }
      }}
      disabled={isLoading}
      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
    >
      {isLoading ? (
        <>
          <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></div>
          Connecting...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Quick Login
        </>
      )}
    </button>
  );
}
