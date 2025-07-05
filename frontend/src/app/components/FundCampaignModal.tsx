"use client";
import React, { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";

// CCTP V2 supported testnet chains with RPC endpoints
const SUPPORTED_CHAINS = [
  { 
    id: 11155111, 
    name: "Ethereum Sepolia", 
    symbol: "ETH", 
    domain: 0,
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_URL || "https://sepolia.gateway.tenderly.co",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  },
  { 
    id: 421614, 
    name: "Arbitrum Sepolia", 
    symbol: "ETH", 
    domain: 3,
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_URL || "https://arbitrum-sepolia.gateway.tenderly.co",
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
  },
  { 
    id: 84532, 
    name: "Base Sepolia", 
    symbol: "ETH", 
    domain: 6,
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_URL || "https://base-sepolia.drpc.org",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  },
  { 
    id: 43113, 
    name: "Avalanche Fuji", 
    symbol: "AVAX", 
    domain: 1,
    rpcUrl: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_URL || "https://avalanche-fuji.drpc.org",
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65"
  },
  { 
    id: 80002, 
    name: "Polygon Amoy", 
    symbol: "POL", 
    domain: 7,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_AMOY_URL || "https://polygon-amoy.drpc.org",
    usdcAddress: "0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97"
  },
  { 
    id: 11155420, 
    name: "OP Sepolia", 
    symbol: "OP", 
    domain: 2,
    rpcUrl: process.env.NEXT_PUBLIC_OP_SEPOLIA_URL || "https://optimism-sepolia.drpc.org",
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"
  },
  { 
    id: 59140, 
    name: "Linea Sepolia", 
    symbol: "ETH", 
    domain: 9,
    rpcUrl: process.env.NEXT_PUBLIC_LINEA_SEPOLIA_URL || "https://linea-sepolia.drpc.org",
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"
  },
  { 
    id: 1301, 
    name: "Unichain Sepolia", 
    symbol: "ETH", 
    domain: 10,
    rpcUrl: process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_URL || "https://unichain-sepolia.drpc.org",
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" // USDC on Unichain Sepolia
  },
  { 
    id: 4801, 
    name: "World Chain Sepolia", 
    symbol: "ETH", 
    domain: 11,
    rpcUrl: process.env.NEXT_PUBLIC_WORLD_CHAIN_SEPOLIA_URL || "https://worldchain-sepolia.drpc.org",
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" // USDC on World Chain Sepolia
  }
];

// ERC20 ABI for USDC balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

interface Campaign {
  id: number;
  title: string;
  description: string;
  goal: number;
  raised: number;
  creator: string;
  creatorName: string;
  image: string;
  deadline: string;
  category: string;
  backers: number;
  updates: Array<{ date: string; title: string; content: string }>;
}

interface FundCampaignModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

export function FundCampaignModal({ campaign, onClose, onSuccess }: FundCampaignModalProps) {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const [amount, setAmount] = useState("");
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'amount' | 'chain' | 'processing' | 'success'>('amount');
  const [hasUSDC, setHasUSDC] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState("0");

  const checkUSDCBalance = useCallback(async () => {
    // Get first available wallet
    const getEthereumWallet = () => {
      if (!wallets || wallets.length === 0) return null;
      console.log("Available wallets:", wallets);
      return wallets[0];
    };

    const wallet = getEthereumWallet();
    if (!wallet) {
      console.log("No Ethereum wallet found");
      return;
    }
    
    setBalanceLoading(true);
    try {
      console.log(`Checking USDC balance for wallet: ${wallet.address} on ${selectedChain.name}`);
      
      const provider = new ethers.JsonRpcProvider(selectedChain.rpcUrl);
      const usdcContract = new ethers.Contract(
        selectedChain.usdcAddress,
        ERC20_ABI,
        provider
      );
      
      const balance = await usdcContract.balanceOf(wallet.address);
      const decimals = await usdcContract.decimals();
      
      const formattedBalance = ethers.formatUnits(balance, decimals);
      
      console.log(`USDC Balance: ${formattedBalance} USDC`);
      
      setUsdcBalance(parseFloat(formattedBalance).toFixed(2));
      setHasUSDC(parseFloat(formattedBalance) > 0);
      
    } catch (error) {
      console.error("Error checking USDC balance:", error);
      setUsdcBalance("0");
      setHasUSDC(false);
    } finally {
      setBalanceLoading(false);
    }
  }, [selectedChain, wallets]);

  useEffect(() => {
    if (ready && wallets && wallets.length > 0) {
      checkUSDCBalance();
    }
  }, [ready, wallets, selectedChain, checkUSDCBalance]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimal points
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleNextStep = () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (parseFloat(amount) > parseFloat(usdcBalance)) {
      alert("Insufficient USDC balance");
      return;
    }
    if (!hasUSDC) {
      // Trigger Privy on-ramp
      handleOnRamp();
    } else {
      handleFunding();
    }
  };

  const handleOnRamp = async () => {
    setLoading(true);
    try {
      // In a real implementation, you would integrate with Privy's on-ramp
      // For now, we'll simulate the on-ramp process
      console.log("Initiating on-ramp process...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // After on-ramp, refresh the balance
      await checkUSDCBalance();
      
      if (parseFloat(usdcBalance) >= parseFloat(amount)) {
        alert("On-ramp successful! You can now fund the campaign.");
      } else {
        alert("Please ensure you have sufficient USDC balance and try again.");
      }
    } catch (error) {
      console.error("On-ramp error:", error);
      alert("On-ramp failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFunding = async () => {
    setLoading(true);
    setStep('processing');
    
    try {
      // Step 1: Burn USDC on source chain
      await burnUSDC();
      
      // Step 2: Get attestation from Circle
      const attestation = await getAttestation();
      
      // Step 3: Mint USDC on destination chain (campaign's chain)
      await mintUSDC(attestation);
      
      setStep('success');
      
      // Close modal after a delay
      setTimeout(() => {
        onSuccess();
      }, 2000);
      
    } catch (error) {
      console.error("Funding error:", error);
      alert("Funding failed. Please try again.");
      setStep('chain');
    } finally {
      setLoading(false);
    }
  };

  const burnUSDC = async () => {
    // In a real implementation, you would call the CCTP V2 contract to burn USDC
    console.log(`Burning ${amount} USDC on ${selectedChain.name}...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const getAttestation = async () => {
    // In a real implementation, you would fetch the attestation from Circle's API
    console.log("Getting attestation from Circle...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    return "mock_attestation_signature";
  };

  const mintUSDC = async (attestation: string) => {
    // In a real implementation, you would call the CCTP V2 contract to mint USDC
    console.log(`Minting ${amount} USDC on destination chain with attestation: ${attestation}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const wallet = wallets?.[0] || null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Fund Campaign</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Campaign Info */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-white mb-1">{campaign.title}</h3>
          <p className="text-sm text-gray-400">by {campaign.creatorName}</p>
        </div>

        {/* Wallet Info */}
        {wallet && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-400">Wallet Address:</p>
            <p className="text-xs text-white font-mono">{wallet.address}</p>
          </div>
        )}

        {step !== 'processing' && step !== 'success' && (
          <div className="space-y-4">
            {/* Network Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Network
              </label>
              <select
                value={selectedChain.id}
                onChange={(e) => {
                  const newChain = SUPPORTED_CHAINS.find(c => c.id === parseInt(e.target.value))!;
                  setSelectedChain(newChain);
                }}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name} ({chain.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount (USDC)
              </label>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="Enter amount"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div className="flex justify-between text-sm text-gray-400">
              <span>Minimum: $1 USDC</span>
              <span>Available: {balanceLoading ? "Loading..." : `${usdcBalance} USDC`}</span>
            </div>

            {/* USDC Balance Info */}
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">USDC Balance:</span>
                <span className="text-white font-semibold">
                  {balanceLoading ? "Loading..." : `${usdcBalance} USDC`}
                </span>
              </div>
              
              {!hasUSDC && (
                <div className="mt-3 p-3 bg-orange-900 bg-opacity-30 rounded-lg">
                  <p className="text-sm text-orange-300">
                    You need USDC to fund this campaign. We&apos;ll help you get some!
                  </p>
                </div>
              )}

              {hasUSDC && parseFloat(amount) > parseFloat(usdcBalance) && (
                <div className="mt-3 p-3 bg-red-900 bg-opacity-30 rounded-lg">
                  <p className="text-sm text-red-300">
                    Insufficient balance. You need {amount} USDC but only have {usdcBalance} USDC.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white font-semibold mb-2">Processing Transaction</p>
            <p className="text-sm text-gray-400">
              Using Circle&apos;s CCTP V2 for secure cross-chain transfer...
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-2">Funding Successful!</p>
            <p className="text-sm text-gray-400">
              Your ${amount} USDC contribution has been processed.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {step !== 'processing' && step !== 'success' && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleNextStep}
              disabled={loading || !amount || parseFloat(amount) <= 0 || (hasUSDC && parseFloat(amount) > parseFloat(usdcBalance))}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Processing..." : hasUSDC ? "Fund Campaign" : "Get USDC"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 