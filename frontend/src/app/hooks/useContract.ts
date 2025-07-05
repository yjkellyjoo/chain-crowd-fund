import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { chainCrowdFundService, Campaign, Contribution, ARBITRUM_SEPOLIA } from '../lib/contract';

interface ContractState {
  isLoading: boolean;
  error: string | null;
  campaigns: Campaign[];
  userBalance: string;
  userAllowance: string;
}

export function useContract() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [state, setState] = useState<ContractState>({
    isLoading: false,
    error: null,
    campaigns: [],
    userBalance: '0',
    userAllowance: '0'
  });

  // Debug logging
  React.useEffect(() => {
    console.log('=== useContract Debug ===');
    console.log('authenticated:', authenticated);
    console.log('user:', user);
    console.log('user?.wallet?.address:', user?.wallet?.address);
    console.log('wallets:', wallets);
    console.log('wallets[0]?.address:', wallets[0]?.address);
  }, [authenticated, user, wallets]);

  // Get signer for write operations
  const getSigner = useCallback(async () => {
    if (!authenticated) {
      throw new Error('Please log in first');
    }
    
    // Check if wallet is connected using wallets array
    if (wallets.length === 0 || !wallets[0]?.address) {
      throw new Error('Please connect your wallet first. Try refreshing the page and logging in again.');
    }
    
    const wallet = wallets[0];
    const provider = await wallet.getEthereumProvider();
    const ethersProvider = new ethers.BrowserProvider(provider);
    
    // Check network and switch if needed
    const network = await ethersProvider.getNetwork();
    if (Number(network.chainId) !== ARBITRUM_SEPOLIA.chainId) {
      try {
        await wallet.switchChain(ARBITRUM_SEPOLIA.chainId);
      } catch {
        throw new Error(`Please switch to ${ARBITRUM_SEPOLIA.name} network`);
      }
    }
    
    return ethersProvider.getSigner();
  }, [authenticated, wallets]);

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
    if (!authenticated || wallets.length === 0 || !wallets[0]?.address) return;
    
    const walletAddress = wallets[0].address;
    try {
      const [balance, allowance] = await Promise.all([
        chainCrowdFundService.getUSDCBalance(walletAddress),
        chainCrowdFundService.getUSDCAllowance(walletAddress)
      ]);
      
      setState(prev => ({ ...prev, userBalance: balance, userAllowance: allowance }));
    } catch (error) {
      console.error('Failed to load user balance:', error);
    }
  }, [authenticated, wallets]);

  // Create a new campaign
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
      
      const txHash = await chainCrowdFundService.createCampaign(title, description, goalAmount, duration, category);
      
      // Reload campaigns after creation
      await loadCampaigns();
      
      setState(prev => ({ ...prev, isLoading: false }));
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
      
      // Reload user balance after approval
      await loadUserBalance();
      
      setState(prev => ({ ...prev, isLoading: false }));
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

  // Contribute to a campaign
  const contribute = useCallback(async (campaignId: number, amount: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      
      const txHash = await chainCrowdFundService.contribute(campaignId, amount);
      
      // Reload campaigns and user balance after contribution
      await Promise.all([loadCampaigns(), loadUserBalance()]);
      
      setState(prev => ({ ...prev, isLoading: false }));
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

  // Get campaign contributions (read-only, no signer needed)
  const getCampaignContributions = useCallback(async (campaignId: number): Promise<Contribution[]> => {
    try {
      return await chainCrowdFundService.getCampaignContributions(campaignId);
    } catch (error) {
      console.error('Failed to get campaign contributions:', error);
      throw error;
    }
  }, []);

  // Submit results (for campaign creators)
  const submitResults = useCallback(async (campaignId: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      
      const txHash = await chainCrowdFundService.submitResults(campaignId);
      
      // Reload campaigns after submitting results
      await loadCampaigns();
      
      setState(prev => ({ ...prev, isLoading: false }));
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

  // Release funds (for campaign creators)
  const releaseFunds = useCallback(async (campaignId: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      
      const txHash = await chainCrowdFundService.releaseFunds(campaignId);
      
      // Reload campaigns after releasing funds
      await loadCampaigns();
      
      setState(prev => ({ ...prev, isLoading: false }));
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

  // Request refund (for contributors)
  const requestRefund = useCallback(async (campaignId: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signer = await getSigner();
      chainCrowdFundService.setSigner(signer);
      
      const txHash = await chainCrowdFundService.refund(campaignId);
      
      // Reload campaigns and user balance after refund
      await Promise.all([loadCampaigns(), loadUserBalance()]);
      
      setState(prev => ({ ...prev, isLoading: false }));
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
  const formatUSDC = useCallback((amount: bigint) => {
    return chainCrowdFundService.formatUSDC(amount);
  }, []);

  const formatDeadline = useCallback((timestamp: bigint) => {
    return chainCrowdFundService.formatDeadline(timestamp);
  }, []);

  const isExpired = useCallback((deadline: bigint) => {
    return chainCrowdFundService.isExpired(deadline);
  }, []);

  const getProgressPercentage = useCallback((raised: bigint, goal: bigint) => {
    return chainCrowdFundService.getProgressPercentage(raised, goal);
  }, []);

  // Load initial data (read-only operations work without wallet)
  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Load user balance when authenticated
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      loadUserBalance();
    }
  }, [authenticated, user, loadUserBalance]);

  return {
    // State
    ...state,
    
    // Wallet connection state - use wallets array instead of user.wallet
    isWalletConnected: authenticated && wallets.length > 0 && wallets[0]?.address,
    
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