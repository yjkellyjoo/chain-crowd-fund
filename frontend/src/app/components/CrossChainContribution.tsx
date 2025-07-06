'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import { cctpService, CCTPChain, CCTP_V2_CHAINS, TransferRequest } from '../lib/cctp';

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface CrossChainContributionProps {
  campaignId: number;
  goalAmount: string;
  raisedAmount: string;
  deadline: number;
  isCompleted: boolean;
  contractAddress: string;
  onContributionSuccess: () => void;
}

export default function CrossChainContribution({
  goalAmount,
  raisedAmount,
  deadline,
  isCompleted,
  contractAddress,
  onContributionSuccess
}: Omit<CrossChainContributionProps, 'campaignId'>) {
  const { wallets } = useWallets();
  const [selectedSourceChain, setSelectedSourceChain] = useState<CCTPChain | null>(null);
  const [selectedDestinationChain, setSelectedDestinationChain] = useState<CCTPChain | null>(null);
  const [amount, setAmount] = useState('');
  const [userAddress, setUserAddress] = useState<string>('');
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [txHash, setTxHash] = useState<string>('');
  const [attestationData, setAttestationData] = useState<{message: string, attestation: string} | null>(null);

  // Get embedded Privy wallet specifically
  const getEmbeddedWallet = useCallback(() => {
    return wallets.find(wallet => wallet.walletClientType === 'privy');
  }, [wallets]);

  // Transfer steps
  const steps = [
    'Connect Wallet',
    'Select Chains',
    'Enter Amount', 
    'Approve USDC',
    'Burn USDC',
    'Get Attestation',
    'Complete Transfer'
  ];

  useEffect(() => {
    // Initialize with default destination chain (where contract is deployed)
    // For this example, we'll use Base Sepolia as the destination
    const destinationChain = CCTP_V2_CHAINS.find(chain => chain.id === 84532); // Base Sepolia
    if (destinationChain) {
      setSelectedDestinationChain(destinationChain);
    }
  }, []);

  useEffect(() => {
    // Auto-connect embedded wallet if available
    const embeddedWallet = getEmbeddedWallet();
    if (embeddedWallet && embeddedWallet.address) {
      setUserAddress(embeddedWallet.address);
      setCurrentStep(1);
    }
  }, [getEmbeddedWallet]);

  useEffect(() => {
    if (userAddress) {
      loadBalances();
    }
  }, [userAddress]);

  const connectWallet = async () => {
    try {
      const embeddedWallet = getEmbeddedWallet();
      if (!embeddedWallet) {
        throw new Error('Embedded wallet not found');
      }
      
      const provider = await embeddedWallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      
      setUserAddress(address);
      cctpService.setSigner(signer);
      setCurrentStep(1);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setTransferStatus('Failed to connect wallet');
    }
  };

  const loadBalances = async () => {
    try {
      const newBalances: Record<number, string> = {};
      
      for (const chain of CCTP_V2_CHAINS) {
        try {
          const balance = await cctpService.getUSDCBalance(chain.id, userAddress);
          newBalances[chain.id] = balance;
        } catch (error) {
          console.error(`Failed to load balance for ${chain.name}:`, error);
          newBalances[chain.id] = '0';
        }
      }
      
      setBalances(newBalances);
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  const handleTransfer = async () => {
    if (!selectedSourceChain || !selectedDestinationChain || !amount || !userAddress) {
      setTransferStatus('Please fill in all fields');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setTransferStatus('Amount must be greater than 0');
      return;
    }

    if (parseFloat(amount) > parseFloat(balances[selectedSourceChain.id] || '0')) {
      setTransferStatus('Insufficient balance');
      return;
    }

    setLoading(true);
    setTransferStatus('Starting cross-chain transfer...');

    try {
      // Step 1: Check if we need to switch networks
      const embeddedWallet = getEmbeddedWallet();
      if (!embeddedWallet) {
        throw new Error('Embedded wallet not found');
      }
      
      const provider = await embeddedWallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const currentNetwork = await ethersProvider.getNetwork();
      
      if (currentNetwork.chainId !== BigInt(selectedSourceChain.id)) {
        setTransferStatus('Switching to source chain...');
        try {
          await embeddedWallet.switchChain(selectedSourceChain.id);
        } catch (switchError: unknown) {
          setTransferStatus('Failed to switch to source chain');
          throw switchError;
        }
      }

      setCurrentStep(3);
      setTransferStatus('Checking USDC allowance...');

      // Create transfer request
      const transferRequest: TransferRequest = {
        amount: amount,
        sourceChain: selectedSourceChain,
        destinationChain: selectedDestinationChain,
        recipient: contractAddress, // Send to the crowdfunding contract
        fast: selectedSourceChain.fast,
        destinationCaller: contractAddress, // Allow contract to be called
        maxFee: '0.0005' // 0.0005 USDC max fee for fast transfers
      };

      setCurrentStep(4);
      setTransferStatus('Burning USDC on source chain...');

      // Execute the cross-chain transfer
      const result = await cctpService.crossChainTransfer(transferRequest);
      
      if (!result.success) {
        throw new Error(result.error || 'Transfer failed');
      }

      setTxHash(result.txHash);
      setCurrentStep(5);
      setTransferStatus('Transfer initiated! Waiting for attestation...');

      // Store attestation data for manual completion if needed
      if (result.attestation && result.messageHash) {
        setAttestationData({
          message: result.messageHash,
          attestation: result.attestation
        });
        setCurrentStep(6);
        setTransferStatus('Attestation received! Ready to complete transfer on destination chain.');
      }

    } catch (error) {
      console.error('Transfer failed:', error);
      setTransferStatus(error instanceof Error ? error.message : 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const completeTransfer = async () => {
    if (!attestationData || !selectedDestinationChain) {
      setTransferStatus('Missing attestation data');
      return;
    }

    setLoading(true);
    setTransferStatus('Completing transfer on destination chain...');

    try {
      // Switch to destination chain
      await (window.ethereum as unknown as EthereumProvider).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${selectedDestinationChain.id.toString(16)}` }],
      });

      // Complete the transfer
      const result = await cctpService.completeTransfer(
        attestationData.message,
        attestationData.attestation,
        selectedDestinationChain.id
      );

      if (result.success) {
        setCurrentStep(7);
        setTransferStatus('Cross-chain contribution completed successfully!');
        onContributionSuccess();
      } else {
        throw new Error(result.error || 'Failed to complete transfer');
      }
    } catch (error) {
      console.error('Failed to complete transfer:', error);
      setTransferStatus(error instanceof Error ? error.message : 'Failed to complete transfer');
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <p className="text-gray-600">This campaign has been completed.</p>
      </div>
    );
  }

  if (Date.now() > deadline * 1000) {
    return (
      <div className="bg-red-100 p-4 rounded-lg">
        <p className="text-red-600">This campaign has ended.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h3 className="text-2xl font-bold mb-6 text-center">Cross-Chain Contribution</h3>
      
      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center ${
                index < currentStep ? 'text-green-600' : 
                index === currentStep ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index < currentStep ? 'bg-green-100' : 
                index === currentStep ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-1 mx-2 ${
                  index < currentStep ? 'bg-green-200' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-600 text-center">
          {steps[currentStep]}
        </div>
      </div>

      {/* Connect Wallet */}
      {!userAddress && (
        <div className="text-center">
          <button
            onClick={connectWallet}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Main Form */}
      {userAddress && (
        <div className="space-y-4">
          {/* Source Chain Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">From Chain:</label>
            <select
              value={selectedSourceChain?.id || ''}
              onChange={(e) => {
                const chain = CCTP_V2_CHAINS.find(c => c.id === parseInt(e.target.value));
                setSelectedSourceChain(chain || null);
                setCurrentStep(Math.max(currentStep, 2));
              }}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select source chain</option>
              {CCTP_V2_CHAINS.map(chain => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} - Balance: {balances[chain.id] || '0'} USDC
                </option>
              ))}
            </select>
          </div>

          {/* Destination Chain (Read-only) */}
          <div>
            <label className="block text-sm font-medium mb-2">To Chain:</label>
            <input
              type="text"
              value={selectedDestinationChain?.name || ''}
              readOnly
              className="w-full p-3 border rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Amount (USDC):</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setCurrentStep(Math.max(currentStep, 3));
              }}
              placeholder="Enter amount"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selectedSourceChain && (
              <p className="text-sm text-gray-500 mt-1">
                Available: {balances[selectedSourceChain.id] || '0'} USDC
              </p>
            )}
          </div>

          {/* Campaign Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Campaign Status:</h4>
            <div className="text-sm text-gray-600">
              <p>Goal: {goalAmount} USDC</p>
              <p>Raised: {raisedAmount} USDC</p>
              <p>Progress: {((parseFloat(raisedAmount) / parseFloat(goalAmount)) * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Transfer Button */}
          {!attestationData && (
            <button
              onClick={handleTransfer}
              disabled={loading || !selectedSourceChain || !selectedDestinationChain || !amount}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Start Cross-Chain Transfer'}
            </button>
          )}

          {/* Complete Transfer Button */}
          {attestationData && (
            <button
              onClick={completeTransfer}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Completing...' : 'Complete Transfer on Destination Chain'}
            </button>
          )}

          {/* Status */}
          {transferStatus && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">{transferStatus}</p>
            </div>
          )}

          {/* Transaction Hash */}
          {txHash && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">
                Transaction Hash: 
                <a 
                  href={`${selectedSourceChain?.explorerUrl}/tx/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 underline"
                >
                  {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 