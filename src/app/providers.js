"use client";

import * as React from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletStatusProvider } from '@/hooks/useWalletStatus';
import { NotificationProvider } from '@/components/NotificationSystem';
import { ThemeProvider } from 'next-themes';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { MOVEMENT_BARDOCK } from '@/config/movement';
import '@aptos-labs/wallet-adapter-ant-design/dist/index.css';


const queryClient = new QueryClient();

// Configure Aptos SDK for Movement Bardock testnet
const movementConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_BARDOCK.rpcUrl,
  faucet: MOVEMENT_BARDOCK.faucetEndpoint,
});

export default function Providers({ children }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Provider store={store}>
      <AptosWalletAdapterProvider
        plugins={[]}
        autoConnect={true}
        dappConfig={{
          network: Network.CUSTOM,
          aptosConfig: movementConfig
        }}
        onError={(error) => {
          try {
            const message =
              typeof error === 'string'
                ? error
                : error && typeof error === 'object' && 'message' in error
                ? error.message
                : JSON.stringify(error);
            console.error("Movement wallet error:", message || "Unknown error");
          } catch (e) {
            console.error("Movement wallet error: Unknown error");
          }
        }}
      >
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>
            <WalletStatusProvider>
              <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
                {children}
              </ThemeProvider>
            </WalletStatusProvider>
          </NotificationProvider>
        </QueryClientProvider>
      </AptosWalletAdapterProvider>
    </Provider>
  );
}
