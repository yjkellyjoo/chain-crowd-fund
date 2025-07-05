"use client";
import React, { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { cctpService, CCTP_V2_CHAINS, CCTPChain, TransferRequest } from "../lib/cctp";

// Types for ethereum provider
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

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
  const [selectedChain, setSelectedChain] = useState<CCTPChain>(CCTP_V2_CHAINS[0]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'amount' | 'chain' | 'processing' | 'attestation' | 'complete' | 'success'>('amount');
  const [hasUSDC, setHasUSDC] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [transferStatus, setTransferStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [attestationData, setAttestationData] = useState<{message: string, attestation: string} | null>(null);

  // Destination chain - where the crowdfunding contract is deployed
  const destinationChain = CCTP_V2_CHAINS.find(chain => chain.id === 84532) || CCTP_V2_CHAINS[2]; // Base Sepolia
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x1234567890123456789012345678901234567890";

  const checkUSDCBalance = useCallback(async () => {
    const getEthereumWallet = () => {
      if (!wallets || wallets.length === 0) return null;
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
      
      const balance = await cctpService.getUSDCBalance(selectedChain.id, wallet.address);
      
      console.log(`USDC Balance: ${balance} USDC`);
      
      setUsdcBalance(parseFloat(balance).toFixed(2));
      setHasUSDC(parseFloat(balance) > 0);
      
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
      handleOnRamp();
    } else {
      handleFunding();
    }
  };

  const handleOnRamp = async () => {
    setLoading(true);
    try {
      setTransferStatus("Initiating on-ramp process...");
      // In a real implementation, you would integrate with Privy's on-ramp
      // For now, we'll provide instructions
      alert("Please use the Privy on-ramp to get USDC tokens, then try again.");
      setLoading(false);
    } catch (error) {
      console.error("On-ramp error:", error);
      setTransferStatus("On-ramp failed. Please try again.");
      setLoading(false);
    }
  };

  const handleFunding = async () => {
    const wallet = wallets?.[0];
    if (!wallet) {
      alert("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setStep('processing');
    
    try {
      // Set up the signer
      if (!window.ethereum) {
        throw new Error("No ethereum provider found");
      }
      const provider = new ethers.BrowserProvider(window.ethereum as unknown as EthereumProvider);
      const signer = await provider.getSigner();
      cctpService.setSigner(signer);

      // Check if we need to switch networks
      const currentNetwork = await provider.getNetwork();
      if (currentNetwork.chainId !== BigInt(selectedChain.id)) {
        setTransferStatus("Please switch to the source chain in your wallet...");
        try {
          await (window.ethereum as unknown as EthereumProvider).request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${selectedChain.id.toString(16)}` }],
          });
        } catch (switchError: unknown) {
          if (switchError && typeof switchError === 'object' && 'code' in switchError && switchError.code === 4902) {
            setTransferStatus("Please add the source chain to your wallet");
            return;
          }
          throw switchError;
        }
      }

      setTransferStatus("Initiating cross-chain transfer...");

      // Create transfer request
      const transferRequest: TransferRequest = {
        amount: amount,
        sourceChain: selectedChain,
        destinationChain: destinationChain,
        recipient: contractAddress,
        fast: selectedChain.fast,
        destinationCaller: contractAddress,
        maxFee: '0.0005'
      };

      // Execute the cross-chain transfer
      const result = await cctpService.crossChainTransfer(transferRequest);
      
      if (!result.success) {
        throw new Error(result.error || 'Transfer failed');
      }

      setTxHash(result.txHash);
      setTransferStatus("Transfer initiated! Waiting for attestation...");

      // Store attestation data
      if (result.attestation && result.messageHash) {
        setAttestationData({
          message: result.messageHash,
          attestation: result.attestation
        });
        setStep('attestation');
        setTransferStatus("Attestation received! Ready to complete transfer.");
      }

    } catch (error) {
      console.error("Cross-chain transfer error:", error);
      setTransferStatus(error instanceof Error ? error.message : "Transfer failed");
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

    setLoading(true);
    setStep('complete');
    setTransferStatus("Completing transfer on destination chain...");

    try {
      // Switch to destination chain
      if (!window.ethereum) {
        throw new Error("No ethereum provider found");
      }
      await (window.ethereum as unknown as EthereumProvider).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${destinationChain.id.toString(16)}` }],
      });

      // Complete the transfer
      const result = await cctpService.completeTransfer(
        attestationData.message,
        attestationData.attestation,
        destinationChain.id
      );

      if (result.success) {
        setStep('success');
        setTransferStatus("Cross-chain contribution completed successfully!");
        onSuccess();
      } else {
        throw new Error(result.error || 'Failed to complete transfer');
      }
    } catch (error) {
      console.error("Failed to complete transfer:", error);
      setTransferStatus(error instanceof Error ? error.message : "Failed to complete transfer");
      setStep('attestation');
    } finally {
      setLoading(false);
    }
  };



  const isDeadlinePassed = new Date(campaign.deadline) < new Date();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Fund Campaign</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-lg mb-2">{campaign.title}</h3>
            <div className="text-sm text-gray-600 mb-4">
              <p>Goal: ${campaign.goal.toLocaleString()}</p>
              <p>Raised: ${campaign.raised.toLocaleString()}</p>
              <p>Progress: {((campaign.raised / campaign.goal) * 100).toFixed(1)}%</p>
            </div>
          </div>

          {isDeadlinePassed && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              This campaign has ended.
            </div>
          )}

          {!isDeadlinePassed && (
            <>
              {step === 'amount' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Source Chain
                    </label>
                    <select
                      value={selectedChain.id}
                      onChange={(e) => {
                        const chain = CCTP_V2_CHAINS.find(c => c.id === parseInt(e.target.value));
                        if (chain) setSelectedChain(chain);
                      }}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {CCTP_V2_CHAINS.map(chain => (
                        <option key={chain.id} value={chain.id}>
                          {chain.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Destination Chain
                    </label>
                    <input
                      type="text"
                      value={destinationChain.name}
                      readOnly
                      className="w-full p-3 border rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Amount (USDC)
                    </label>
                    <input
                      type="text"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="Enter amount"
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-2 text-sm text-gray-600">
                      {balanceLoading ? (
                        <p>Loading balance...</p>
                      ) : (
                        <p>Available: {usdcBalance} USDC on {selectedChain.name}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleNextStep}
                    disabled={!amount || parseFloat(amount) <= 0 || balanceLoading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {!hasUSDC ? "Get USDC & Fund" : "Fund Campaign"}
                  </button>
                </div>
              )}

              {step === 'processing' && (
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-600">Processing cross-chain transfer...</p>
                  {transferStatus && (
                    <p className="text-sm text-blue-600">{transferStatus}</p>
                  )}
                  {txHash && (
                    <div className="text-sm text-green-600">
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
                </div>
              )}

              {step === 'attestation' && (
                <div className="text-center space-y-4">
                  <div className="text-green-600">
                    <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Attestation Received!</h3>
                  <p className="text-sm text-gray-600">
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
                  <p className="text-sm text-gray-600">Completing transfer on destination chain...</p>
                  {transferStatus && (
                    <p className="text-sm text-green-600">{transferStatus}</p>
                  )}
                </div>
              )}

              {step === 'success' && (
                <div className="text-center space-y-4">
                  <div className="text-green-600">
                    <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold">Success!</h3>
                  <p className="text-sm text-gray-600">
                    Your cross-chain contribution of {amount} USDC has been completed successfully!
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}

              {transferStatus && step !== 'success' && step !== 'processing' && step !== 'complete' && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">{transferStatus}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 