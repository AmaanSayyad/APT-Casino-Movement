"use client";

import React, { PropsWithChildren } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { MOVEMENT_BARDOCK } from "@/config/movement";

/**
 * Privy Wallet Provider for Movement Bardock Testnet
 * 
 * Provides embedded wallet functionality alongside existing wallet adapters.
 * Users can login with email/social and get an embedded wallet automatically.
 */
export const PrivyWalletProvider = ({ children }: PropsWithChildren) => {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // If no Privy App ID configured, just render children without Privy
  if (!appId) {
    console.warn("⚠️ NEXT_PUBLIC_PRIVY_APP_ID not configured. Privy wallet disabled.");
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Embedded wallet config - create wallet on login
        embeddedWallets: {
          createOnLogin: "all-users",
        },
        // Appearance
        appearance: {
          theme: "dark",
          accentColor: "#8B5CF6", // Purple to match casino theme
          logo: "/logo.png",
        },
        // Login methods
        loginMethods: ["email", "google", "twitter", "discord", "wallet"],
        // Custom chain for Movement Bardock Testnet
        defaultChain: {
          id: MOVEMENT_BARDOCK.chainId,
          name: MOVEMENT_BARDOCK.networkName,
          network: "movement-bardock",
          nativeCurrency: {
            name: "MOVE",
            symbol: "MOVE",
            decimals: 8,
          },
          rpcUrls: {
            default: {
              http: [MOVEMENT_BARDOCK.rpcUrl],
            },
            public: {
              http: [MOVEMENT_BARDOCK.rpcUrl],
            },
          },
          blockExplorers: {
            default: {
              name: "Movement Explorer",
              url: MOVEMENT_BARDOCK.explorerUrl,
            },
          },
        },
        supportedChains: [
          {
            id: MOVEMENT_BARDOCK.chainId,
            name: MOVEMENT_BARDOCK.networkName,
            network: "movement-bardock",
            nativeCurrency: {
              name: "MOVE",
              symbol: "MOVE",
              decimals: 8,
            },
            rpcUrls: {
              default: {
                http: [MOVEMENT_BARDOCK.rpcUrl],
              },
              public: {
                http: [MOVEMENT_BARDOCK.rpcUrl],
              },
            },
            blockExplorers: {
              default: {
                name: "Movement Explorer",
                url: MOVEMENT_BARDOCK.explorerUrl,
              },
            },
          },
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
};

export default PrivyWalletProvider;
