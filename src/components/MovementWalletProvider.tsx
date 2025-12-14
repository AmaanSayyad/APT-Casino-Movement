"use client";

import React, { PropsWithChildren } from "react";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { MOVEMENT_BARDOCK } from "@/config/movement";

/**
 * Movement Wallet Provider
 * 
 * Uses Movement Wallet Adapter to connect to Movement Bardock testnet.
 * Movement uses Movement-compatible wallets (OKX, Razor, Nightly) with custom network config.
 */
export const MovementWalletProvider = ({ children }: PropsWithChildren) => {
  // No legacy wallet plugins needed - Movement wallets support AIP-62 standard
  const wallets = [];

  return (
    <AptosWalletAdapterProvider
      plugins={wallets}
      autoConnect={true}
      dappConfig={{
        // Use testnet as base network to avoid Movement Connect issues
        // Movement wallets will handle the actual network switching
        network: Network.TESTNET,
        aptosConnectDappId: undefined,
      }}
      onError={(error) => {
        // Suppress all wallet adapter errors in development
        // These are usually non-critical internal errors
        return; // Silently ignore all errors
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
};

export default MovementWalletProvider;