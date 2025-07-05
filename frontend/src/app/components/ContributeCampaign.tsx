"use client";
import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';
import { Campaign } from '../lib/contract';

interface ContributeCampaignProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContributeCampaign({ campaign, onClose, onSuccess }: ContributeCampaignProps) {
  const { 
    contribute, 
    approveUSDC, 
    userBalance, 
    userAllowance, 
    isLoading, 
    error,
    formatUSDC,
    isExpired
  } = useContract();
  
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalStep, setApprovalStep] = useState(false);

  // Check if approval is needed when amount changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const amountNum = parseFloat(amount);
      const allowanceNum = parseFloat(userAllowance);
      setNeedsApproval(amountNum > allowanceNum);
    } else {
      setNeedsApproval(false);
    }
  }, [amount, userAllowance]);

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

  const handleContribute = async () => {
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

  const goalAmountFormatted = formatUSDC(campaign.goalAmount);
  const raisedAmountFormatted = formatUSDC(campaign.raisedAmount);
  const remainingAmount = formatUSDC(campaign.goalAmount - campaign.raisedAmount);
  const isExpiredCampaign = isExpired(campaign.deadline);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Fund Campaign</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
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
            {isExpiredCampaign && (
              <div className="text-red-400 font-semibold">⚠️ Campaign Expired</div>
            )}
          </div>
        </div>

        {/* User Balance */}
        <div className="mb-4 p-3 bg-gray-700 rounded">
          <div className="flex justify-between text-sm">
            <span className="text-gray-300">Your USDC Balance:</span>
            <span className="text-white font-semibold">{userBalance} USDC</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 text-red-100 p-3 rounded mb-4">
            {error}
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
          <div className="space-y-4">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Contribution Amount (USDC)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100"
                min="0.01"
                step="0.01"
                disabled={isSubmitting}
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2">
              {['10', '50', '100', remainingAmount].map((quickAmount) => {
                const amountNum = parseFloat(quickAmount);
                const balanceNum = parseFloat(userBalance);
                const isAffordable = amountNum <= balanceNum && amountNum > 0;
                
                return (
                  <button
                    key={quickAmount}
                    onClick={() => setAmount(quickAmount)}
                    disabled={!isAffordable || isSubmitting}
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

            {/* Approval Info */}
            {amount && parseFloat(amount) > 0 && (
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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              
              {needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approvalStep ? 'Approving...' : 'Approve USDC'}
                </button>
              ) : (
                <button
                  onClick={handleContribute}
                  disabled={isSubmitting || !amount || parseFloat(amount) <= 0 || isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Contributing...' : 'Contribute'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 