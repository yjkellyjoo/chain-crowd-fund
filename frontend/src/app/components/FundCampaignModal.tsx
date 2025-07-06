"use client";
import React, { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets, useFundWallet } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { useContract } from "../hooks/useContract";
import { Campaign, CHAINCROWDFUND_CONTRACT_ADDRESS } from "../lib/contract";
import { cctpService, CCTP_V2_CHAINS, CCTPChain, TransferRequest } from "../lib/cctp";
import { sepolia, arbitrumSepolia, baseSepolia, avalancheFuji } from "viem/chains";

interface FundCampaignModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper function to get viem chain from CCTP chain ID
const getViemChainFromCCTPId = (chainId: number) => {
  switch (chainId) {
    case 11155111: return sepolia;
    case 421614: return arbitrumSepolia;
    case 84532: return baseSepolia;
    case 43113: return avalancheFuji;
    default: return sepolia; // fallback
  }
};

export function FundCampaignModal({ campaign, onClose, onSuccess }: FundCampaignModalProps) {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();
  const { 
    contribute, 
    approveUSDC, 
    userBalance, 
    userAllowance, 
    error: contractError,
    isExpired,
    network,
    formatUSDC,
    getProgressPercentage
  } = useContract();

  // State for both cross-chain and local contributions
  const [amount, setAmount] = useState("");
  const [fundingMethod, setFundingMethod] = useState<'local' | 'crosschain'>('local');
  const [selectedChain, setSelectedChain] = useState<CCTPChain>(
    CCTP_V2_CHAINS.find(chain => chain.id === 84532) || CCTP_V2_CHAINS[0] // Default to Base Sepolia
  );
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'amount' | 'processing' | 'attestation' | 'complete' | 'success'>('amount');
  const [hasUSDC, setHasUSDC] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [transferStatus, setTransferStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [attestationData, setAttestationData] = useState<{message: string, attestation: string} | null>(null);
  const [fundingAvailable, setFundingAvailable] = useState(true);
  
  // Local contribution state (from ContributeCampaign)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalStep, setApprovalStep] = useState(false);
  const [resumeTxHash, setResumeTxHash] = useState("");
  
  // Balance cache to avoid repeated calls
  const [balanceCache, setBalanceCache] = useState<Map<string, {balance: string, timestamp: number}>>(new Map());
  const [lastBalanceCheck, setLastBalanceCheck] = useState<number>(0);

  // Destination chain - where the crowdfunding contract is deployed
  const destinationChain = CCTP_V2_CHAINS.find(chain => chain.id === network.chainId) || CCTP_V2_CHAINS[0];
  const contractAddress = CHAINCROWDFUND_CONTRACT_ADDRESS;
  
  // Check if contract address is properly configured
  const isContractAddressValid = contractAddress && contractAddress.length === 42;
  if (!isContractAddressValid) {
    console.error("❌ Contract address not configured properly!");
    console.error("Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env.local file");
    console.error("Current value:", contractAddress || "undefined");
  }

  // Check if approval is needed when amount changes (for local contributions)
  useEffect(() => {
    if (fundingMethod === 'local' && amount && parseFloat(amount) > 0) {
      const amountNum = parseFloat(amount);
      const allowanceNum = parseFloat(userAllowance);
      setNeedsApproval(amountNum > allowanceNum);
    } else {
      setNeedsApproval(false);
    }
  }, [amount, userAllowance, fundingMethod]);

  const checkUSDCBalance = useCallback(async (forceRefresh: boolean = false) => {
    const getEmbeddedWallet = () => {
      if (!wallets || wallets.length === 0) return null;
      return wallets.find(wallet => wallet.walletClientType === 'privy');
    };

    const wallet = getEmbeddedWallet();
    if (!wallet) {
      console.log("No Ethereum wallet found");
      return;
    }

    // Debounce: Only check once every 10 seconds unless forced
    const now = Date.now();
    if (!forceRefresh && (now - lastBalanceCheck < 10000)) {
      console.log("⏳ Balance check skipped - too soon since last check");
      return;
    }
    
    setBalanceLoading(true);
    setLastBalanceCheck(now);
    
    try {
      if (fundingMethod === 'local') {
        // For local contributions, use the contract's balance check
        setUsdcBalance(parseFloat(userBalance).toFixed(2));
        setHasUSDC(parseFloat(userBalance) > 0);
      } else {
        // For cross-chain, use CCTP balance check with caching
        const cacheKey = `${selectedChain.id}-${wallet.address}`;
        const cached = balanceCache.get(cacheKey);
        
        // Use cache if it's less than 30 seconds old and not forced refresh
        if (!forceRefresh && cached && (now - cached.timestamp < 30000)) {
          console.log(`💾 Using cached balance for ${selectedChain.name}: ${cached.balance} USDC`);
          setUsdcBalance(parseFloat(cached.balance).toFixed(2));
          setHasUSDC(parseFloat(cached.balance) > 0);
          setBalanceLoading(false);
          return;
        }

        console.log(`🔍 Fetching USDC balance for wallet: ${wallet.address} on ${selectedChain.name}`);
        try {
          const balance = await cctpService.getUSDCBalance(selectedChain.id, wallet.address);
          console.log(`💰 USDC Balance: ${balance} USDC`);
          
          // Update cache
          const newCache = new Map(balanceCache);
          newCache.set(cacheKey, { balance, timestamp: now });
          setBalanceCache(newCache);
          
          setUsdcBalance(parseFloat(balance).toFixed(2));
          setHasUSDC(parseFloat(balance) > 0);
        } catch (balanceError) {
          console.error(`❌ Failed to get balance for ${selectedChain.name}:`, balanceError);
          setUsdcBalance("0");
          setHasUSDC(false);
        }
      }
    } catch (error) {
      console.error("Error checking USDC balance:", error);
      setUsdcBalance("0");
      setHasUSDC(false);
    } finally {
      setBalanceLoading(false);
    }
  }, [selectedChain, wallets, fundingMethod, userBalance, balanceCache, lastBalanceCheck]);

  // Track selectedChain changes
  useEffect(() => {
    console.log("🎯 selectedChain state updated to:", selectedChain.name, "ID:", selectedChain.id);
  }, [selectedChain]);

  // Log initial setup
  useEffect(() => {
    console.log("🚀 FundCampaignModal initialized");
    console.log("🚀 Initial selectedChain:", selectedChain.name, "ID:", selectedChain.id);
    console.log("🚀 Available CCTP chains:", CCTP_V2_CHAINS.map(c => `${c.name} (${c.id})`));
  }, []);

  useEffect(() => {
    if (ready && wallets && wallets.length > 0) {
      // Only check balance when switching between local/crosschain or changing chains
      checkUSDCBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, wallets, selectedChain, fundingMethod]); // Removed checkUSDCBalance to prevent loops

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  // Local contribution handlers (from ContributeCampaign)
  const handleApprove = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setApprovalStep(true);
    setIsSubmitting(true);
    try {
      // Approve a bit more than needed to avoid rounding issues
      const approveAmount = (parseFloat(amount) * 1.01).toString();
      await approveUSDC(approveAmount);
      alert('USDC approved successfully!');
      setNeedsApproval(false);
    } catch (error) {
      console.error('Approval failed:', error);
      alert('Approval failed. Please try again.');
    } finally {
      setIsSubmitting(false);
      setApprovalStep(false);
    }
  };

  const handleLocalContribute = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(userBalance);

    if (amountNum > balanceNum) {
      alert('Insufficient USDC balance');
      return;
    }

    if (needsApproval) {
      alert('Please approve USDC spending first');
      return;
    }

    setIsSubmitting(true);
    try {
      await contribute(campaign.id, amount);
      alert('Contribution successful!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Contribution failed:', error);
      alert('Contribution failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cross-chain contribution handlers (from original FundCampaignModal)
  const handleNextStep = () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) > parseFloat(usdcBalance)) {
      alert("Insufficient USDC balance");
      handleOnRamp();
      return;
    }
    
    if (fundingMethod === 'local') {
      handleLocalContribute();
    } else {
      if (!hasUSDC) {
        handleOnRamp();
      } else {
        handleCrossChainFunding();
      }
    }
  };

  const handleOnRamp = async () => {
    const wallet = wallets?.[0];
    if (!wallet) {
      alert("Please connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      setTransferStatus("Initiating Privy funding...");
      
      // Use Privy's funding support - all methods configured in Dashboard
      await fundWallet(wallet.address, {
        chain: fundingMethod === 'crosschain' ? 
          getViemChainFromCCTPId(selectedChain.id) :
          getViemChainFromCCTPId(destinationChain.id),
        asset: 'USDC',
        // Only specify amount if user has entered one, otherwise let them choose
        ...(amount && parseFloat(amount) > 0 ? { amount: parseFloat(amount).toFixed(2) } : {})
      });
      
      setTransferStatus("Funding completed! Please check your wallet balance.");
      
      // Refresh balance after funding (force refresh)
      setTimeout(() => {
        checkUSDCBalance(true);
      }, 2000);
      
    } catch (error) {
      console.error("Privy funding error:", error);
      
      // Check if this is the "not enabled" error
      if (error instanceof Error && error.message.includes("not enabled")) {
        setFundingAvailable(false);
        setTransferStatus("⚠️ Wallet funding not enabled. Please enable all funding methods in your Privy Dashboard.");
        alert("Wallet funding is not enabled.\n\nTo enable all Privy funding methods:\n1. Go to your Privy Dashboard\n2. Navigate to User management > Account funding\n3. Enable 'Pay with card' (for debit/credit cards, Apple Pay, Google Pay)\n4. Enable 'External wallet transfers' (MetaMask, Phantom, etc.)\n5. Enable 'Exchange transfers' (Coinbase, etc.)\n6. Enable 'Bank transfers' (ACH, wire, SEPA)\n7. Configure your preferred networks, assets, and amounts");
      } else {
        setTransferStatus("Funding failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResumeTransfer = async () => {
    if (!resumeTxHash) {
      alert("Please enter a transaction hash");
      return;
    }

    setLoading(true);
    setStep('processing');
    setTxHash(resumeTxHash);
    setTransferStatus("Checking attestation status...");
    
    try {
      // Get attestation from Circle
      let attempts = 0;
      const maxAttempts = 60;
      const sourceChain = selectedChain;

      const attestationUrl = `https://iris-api-sandbox.circle.com/v2/messages/${sourceChain.domain}?transactionHash=${resumeTxHash}`;
      
      while (attempts < maxAttempts) {
        try {
          const response = await fetch(attestationUrl);
          
          if (response.status === 404) {
            attempts++;
            const timeLeft = Math.ceil((maxAttempts - attempts) * 5 / 60);
            setTransferStatus(`Waiting for attestation from Circle... (${attempts}/${maxAttempts}, ~${timeLeft}min remaining)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.messages && data.messages.length > 0) {
            const message = data.messages[0];
            if (message.status === 'complete') {
              setAttestationData({
                message: message.message,
                attestation: message.attestation
              });
              setStep('attestation');
              setTransferStatus("Attestation received! Ready to complete transfer.");
              return;
            }
          }
          
          attempts++;
          const timeLeft = Math.ceil((maxAttempts - attempts) * 5 / 60);
          setTransferStatus(`Waiting for attestation from Circle... (${attempts}/${maxAttempts}, ~${timeLeft}min remaining)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (error) {
          console.error("Attestation check error:", error);
          attempts++;
          const timeLeft = Math.ceil((maxAttempts - attempts) * 5 / 60);
          setTransferStatus(`Waiting for attestation from Circle... (${attempts}/${maxAttempts}, ~${timeLeft}min remaining)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      throw new Error('Attestation timeout - Please try again later or check Circle\'s status');

    } catch (error) {
      console.error("Resume transfer error:", error);
      setTransferStatus(error instanceof Error ? error.message : "Transfer failed");
      setStep('amount');
    } finally {
      setLoading(false);
    }
  };

  const handleCrossChainFunding = async () => {
    // Check if contract address is valid before proceeding
    if (!isContractAddressValid) {
      alert("❌ Contract address not configured!\n\nPlease:\n1. Create frontend/.env.local file\n2. Add: NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address\n3. Restart the development server");
      return;
    }

    const getEmbeddedWallet = () => {
      if (!wallets || wallets.length === 0) return null;
      return wallets.find(wallet => wallet.walletClientType === 'privy');
    };

    const wallet = getEmbeddedWallet();
    if (!wallet) {
      alert("Please connect your Privy wallet first");
      return;
    }

    setLoading(true);
    setStep('processing');
    
    try {
      // Set up the signer using Privy's embedded wallet
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      cctpService.setSigner(signer);

      // Check if we need to switch networks
      const currentNetwork = await ethersProvider.getNetwork();
      if (currentNetwork.chainId !== BigInt(selectedChain.id)) {
        setTransferStatus("Please switch to the source chain in your wallet...");
        try {
          await wallet.switchChain(selectedChain.id);
        } catch (switchError: unknown) {
          console.error("Failed to switch chain:", switchError);
          setTransferStatus("Please manually switch to the source chain in your wallet");
          return;
        }
      }

      // Step 1: Check allowance and approve if needed
      setTransferStatus("Checking USDC allowance...");
      const userAddress = await signer.getAddress();
      
      // Create transfer request - mint to user's wallet, not contract
      const transferRequest: TransferRequest = {
        amount: amount,
        sourceChain: selectedChain,
        destinationChain: destinationChain,
        recipient: userAddress, // Mint to user's wallet, not contract
        fast: selectedChain.fast,
        destinationCaller: ethers.ZeroAddress, // Allow any caller
        maxFee: '0.0005'
      };
      const currentAllowance = await cctpService.getUSDCAllowance(
        selectedChain.id,
        userAddress,
        selectedChain.tokenMessengerAddress
      );

      if (parseFloat(currentAllowance) < parseFloat(amount)) {
        setTransferStatus("Approving USDC spending...");
        await cctpService.approveUSDC(selectedChain.id, amount);
      }

      // Step 2: Burn USDC on source chain
      setTransferStatus("Burning USDC on source chain...");
      const burnResult = await cctpService.burnUSDC(transferRequest);
      if (!burnResult.success) {
        throw new Error(burnResult.error || "Burn failed");
      }

      setTxHash(burnResult.txHash);
      setTransferStatus("USDC burned successfully! Getting attestation from Circle...");

      // Step 3: Get attestation from Circle with progress updates
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max wait
      const sourceChain = selectedChain;

      const attestationUrl = `https://iris-api-sandbox.circle.com/v2/messages/${sourceChain.domain}?transactionHash=${burnResult.txHash}`;
      
      while (attempts < maxAttempts) {
        try {
          const response = await fetch(attestationUrl);
          
          if (response.status === 404) {
            attempts++;
            const timeLeft = Math.ceil((maxAttempts - attempts) * 5 / 60);
            setTransferStatus(`Waiting for attestation from Circle... (${attempts}/${maxAttempts}, ~${timeLeft}min remaining)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.messages && data.messages.length > 0) {
            const message = data.messages[0];
            if (message.status === 'complete') {
              setAttestationData({
                message: message.message,
                attestation: message.attestation
              });
              setStep('attestation');
              setTransferStatus("Attestation received! Ready to complete transfer.");
              return;
            }
          }
          
          attempts++;
          const timeLeft = Math.ceil((maxAttempts - attempts) * 5 / 60);
          setTransferStatus(`Waiting for attestation from Circle... (${attempts}/${maxAttempts}, ~${timeLeft}min remaining)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (error) {
          console.error("Attestation check error:", error);
          attempts++;
          const timeLeft = Math.ceil((maxAttempts - attempts) * 5 / 60);
          setTransferStatus(`Waiting for attestation from Circle... (${attempts}/${maxAttempts}, ~${timeLeft}min remaining)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      throw new Error('Attestation timeout - Please try again later or check Circle\'s status');

    } catch (error) {
      console.error("Cross-chain transfer error:", error);
      console.error("Transfer details:", {
        amount,
        sourceChain: selectedChain.name,
        destinationChain: destinationChain.name,
        contractAddress,
        txHash: txHash || "None"
      });
      
      let errorMessage = "Transfer failed";
      if (error instanceof Error) {
        if (error.message.includes("missing revert data") || error.message.includes("CALL_EXCEPTION")) {
          errorMessage = "❌ Contract call failed. Please check:\n• Contract address is correct\n• Contract is deployed on destination chain\n• You have sufficient gas";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "❌ Insufficient funds for gas fees";
        } else if (error.message.includes("user rejected")) {
          errorMessage = "❌ Transaction rejected by user";
        } else {
          errorMessage = error.message;
        }
      }
      
      setTransferStatus(errorMessage);
      setStep('amount');
    } finally {
      setLoading(false);
    }
  };

  const completeTransfer = async () => {
    if (!attestationData) {
      setTransferStatus("Missing attestation data");
      return;
    }

    // Check if contract address is valid before proceeding
    if (!isContractAddressValid) {
      setTransferStatus("❌ Contract address not configured properly!");
      alert("❌ Contract address not configured!\n\nPlease:\n1. Create frontend/.env.local file\n2. Add: NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address\n3. Restart the development server");
      return;
    }

    const getEmbeddedWallet = () => {
      if (!wallets || wallets.length === 0) return null;
      return wallets.find(wallet => wallet.walletClientType === 'privy');
    };

    const wallet = getEmbeddedWallet();
    if (!wallet) {
      setTransferStatus("Please connect your Privy wallet first");
      return;
    }

    setLoading(true);
    setStep('complete');
    setTransferStatus("Completing transfer on destination chain...");

    try {
      // Switch to destination chain
      try {
        await wallet.switchChain(destinationChain.id);
      } catch (switchError: unknown) {
        console.error("Failed to switch to destination chain:", switchError);
        setTransferStatus("Please manually switch to the destination chain in your wallet");
        return;
      }

      // Set up the signer for CCTP service
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      cctpService.setSigner(signer);

      // Complete the transfer
      const result = await cctpService.completeTransfer(
        attestationData.message,
        attestationData.attestation,
        destinationChain.id
      );

      if (result.success) {
        setStep('success');
        setTransferStatus(`Cross-chain transfer completed! ${amount} USDC has been minted to your wallet on ${destinationChain.name}. You can now contribute to the campaign using the Local funding method.`);
        // Don't call onSuccess() yet since user needs to manually contribute
      } else {
        throw new Error(result.error || 'Failed to complete transfer');
      }
    } catch (error) {
      console.error("Failed to complete transfer:", error);
      console.error("Complete transfer details:", {
        contractAddress,
        destinationChain: destinationChain.name,
        attestationData: attestationData ? "Present" : "Missing"
      });
      
      let errorMessage = "Failed to complete transfer";
      if (error instanceof Error) {
        if (error.message.includes("missing revert data") || error.message.includes("CALL_EXCEPTION")) {
          errorMessage = "❌ Contract call failed during completion. Please check:\n• Contract address is correct and deployed\n• Contract has the expected receiveMessage function\n• Attestation data is valid\n• You have sufficient gas on destination chain";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "❌ Insufficient funds for gas fees on destination chain";
        } else if (error.message.includes("user rejected")) {
          errorMessage = "❌ Transaction rejected by user";
        } else {
          errorMessage = error.message;
        }
      }
      
      setTransferStatus(errorMessage);
      setStep('attestation');
    } finally {
      setLoading(false);
    }
  };

  const goalAmountFormatted = formatUSDC(campaign.goalAmount);
  const raisedAmountFormatted = formatUSDC(campaign.raisedAmount);
  const remainingAmount = formatUSDC((campaign.goalAmount - campaign.raisedAmount).toString());
  const isExpiredCampaign = isExpired(Number(campaign.deadline));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Fund Campaign</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Campaign Info */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-white mb-2">{campaign.title}</h3>
          <div className="space-y-1 text-sm text-gray-300">
            <div className="flex justify-between">
              <span>Goal:</span>
              <span>{goalAmountFormatted} USDC</span>
            </div>
            <div className="flex justify-between">
              <span>Raised:</span>
              <span>{raisedAmountFormatted} USDC</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span>{remainingAmount} USDC</span>
            </div>
            <div className="flex justify-between">
              <span>Progress:</span>
              <span>{getProgressPercentage(campaign.raisedAmount, campaign.goalAmount).toFixed(1)}%</span>
            </div>
            {isExpiredCampaign && (
              <div className="text-red-400 font-semibold">⚠️ Campaign Expired</div>
            )}
          </div>
        </div>

        {/* Contract Address Warning */}
        {!isContractAddressValid && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
            <div className="text-red-200 text-sm">
              <div className="font-semibold mb-1">⚠️ Configuration Error</div>
              <div className="mb-2">Contract address not configured properly!</div>
              <div className="text-xs text-red-300">
                Please create <code>frontend/.env.local</code> and add:<br/>
                <code>NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address</code>
              </div>
            </div>
          </div>
        )}

        {isExpiredCampaign ? (
          <div className="text-center">
            <p className="text-red-400 mb-4">This campaign has expired and can no longer receive contributions.</p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {step === 'amount' && (
              <div className="space-y-4">
                {/* Funding Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Funding Method
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFundingMethod('local')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${
                        fundingMethod === 'local' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Local ({network.name})
                    </button>
                    <button
                      onClick={() => setFundingMethod('crosschain')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${
                        fundingMethod === 'crosschain' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Cross-Chain
                    </button>
                  </div>
                </div>

                {/* Chain Selection for Cross-Chain */}
                {fundingMethod === 'crosschain' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Source Chain
                      </label>
                      <select
                        value={selectedChain.id}
                        onChange={(e) => {
                          console.log("🔄 Dropdown changed - selected value:", e.target.value);
                          console.log("🔄 Current selectedChain before update:", selectedChain.name);
                          const chainId = parseInt(e.target.value);
                          console.log("🔄 Parsed chain ID:", chainId);
                          const chain = CCTP_V2_CHAINS.find(c => c.id === chainId);
                          console.log("🔄 Found chain:", chain?.name || "Not found");
                          if (chain) {
                            setSelectedChain(chain);
                            console.log("✅ Updated selectedChain to:", chain.name);
                          } else {
                            console.error("❌ Chain not found for ID:", chainId);
                          }
                        }}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CCTP_V2_CHAINS.map(chain => (
                          <option key={chain.id} value={chain.id}>
                            {chain.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Destination Chain
                      </label>
                      <input
                        type="text"
                        value={destinationChain.name}
                        readOnly
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-gray-400"
                      />
                    </div>

                    {/* Resume Transfer for Cross-Chain */}
                    <div className="p-3 bg-blue-900 rounded">
                      <div className="text-sm text-blue-100 mb-2">
                        Resume previous transfer?
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={resumeTxHash}
                          onChange={(e) => setResumeTxHash(e.target.value)}
                          placeholder="Enter transaction hash..."
                          className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          disabled={isSubmitting || loading}
                        />
                        <button
                          onClick={handleResumeTransfer}
                          disabled={!resumeTxHash || isSubmitting || loading}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* User Balance */}
                <div className="p-3 bg-gray-700 rounded">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">Your USDC Balance:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">
                        {balanceLoading ? 'Loading...' : `${usdcBalance} USDC`}
                        {fundingMethod === 'crosschain' && ` on ${selectedChain.name}`}
                        {fundingMethod === 'local' && ` on ${network.name}`}
                      </span>
                      <button
                        onClick={() => checkUSDCBalance(true)}
                        disabled={balanceLoading}
                        className="text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Refresh balance"
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                  {fundingMethod === 'crosschain' && !hasUSDC && fundingAvailable && (
                    <div className="mt-2 text-xs text-blue-300">
                      💳 Use Privy to purchase USDC: pay with card, Apple Pay, Google Pay, external wallets, exchanges, or bank transfers
                    </div>
                  )}
                  {!fundingAvailable && (
                    <div className="mt-2 text-xs text-yellow-300">
                      ⚠️ Wallet funding not enabled. Enable funding methods in Privy Dashboard → User management → Account funding
                    </div>
                  )}
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount (USDC)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100"
                    min="0.01"
                    step="0.01"
                    disabled={isSubmitting || loading}
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex gap-2">
                  {['10', '50', '100', remainingAmount].map((quickAmount) => {
                    const amountNum = parseFloat(quickAmount);
                    const balanceNum = parseFloat(usdcBalance);
                    const isAffordable = amountNum <= balanceNum && amountNum > 0;
                    
                    return (
                      <button
                        key={quickAmount}
                        onClick={() => setAmount(quickAmount)}
                        disabled={!isAffordable || isSubmitting || loading}
                        className={`px-3 py-1 text-xs rounded ${
                          isAffordable 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {quickAmount}
                      </button>
                    );
                  })}
                </div>

                {/* Approval Info (Local only) */}
                {fundingMethod === 'local' && amount && parseFloat(amount) > 0 && (
                  <div className="p-3 bg-yellow-900 rounded text-yellow-100 text-sm">
                    {needsApproval ? (
                      <div>
                        <p>⚠️ You need to approve USDC spending first.</p>
                        <p className="text-xs mt-1">Current allowance: {userAllowance} USDC</p>
                      </div>
                    ) : (
                      <p>✅ USDC spending approved</p>
                    )}
                  </div>
                )}

                {/* Error Display */}
                {contractError && (
                  <div className="bg-red-900 text-red-100 p-3 rounded">
                    {contractError}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
                    disabled={isSubmitting || loading}
                  >
                    Cancel
                  </button>
                  
                  {/* Privy Funding Button - Always available for topping up */}
                  <button
                    onClick={handleOnRamp}
                    disabled={loading || balanceLoading || !fundingAvailable}
                    className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                      fundingAvailable 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-600'
                    }`}
                    title={
                      !fundingAvailable 
                        ? 'Wallet funding not enabled in Privy Dashboard - Enable pay with card, external wallets, exchanges, and bank transfers' 
                        : `Fund with Privy (card, Apple Pay, Google Pay, external wallets, exchanges, banks) on ${fundingMethod === 'crosschain' ? selectedChain.name : destinationChain.name}`
                    }
                  >
                    <span>{fundingAvailable ? '💳' : '⚠️'}</span>
                    <span>{loading ? 'Funding...' : fundingAvailable ? 'Fund Wallet' : 'Not Enabled'}</span>
                  </button>
                  
                  {fundingMethod === 'local' && needsApproval ? (
                    <button
                      onClick={handleApprove}
                      disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                      className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {approvalStep ? 'Approving...' : 'Approve USDC'}
                    </button>
                  ) : (
                    <button
                      onClick={handleNextStep}
                      disabled={isSubmitting || loading || !amount || parseFloat(amount) <= 0 || balanceLoading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting || loading ? 'Processing...' : 
                       fundingMethod === 'local' ? 'Contribute' : 
                       'Fund Campaign'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-300">Processing cross-chain transfer...</p>
                {transferStatus && (
                  <p className="text-sm text-blue-400">{transferStatus}</p>
                )}
                {txHash && (
                  <div className="text-sm text-green-400">
                    Transaction Hash: 
                    <a 
                      href={`${selectedChain.explorerUrl}/tx/${txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 underline"
                    >
                      View on Explorer
                    </a>
                  </div>
                )}
                {transferStatus.includes('Waiting for attestation') && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setStep('amount');
                        setLoading(false);
                        setTransferStatus('');
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
                    >
                      Cancel
                    </button>
                    <p className="text-xs text-gray-400 mt-2">
                      Note: Your USDC has been burned. You can come back later to complete the transfer.
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 'attestation' && (
              <div className="text-center space-y-4">
                <div className="text-green-400">
                  <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white">Attestation Received!</h3>
                <p className="text-sm text-gray-300">
                  Your USDC has been burned on {selectedChain.name}. 
                  Click below to complete the transfer on {destinationChain.name}.
                </p>
                <button
                  onClick={completeTransfer}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Completing..." : "Complete Transfer"}
                </button>
              </div>
            )}

            {step === 'complete' && (
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-sm text-gray-300">Completing transfer on destination chain...</p>
                {transferStatus && (
                  <p className="text-sm text-green-400">{transferStatus}</p>
                )}
              </div>
            )}

            {step === 'success' && (
              <div className="text-center space-y-4">
                <div className="text-green-400">
                  <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white">Cross-Chain Transfer Complete!</h3>
                <div className="text-sm text-gray-300 space-y-2">
                  <p>
                    {amount} USDC has been successfully transferred to your wallet on {destinationChain.name}.
                  </p>
                  <div className="p-3 bg-blue-900 rounded-lg">
                    <p className="text-blue-100 font-medium">Next Step:</p>
                    <p className="text-blue-200 text-xs mt-1">
                      Switch to &ldquo;Local&rdquo; funding method to contribute the USDC to this campaign.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStep('amount');
                      setFundingMethod('local');
                      setTransferStatus('');
                    }}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Contribute Now
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {transferStatus && step !== 'success' && step !== 'processing' && step !== 'complete' && (
              <div className="mt-4 p-3 bg-blue-900 rounded-lg">
                <p className="text-sm text-blue-100">{transferStatus}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 