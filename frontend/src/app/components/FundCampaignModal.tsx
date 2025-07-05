"use client";
import React, { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { useContract } from "../hooks/useContract";
import { Campaign } from "../lib/contract";
import { cctpService, CCTP_V2_CHAINS, CCTPChain, TransferRequest } from "../lib/cctp";

// Types for ethereum provider
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface FundCampaignModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

export function FundCampaignModal({ campaign, onClose, onSuccess }: FundCampaignModalProps) {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const { 
    contribute, 
    approveUSDC, 
    userBalance, 
    userAllowance, 
    error: contractError,
    formatUSDC,
    isExpired,
    network
  } = useContract();

  // State for both cross-chain and local contributions
  const [amount, setAmount] = useState("");
  const [fundingMethod, setFundingMethod] = useState<'local' | 'crosschain'>('local');
  const [selectedChain, setSelectedChain] = useState<CCTPChain>(CCTP_V2_CHAINS[0]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'amount' | 'processing' | 'attestation' | 'complete' | 'success'>('amount');
  const [hasUSDC, setHasUSDC] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [transferStatus, setTransferStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [attestationData, setAttestationData] = useState<{message: string, attestation: string} | null>(null);
  
  // Local contribution state (from ContributeCampaign)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalStep, setApprovalStep] = useState(false);

  // Destination chain - where the crowdfunding contract is deployed
  const destinationChain = CCTP_V2_CHAINS.find(chain => chain.id === network.chainId) || CCTP_V2_CHAINS[0];
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x1234567890123456789012345678901234567890";

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
      if (fundingMethod === 'local') {
        // For local contributions, use the contract's balance check
        setUsdcBalance(parseFloat(userBalance).toFixed(2));
        setHasUSDC(parseFloat(userBalance) > 0);
      } else {
        // For cross-chain, use CCTP balance check
        console.log(`Checking USDC balance for wallet: ${wallet.address} on ${selectedChain.name}`);
        const balance = await cctpService.getUSDCBalance(selectedChain.id, wallet.address);
        console.log(`USDC Balance: ${balance} USDC`);
        setUsdcBalance(parseFloat(balance).toFixed(2));
        setHasUSDC(parseFloat(balance) > 0);
      }
    } catch (error) {
      console.error("Error checking USDC balance:", error);
      setUsdcBalance("0");
      setHasUSDC(false);
    } finally {
      setBalanceLoading(false);
    }
  }, [selectedChain, wallets, fundingMethod, userBalance]);

  useEffect(() => {
    if (ready && wallets && wallets.length > 0) {
      checkUSDCBalance();
    }
  }, [ready, wallets, selectedChain, checkUSDCBalance, fundingMethod]);

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
    setLoading(true);
    try {
      setTransferStatus("Initiating on-ramp process...");
      alert("Please use the Privy on-ramp to get USDC tokens, then try again.");
      setLoading(false);
    } catch (error) {
      console.error("On-ramp error:", error);
      setTransferStatus("On-ramp failed. Please try again.");
      setLoading(false);
    }
  };

  const handleCrossChainFunding = async () => {
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

  const goalAmountFormatted = formatUSDC(campaign.goalAmount);
  const raisedAmountFormatted = formatUSDC(campaign.raisedAmount);
  const remainingAmount = formatUSDC(campaign.goalAmount - campaign.raisedAmount);
  const isExpiredCampaign = isExpired(campaign.deadline);

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
              <span>{((Number(campaign.raisedAmount) / Number(campaign.goalAmount)) * 100).toFixed(1)}%</span>
            </div>
            {isExpiredCampaign && (
              <div className="text-red-400 font-semibold">⚠️ Campaign Expired</div>
            )}
          </div>
        </div>

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
                          const chain = CCTP_V2_CHAINS.find(c => c.id === parseInt(e.target.value));
                          if (chain) setSelectedChain(chain);
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
                  </>
                )}

                {/* User Balance */}
                <div className="p-3 bg-gray-700 rounded">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Your USDC Balance:</span>
                    <span className="text-white font-semibold">
                      {balanceLoading ? 'Loading...' : `${usdcBalance} USDC`}
                      {fundingMethod === 'crosschain' && ` on ${selectedChain.name}`}
                    </span>
                  </div>
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
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
                    disabled={isSubmitting || loading}
                  >
                    Cancel
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
                       !hasUSDC ? "Get USDC & Fund" : "Fund Campaign"}
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
                <h3 className="font-semibold text-white">Success!</h3>
                <p className="text-sm text-gray-300">
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