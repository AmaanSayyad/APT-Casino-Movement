/**
 * Basic tests for useMovementGameLogger hook
 * 
 * These tests verify the core functionality without requiring actual blockchain interaction.
 */

import { renderHook } from '@testing-library/react';
import { useMovementGameLogger } from '../useMovementGameLogger';

// Mock the wallet adapter
jest.mock('@aptos-labs/wallet-adapter-react', () => ({
  useWallet: () => ({
    account: { address: '0x1234567890abcdef' },
    signAndSubmitTransaction: jest.fn(),
  }),
}));

// Mock the Movement SDK
jest.mock('@aptos-labs/ts-sdk', () => ({
  Movement: jest.fn().mockImplementation(() => ({
    waitForTransaction: jest.fn(),
    view: jest.fn(),
  })),
  AptosConfig: jest.fn(),
  Network: { CUSTOM: 'custom' },
}));

// Mock the config
jest.mock('@/config/movement', () => ({
  MOVEMENT_BARDOCK: {
    rpcUrl: 'https://test.rpc.url',
  },
  MOVEMENT_ENV_CONFIG: {
    treasuryAddress: '0xtreasury',
    gameLoggerAddress: '0xgamelogger',
  },
  getMovementExplorerTxUrl: jest.fn((hash) => `https://explorer.test/${hash}`),
}));

// Mock the storage utilities
jest.mock('@/lib/gameHistoryStorage', () => ({
  storeGameTransaction: jest.fn(),
  updateTransactionStatus: jest.fn(),
  getTransactionHashByGameId: jest.fn(),
  getPendingTransactions: jest.fn(() => []),
  cleanupOldEntries: jest.fn(),
}));

describe('useMovementGameLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useMovementGameLogger());

    expect(result.current.isLogging).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.logGame).toBe('function');
    expect(typeof result.current.getGameHistory).toBe('function');
    expect(typeof result.current.retryPendingLogs).toBe('function');
    expect(typeof result.current.getPendingLogsCount).toBe('function');
  });

  it('should return error when wallet not connected', async () => {
    // Mock wallet as not connected
    const mockUseWallet = require('@aptos-labs/wallet-adapter-react').useWallet;
    mockUseWallet.mockReturnValue({
      account: null,
      signAndSubmitTransaction: jest.fn(),
    });

    const { result } = renderHook(() => useMovementGameLogger());

    const gameParams = {
      gameType: 'plinko' as const,
      playerAddress: '0xplayer',
      betAmount: BigInt(1000000),
      result: 'win',
      payout: BigInt(2000000),
      randomSeed: BigInt(12345),
    };

    const logResult = await result.current.logGame(gameParams);

    expect(logResult.success).toBe(false);
    expect(logResult.error).toBe('Wallet not connected');
  });

  it('should return error when treasury address not configured', async () => {
    // Mock missing treasury address
    const mockConfig = require('@/config/movement');
    mockConfig.MOVEMENT_ENV_CONFIG.treasuryAddress = '';

    const { result } = renderHook(() => useMovementGameLogger());

    const gameParams = {
      gameType: 'mines' as const,
      playerAddress: '0xplayer',
      betAmount: BigInt(1000000),
      result: 'loss',
      payout: BigInt(0),
      randomSeed: BigInt(54321),
    };

    const logResult = await result.current.logGame(gameParams);

    expect(logResult.success).toBe(false);
    expect(logResult.error).toBe('Treasury address not configured');
  });

  it('should return correct pending logs count', () => {
    const mockGetPendingTransactions = require('@/lib/gameHistoryStorage').getPendingTransactions;
    mockGetPendingTransactions.mockReturnValue([
      { status: 'failed', transactionHash: 'pending_123' },
      { status: 'failed', transactionHash: 'pending_456' },
      { status: 'confirmed', transactionHash: 'confirmed_789' },
    ]);

    const { result } = renderHook(() => useMovementGameLogger());

    const count = result.current.getPendingLogsCount();
    expect(count).toBe(2); // Only failed pending transactions
  });
});