/**
 * Movement Network Utilities
 * 
 * Utility functions for working with Movement network addresses, transactions, and formatting.
 */

/**
 * Shortens a Movement/Aptos address to display format
 * 
 * @param address - Full address string (with or without 0x prefix)
 * @returns Shortened address in format 0x{first4}...{last4}
 * 
 * @example
 * shortenAddress("0x1234567890abcdef1234567890abcdef12345678")
 * // Returns: "0x1234...5678"
 */
export function shortenAddress(address: string): string {
  if (!address) return '';
  
  // Ensure address starts with 0x
  const normalizedAddress = address.startsWith('0x') ? address : `0x${address}`;
  
  // If address is too short to shorten meaningfully, return as-is
  if (normalizedAddress.length <= 10) {
    return normalizedAddress;
  }
  
  // Extract the hex part (without 0x)
  const hexPart = normalizedAddress.slice(2);
  
  // If hex part is too short, return original
  if (hexPart.length < 8) {
    return normalizedAddress;
  }
  
  // Get first 4 and last 4 characters of hex part
  const first4 = hexPart.slice(0, 4);
  const last4 = hexPart.slice(-4);
  
  return `0x${first4}...${last4}`;
}

/**
 * Validates if a string is a valid Movement/Aptos address format
 * 
 * @param address - Address string to validate
 * @returns True if address format is valid
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  
  // Check if it's a valid hex string of appropriate length
  // Aptos addresses can be 1-64 hex characters (leading zeros can be omitted)
  const hexRegex = /^[0-9a-fA-F]{1,64}$/;
  return hexRegex.test(cleanAddress);
}

/**
 * Normalizes an address to full 64-character format with 0x prefix
 * 
 * @param address - Address to normalize
 * @returns Normalized address with leading zeros and 0x prefix
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  
  // Pad with leading zeros to 64 characters
  const paddedAddress = cleanAddress.padStart(64, '0');
  
  return `0x${paddedAddress}`;
}

/**
 * Formats a balance from octas to MOVE tokens with specified decimal places
 * 
 * @param octas - Balance in octas (smallest unit)
 * @param decimals - Number of decimal places to show (default: 4)
 * @returns Formatted balance string
 */
export function formatBalance(octas: bigint | string | number, decimals: number = 4): string {
  const octasValue = typeof octas === 'bigint' ? octas : BigInt(octas);
  const moveValue = Number(octasValue) / Math.pow(10, 8); // MOVE has 8 decimals
  return moveValue.toFixed(decimals);
}

/**
 * Converts MOVE tokens to octas (smallest unit)
 * 
 * @param moveAmount - Amount in MOVE tokens
 * @returns Amount in octas as bigint
 */
export function moveToOctas(moveAmount: number | string): bigint {
  const amount = typeof moveAmount === 'string' ? parseFloat(moveAmount) : moveAmount;
  return BigInt(Math.floor(amount * Math.pow(10, 8)));
}

/**
 * Converts octas to MOVE tokens
 * 
 * @param octas - Amount in octas
 * @returns Amount in MOVE tokens as number
 */
export function octasToMove(octas: bigint | string | number): number {
  const octasValue = typeof octas === 'bigint' ? octas : BigInt(octas);
  return Number(octasValue) / Math.pow(10, 8);
}

/**
 * Generate Movement explorer URL for a transaction
 * 
 * @param transactionHash - The transaction hash
 * @param explorerBaseUrl - Base URL for the explorer (defaults to Movement testnet)
 * @returns Complete explorer URL
 * 
 * @example
 * generateMovementExplorerUrl("0xabc123...")
 * // Returns: "https://explorer.movementnetwork.xyz/?network=bardock+testnet#/txn/0xabc123..."
 */
export function generateMovementExplorerUrl(
  transactionHash: string,
  explorerBaseUrl: string = "https://explorer.movementnetwork.xyz"
): string {
  if (!transactionHash) {
    throw new Error('Transaction hash is required');
  }
  
  // Format: {explorerBaseUrl}/?network=bardock+testnet#/txn/{transactionHash}
  return `${explorerBaseUrl}/?network=bardock+testnet#/txn/${transactionHash}`;
}

/**
 * Open Movement explorer URL in new tab
 * 
 * @param transactionHash - The transaction hash
 * @param explorerBaseUrl - Base URL for the explorer
 * 
 * @example
 * openMovementExplorer("0xabc123...")
 * // Opens explorer in new tab
 */
export function openMovementExplorer(
  transactionHash: string,
  explorerBaseUrl?: string
): void {
  try {
    const url = generateMovementExplorerUrl(transactionHash, explorerBaseUrl);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Failed to open Movement explorer:', error);
  }
}

export default {
  shortenAddress,
  isValidAddress,
  normalizeAddress,
  formatBalance,
  moveToOctas,
  octasToMove,
  generateMovementExplorerUrl,
  openMovementExplorer
};