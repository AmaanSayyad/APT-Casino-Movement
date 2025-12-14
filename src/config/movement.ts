/**
 * Movement Bardock Testnet Configuration
 * 
 * This file contains network constants and configuration for Movement Bardock testnet.
 * Reference: https://docs.movementnetwork.xyz/devs/networkEndpoints
 */

export interface MovementConfig {
  networkName: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  explorerTxUrl: string;
  faucetUrl: string;
  faucetEndpoint: string;
  indexerUrl: string;
}

/**
 * Movement Bardock Testnet Configuration
 * Chain ID: 250
 */
export const MOVEMENT_BARDOCK: MovementConfig = {
  networkName: "Movement Bardock Testnet",
  chainId: 250,
  rpcUrl: "https://testnet.movementnetwork.xyz/v1",
  explorerUrl: "https://explorer.movementnetwork.xyz/?network=bardock+testnet",
  explorerTxUrl: "https://explorer.movementnetwork.xyz/txn",
  faucetUrl: "https://faucet.movementnetwork.xyz",
  faucetEndpoint: "https://faucet.testnet.movementnetwork.xyz",
  indexerUrl: "https://hasura.testnet.movementnetwork.xyz/v1/graphql"
};

/**
 * Movement Mainnet Configuration (for future use)
 * Chain ID: 126
 */
export const MOVEMENT_MAINNET: MovementConfig = {
  networkName: "Movement Mainnet",
  chainId: 126,
  rpcUrl: "https://full.mainnet.movementinfra.xyz/v1",
  explorerUrl: "https://explorer.movementnetwork.xyz/?network=mainnet",
  explorerTxUrl: "https://explorer.movementnetwork.xyz/txn",
  faucetUrl: "", // No faucet for mainnet
  faucetEndpoint: "",
  indexerUrl: "https://indexer.mainnet.movementnetwork.xyz/v1/graphql"
};

/**
 * MOVE Token Configuration
 * MOVE uses 8 decimals (same as APT)
 */
export const MOVE_TOKEN = {
  name: "MOVE",
  symbol: "MOVE",
  decimals: 8,
  type: "0x1::aptos_coin::AptosCoin" // Movement uses same coin type as Aptos
};

/**
 * Environment-based configuration for Treasury and Contract addresses
 */
export const MOVEMENT_ENV_CONFIG = {
  treasuryAddress: process.env.NEXT_PUBLIC_MOVEMENT_TREASURY_ADDRESS || "",
  gameLoggerAddress: process.env.NEXT_PUBLIC_MOVEMENT_GAME_LOGGER_ADDRESS || "",
  userBalanceAddress: process.env.NEXT_PUBLIC_MOVEMENT_USER_BALANCE_ADDRESS || ""
};

/**
 * Default Movement network (Bardock Testnet for development)
 */
export const DEFAULT_MOVEMENT_NETWORK = MOVEMENT_BARDOCK;

/**
 * Get explorer URL for a transaction hash
 * @param txHash - Transaction hash
 * @param network - Movement network config (defaults to Bardock)
 * @returns Full explorer URL for the transaction
 */
export function getMovementExplorerTxUrl(
  txHash: string,
  network: MovementConfig = MOVEMENT_BARDOCK
): string {
  return `${network.explorerTxUrl}/${txHash}?network=bardock+testnet`;
}

/**
 * Get explorer URL for an account address
 * @param address - Account address
 * @param network - Movement network config (defaults to Bardock)
 * @returns Full explorer URL for the account
 */
export function getMovementExplorerAccountUrl(
  address: string,
  network: MovementConfig = MOVEMENT_BARDOCK
): string {
  return `${network.explorerUrl.replace('?', `/account/${address}?`)}`;
}

export default {
  MOVEMENT_BARDOCK,
  MOVEMENT_MAINNET,
  MOVE_TOKEN,
  MOVEMENT_ENV_CONFIG,
  DEFAULT_MOVEMENT_NETWORK,
  getMovementExplorerTxUrl,
  getMovementExplorerAccountUrl
};
