import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { chainCrowdFundService, Campaign, ARBITRUM_SEPOLIA } from '../lib/contract';

interface ContractState {
  isLoading: boolean;
  error: string | null;
  campaigns: Campaign[];
  userBalance: string;
  userAllowance: string;
}

export function useContract() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [state, setState] = useState<ContractState>({
    isLoading: false,
    error: null,
    campaigns: [],
    userBalance: '0',
    userAllowance: '0'
  });

  // Get embedded Privy wallet specifically
  const getEmbeddedWallet = useCallback(() => {
    return wallets.find(wallet => wallet.walletClientType === 'privy');
  }, [wallets]);

  // Debug logging
  React.useEffect(() => {
    console.log('=== useContract Debug ===');
    console.log('authenticated:', authenticated);
    console.log('wallets:', wallets);
    console.log('embedded wallet:', getEmbeddedWallet());
  }, [authenticated, wallets, getEmbeddedWallet]);

  // Get signer for write operations
  const getSigner = useCallback(async () => {
    if (!authenticated) {
      throw new Error('Please log in first');
    }
    
    // Check if embedded wallet is available
    const embeddedWallet = getEmbeddedWallet();
    if (!embeddedWallet?.address) {
      throw new Error('Embedded wallet not ready. Please try refreshing the page and logging in again.');
    }
    
    const provider = await embeddedWallet.getEthereumProvider();
    const ethersProvider = new ethers.BrowserProvider(provider);
    
    // Check network and switch if needed
    const network = await ethersProvider.getNetwork();
    if (Number(network.chainId) !== ARBITRUM_SEPOLIA.chainId) {
      try {
        await embeddedWallet.switchChain(ARBITRUM_SEPOLIA.chainId);
      } catch {
        throw new Error(`Please switch to ${ARBITRUM_SEPOLIA.name} network`);
      }
    }
    
    return ethersProvider.getSigner();
  }, [authenticated, getEmbeddedWallet]);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const campaigns = await chainCrowdFundService.getAllCampaigns();
      setState(prev => ({ ...prev, campaigns, isLoading: false }));
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to load campaigns',
        isLoading: false 
      }));
    }
  }, []);

  // Load user's USDC balance and allowance
  const loadUserBalance = useCallback(async () => {
    const embeddedWallet = getEmbeddedWallet();
    if (!authenticated || !embeddedWallet?.address) return;
    
    const walletAddress = embeddedWallet.address;
    try {
      const [balance, allowance] = await Promise.all([
        chainCrowdFundService.getUSDCBalance(walletAddress),
        chainCrowdFundService.getUSDCAllowance(walletAddress)
      ]);
      
      setState(prev => ({ ...prev, userBalance: balance, userAllowance: allowance }));
    } catch (error) {
      console.error('Failed to load user balance:', error);
    }
  }, [authenticated, getEmbeddedWallet]);

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Load user balance when embedded wallet is available
  useEffect(() => {
    const embeddedWallet = getEmbeddedWallet();
    if (authenticated && embeddedWallet?.address) {
      loadUserBalance();
    }
  }, [authenticated, getEmbeddedWallet, loadUserBalance]);

  // Create campaign
  const createCampaign = useCallback(async (
    title: string,
    description: string,
    goalAmount: string,
    duration: number,
    category: string
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      const txHash = await chainCrowdFundService.createCampaign(
        title,
        description,
        goalAmount,
        duration,
        category
      );
      
      setState(prev => ({ ...prev, isLoading: false }));
      await loadCampaigns(); // Refresh campaigns list
      return txHash;
    } catch (error) {
      console.error('Failed to create campaign:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to create campaign',
        isLoading: false 
      }));
      throw error;
    }
  }, [getSigner, loadCampaigns]);

  // Approve USDC spending
  const approveUSDC = useCallback(async (amount: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      const txHash = await chainCrowdFundService.approveUSDC(amount);
      
      setState(prev => ({ ...prev, isLoading: false }));
      await loadUserBalance(); // Refresh balance
      return txHash;
    } catch (error) {
      console.error('Failed to approve USDC:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to approve USDC',
        isLoading: false 
      }));
      throw error;
    }
  }, [getSigner, loadUserBalance]);

  // Contribute to campaign
  const contribute = useCallback(async (campaignId: number, amount: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      const txHash = await chainCrowdFundService.contribute(campaignId, amount);
      
      setState(prev => ({ ...prev, isLoading: false }));
      await Promise.all([loadCampaigns(), loadUserBalance()]); // Refresh data
      return txHash;
    } catch (error) {
      console.error('Failed to contribute:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to contribute',
        isLoading: false 
      }));
      throw error;
    }
  }, [getSigner, loadCampaigns, loadUserBalance]);

  // Get campaign contributions
  const getCampaignContributions = useCallback(async (campaignId: number) => {
    try {
      return await chainCrowdFundService.getCampaignContributions(campaignId);
    } catch (error) {
      console.error('Failed to get contributions:', error);
      return [];
    }
  }, []);

  // Submit campaign results
  const submitResults = useCallback(async (campaignId: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      const txHash = await chainCrowdFundService.submitResults(campaignId);
      
      setState(prev => ({ ...prev, isLoading: false }));
      await loadCampaigns(); // Refresh campaigns
      return txHash;
    } catch (error) {
      console.error('Failed to submit results:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to submit results',
        isLoading: false 
      }));
      throw error;
    }
  }, [getSigner, loadCampaigns]);

  // Release funds
  const releaseFunds = useCallback(async (campaignId: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      const txHash = await chainCrowdFundService.releaseFunds(campaignId);
      
      setState(prev => ({ ...prev, isLoading: false }));
      await loadCampaigns(); // Refresh campaigns
      return txHash;
    } catch (error) {
      console.error('Failed to release funds:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to release funds',
        isLoading: false 
      }));
      throw error;
    }
  }, [getSigner, loadCampaigns]);

  // Request refund
  const requestRefund = useCallback(async (campaignId: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      const txHash = await chainCrowdFundService.refund(campaignId);
      
      setState(prev => ({ ...prev, isLoading: false }));
      await Promise.all([loadCampaigns(), loadUserBalance()]); // Refresh data
      return txHash;
    } catch (error) {
      console.error('Failed to request refund:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to request refund',
        isLoading: false 
      }));
      throw error;
    }
  }, [getSigner, loadCampaigns, loadUserBalance]);

  // Utility functions
  const formatUSDC = (amount: string | bigint) => {
    // Convert blockchain amounts (6 decimals) to human readable format
    const amountStr = typeof amount === 'bigint' ? amount.toString() : amount;
    const formatted = ethers.formatUnits(amountStr, 6); // USDC has 6 decimals
    const num = parseFloat(formatted);
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDeadline = (timestamp: number | bigint) => {
    const timestampNum = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
    return new Date(timestampNum * 1000).toLocaleDateString();
  };

  const isExpired = (deadline: number | bigint) => {
    const deadlineNum = typeof deadline === 'bigint' ? Number(deadline) : deadline;
    return Math.floor(Date.now() / 1000) > deadlineNum;
  };

  const getProgressPercentage = (raised: string | bigint, goal: string | bigint) => {
    // Convert blockchain amounts (6 decimals) to human readable format
    const raisedStr = typeof raised === 'bigint' ? raised.toString() : raised;
    const goalStr = typeof goal === 'bigint' ? goal.toString() : goal;
    const raisedFormatted = ethers.formatUnits(raisedStr, 6); // USDC has 6 decimals
    const goalFormatted = ethers.formatUnits(goalStr, 6);
    const raisedNum = parseFloat(raisedFormatted);
    const goalNum = parseFloat(goalFormatted);
    return goalNum > 0 ? Math.min((raisedNum / goalNum) * 100, 100) : 0;
  };

  return {
    // State
    ...state,
    
    // Wallet connection state - always use embedded wallet
    isWalletConnected: authenticated && !!getEmbeddedWallet()?.address,
    
    // Actions
    createCampaign,
    approveUSDC,
    contribute,
    getCampaignContributions,
    submitResults,
    releaseFunds,
    requestRefund,
    loadCampaigns,
    loadUserBalance,
    
    // Utilities
    formatUSDC,
    formatDeadline,
    isExpired,
    getProgressPercentage,
    
    // Network info
    network: ARBITRUM_SEPOLIA
  };
} 