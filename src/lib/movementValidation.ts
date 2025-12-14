/**
 * Movement Balance Validation Utilities
 * 
 * Validation functions for Movement balance operations (deposits and withdrawals).
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates deposit amount and user wallet balance
 * 
 * @param amount - Deposit amount in octas
 * @param walletBalance - User's current wallet balance in octas
 * @returns Validation result with success status and error message if invalid
 */
export function validateDeposit(amount: bigint, walletBalance: bigint): ValidationResult {
  // Check if amount is positive
  if (amount <= BigInt(0)) {
    return { 
      isValid: false, 
      error: 'Deposit amount must be greater than 0' 
    };
  }

  // Check if user has sufficient wallet balance
  if (amount > walletBalance) {
    return { 
      isValid: false, 
      error: 'Insufficient wallet balance' 
    };
  }

  return { isValid: true };
}

/**
 * Validates withdrawal amount against user balance
 * 
 * @param amount - Withdrawal amount in octas
 * @param userBalance - User's current balance in the casino system in octas
 * @returns Validation result with success status and error message if invalid
 */
export function validateWithdrawal(amount: bigint, userBalance: bigint): ValidationResult {
  // Check if amount is positive
  if (amount <= BigInt(0)) {
    return { 
      isValid: false, 
      error: 'Withdrawal amount must be greater than 0' 
    };
  }

  // Check if user has sufficient balance
  if (amount > userBalance) {
    return { 
      isValid: false, 
      error: 'Insufficient balance' 
    };
  }

  return { isValid: true };
}

/**
 * Validates if an amount is a valid positive number
 * 
 * @param amount - Amount to validate
 * @returns True if amount is valid (positive)
 */
export function isValidAmount(amount: bigint): boolean {
  return amount > BigInt(0);
}

/**
 * Validates if user has sufficient balance for an operation
 * 
 * @param requiredAmount - Required amount for the operation
 * @param availableBalance - Available balance
 * @returns True if balance is sufficient
 */
export function hasSufficientBalance(requiredAmount: bigint, availableBalance: bigint): boolean {
  return availableBalance >= requiredAmount;
}

export default {
  validateDeposit,
  validateWithdrawal,
  isValidAmount,
  hasSufficientBalance
};