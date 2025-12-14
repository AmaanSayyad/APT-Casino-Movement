"use client";

import React from 'react';
import { FaExternalLinkAlt, FaSpinner } from 'react-icons/fa';
import { SiMove } from 'react-icons/si';
import { openMovementExplorer } from '@/lib/movement';

/**
 * MovementTxLink Component
 * 
 * Displays a clickable Movement icon when transaction hash exists,
 * loading spinner when pending, or disabled icon when unavailable.
 * 
 * @param {Object} props
 * @param {string|null} props.transactionHash - The Movement transaction hash
 * @param {boolean} props.isPending - Whether the transaction is pending
 * @param {string} props.explorerBaseUrl - Base URL for Movement explorer
 * @param {string} props.className - Additional CSS classes
 */
const MovementTxLink = ({ 
  transactionHash, 
  isPending = false, 
  explorerBaseUrl = "https://explorer.movementnetwork.xyz",
  className = ""
}) => {
  // Handle click to open explorer in new tab
  const handleClick = () => {
    if (transactionHash) {
      openMovementExplorer(transactionHash, explorerBaseUrl);
    }
  };

  // Show loading spinner when pending
  if (isPending) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <FaSpinner 
          className="text-blue-400 animate-spin" 
          size={14}
          title="Transaction pending..."
        />
      </div>
    );
  }

  // Show clickable Movement icon when transaction hash exists
  if (transactionHash) {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center justify-center hover:scale-110 transition-transform duration-200 ${className}`}
        title={`View transaction on Movement Explorer: ${transactionHash}`}
      >
        <div className="relative group">
          <SiMove 
            className="text-purple-400 hover:text-purple-300 cursor-pointer" 
            size={14}
          />
          <FaExternalLinkAlt 
            className="absolute -top-1 -right-1 text-purple-400 group-hover:text-purple-300" 
            size={8}
          />
        </div>
      </button>
    );
  }

  // Show disabled icon when transaction hash is unavailable
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <SiMove 
        className="text-gray-500 opacity-50" 
        size={14}
        title="Movement transaction unavailable"
      />
    </div>
  );
};

export default MovementTxLink;