"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthAndVerification } from "../hooks/useAuthAndVerification";
import { useContract } from "../hooks/useContract";
import { Campaign } from "../lib/contract";
import { FundCampaignModal } from "../components/FundCampaignModal";

export default function CampaignsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, isVerified, isLoading } = useAuthAndVerification(false);
  const { 
    campaigns, 
    isLoading: contractLoading, 
    error: contractError, 
    formatUSDC,
    formatDeadline,
    isExpired,
    getProgressPercentage,
    network
  } = useContract();
  
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showContributeModal, setShowContributeModal] = useState(false);

  // Check if user is on correct network
  React.useEffect(() => {
    if (contractError?.includes('network')) {
      setNetworkError(contractError);
    }
  }, [contractError]);

  const handleCampaignClick = (campaignId: number) => {
    router.push(`/campaigns/${campaignId}`);
  };

  const handleContributeClick = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to campaign details
    setSelectedCampaign(campaign);
    setShowContributeModal(true);
  };

  const handleContributeSuccess = () => {
    // Campaign data will be automatically refreshed by the hook
    setShowContributeModal(false);
    setSelectedCampaign(null);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isReady || isLoading || contractLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{!isReady ? 'Initializing...' : contractLoading ? 'Loading campaigns...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // If not authenticated or verified, the hook will handle redirects
  if (!isAuthenticated || !isVerified) {
    return null;
  }

  // Show network error if present
  if (networkError) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Network Error</h2>
          <p className="text-red-400 mb-4">{networkError}</p>
          <p className="text-gray-400 mb-4">Please switch to {network.name} to continue.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show contract error if present
  if (contractError && !networkError) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Contract Error</h2>
          <p className="text-red-400 mb-4">{contractError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to Home
          </button>
          <h1 className="text-2xl font-bold">Fund Campaigns</h1>
        </div>
      </div>

      {/* Campaign Grid */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => handleCampaignClick(campaign.id)}
              className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700"
            >
              {/* Campaign Image Placeholder */}
              <div className="w-full h-48 bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-gray-400">Campaign Image</span>
              </div>

              {/* Campaign Info */}
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-semibold">{campaign.title}</h3>
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                    {campaign.category}
                  </span>
                </div>
                
                <p className="text-gray-300 text-sm line-clamp-2">
                  {campaign.description}
                </p>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white">
                      {getProgressPercentage(campaign.raisedAmount, campaign.goalAmount).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(campaign.raisedAmount, campaign.goalAmount)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Funding Stats */}
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <span className="text-gray-400">Raised: </span>
                    <span className="text-white font-semibold">
                      {formatUSDC(campaign.raisedAmount)} USDC
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Goal: </span>
                    <span className="text-white font-semibold">
                      {formatUSDC(campaign.goalAmount)} USDC
                    </span>
                  </div>
                </div>

                {/* Deadline */}
                <div className="flex justify-between items-center text-sm">
                  <span className={`text-gray-400 ${isExpired(campaign.deadline) ? 'text-red-400' : ''}`}>
                    Deadline: {formatDeadline(campaign.deadline)}
                    {isExpired(campaign.deadline) && ' (Expired)'}
                  </span>
                  <span className="text-gray-400">
                    By: {shortenAddress(campaign.creator)}
                  </span>
                </div>

                {/* Contribute Button */}
                {!campaign.isCompleted && !isExpired(campaign.deadline) && (
                  <div className="mt-4 pt-3 border-t border-gray-600">
                    <button
                      onClick={(e) => handleContributeClick(campaign, e)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
                    >
                      Fund This Campaign
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No campaigns available at the moment.</p>
            <p className="text-gray-500 text-sm mt-2">Check back later for new funding opportunities!</p>
          </div>
        )}
      </div>

      {/* Contribute Modal */}
      {showContributeModal && selectedCampaign && (
        <FundCampaignModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowContributeModal(false);
            setSelectedCampaign(null);
          }}
          onSuccess={handleContributeSuccess}
        />
      )}
    </div>
  );
} 