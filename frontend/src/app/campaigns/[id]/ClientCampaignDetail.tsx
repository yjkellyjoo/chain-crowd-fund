"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallets } from "@privy-io/react-auth";
import { useContract } from "../../hooks/useContract";
import { Campaign, Contribution } from "../../lib/contract";
import { FundCampaignModal } from "../../components/FundCampaignModal";
import { useAuthAndVerification } from "../../hooks/useAuthAndVerification";

interface ClientCampaignDetailProps {
  params: {
    id: string;
  };
}

export default function ClientCampaignDetail({ params }: ClientCampaignDetailProps) {
  const router = useRouter();
  const { isReady, isAuthenticated, isVerified, isLoading } = useAuthAndVerification(true);
  const { wallets } = useWallets();
  const { 
    formatUSDC, 
    formatDeadline, 
    isExpired, 
    getProgressPercentage, 
    getCampaignContributions
  } = useContract();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [contributionsLoading, setContributionsLoading] = useState(true);
  const [showFundModal, setShowFundModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'updates' | 'backers'>('description');
  const [error, setError] = useState<string | null>(null);

  // Fetch campaign data
  useEffect(() => {
    if (isReady && isAuthenticated && isVerified) {
      loadCampaign();
    }
  }, [isReady, isAuthenticated, isVerified, params?.id]);

  // Load contributions when campaign is loaded and backers tab is active
  useEffect(() => {
    if (campaign && activeTab === 'backers' && contributionsLoading) {
      loadContributions();
    }
  }, [campaign, activeTab, contributionsLoading]);

  const loadCampaign = async () => {
    try {
      setCampaignLoading(true);
      setError(null);
      
      const campaignId = parseInt(params.id);
      if (isNaN(campaignId)) {
        throw new Error('Invalid campaign ID');
      }

      // Import the service dynamically to avoid SSR issues
      const { chainCrowdFundService } = await import('../../lib/contract');
      const campaignData = await chainCrowdFundService.getCampaign(campaignId);
      
      setCampaign(campaignData);
    } catch (err) {
      console.error('Failed to load campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setCampaignLoading(false);
    }
  };

  const loadContributions = async () => {
    if (!campaign) return;
    
    try {
      setContributionsLoading(true);
      const contributionsData = await getCampaignContributions(campaign.id);
      setContributions(contributionsData);
    } catch (err) {
      console.error('Failed to load contributions:', err);
      // Don't show error for contributions, just log it
    } finally {
      setContributionsLoading(false);
    }
  };

  // Handle campaign not found after loading is complete
  useEffect(() => {
    if (!campaignLoading && !campaign && !error) {
      router.push("/campaigns");
    }
  }, [campaign, campaignLoading, router, error]);

  const handleFundClick = () => {
    if (!wallets || wallets.length === 0) {
      alert("Please connect a wallet first");
      return;
    }
    setShowFundModal(true);
  };

  const handleFundSuccess = () => {
    setShowFundModal(false);
    // Reload campaign data after successful funding
    loadCampaign();
    if (activeTab === 'backers') {
      loadContributions();
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isReady || isLoading || campaignLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{!isReady ? 'Initializing...' : 'Loading campaign...'}</p>
        </div>
      </div>
    );
  }

  // If not authenticated or verified, the hook will handle redirects
  if (!isAuthenticated || !isVerified) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl mb-4 text-red-400">Error: {error}</p>
          <div className="space-x-4">
            <button
              onClick={() => loadCampaign()}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/campaigns")}
              className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
            >
              Back to Campaigns
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl mb-4">Campaign not found</p>
          <button
            onClick={() => router.push("/campaigns")}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Back to Campaigns
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
            onClick={() => router.push("/campaigns")}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to Campaigns
          </button>
          <h1 className="text-2xl font-bold">Campaign Details</h1>
        </div>
      </div>

      {/* Campaign Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Image */}
            <div className="w-full h-80 bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-gray-400">Campaign Image</span>
            </div>

            {/* Campaign Title & Creator */}
            <div>
              <h1 className="text-3xl font-bold mb-2">{campaign.title}</h1>
              <div className="flex items-center gap-4">
                <p className="text-gray-400">
                  by <span className="text-blue-400">{shortenAddress(campaign.creator)}</span>
                </p>
                <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                  {campaign.category}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-700">
              <nav className="flex space-x-8">
                {[
                  { id: 'description', label: 'Description' },
                  { id: 'updates', label: 'Updates' },
                  { id: 'backers', label: 'Backers' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'description' | 'updates' | 'backers')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="py-6">
              {activeTab === 'description' && (
                <div className="space-y-4">
                  <p className="text-gray-300 leading-relaxed">
                    {campaign.description}
                  </p>
                </div>
              )}

              {activeTab === 'updates' && (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <p className="text-gray-400">No updates available yet.</p>
                    <p className="text-sm text-gray-500 mt-2">Check back later for project updates!</p>
                  </div>
                </div>
              )}

              {activeTab === 'backers' && (
                <div className="space-y-4">
                  {contributionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mr-3"></div>
                      <span>Loading backers...</span>
                    </div>
                  ) : contributions.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-gray-300">{contributions.length} contributions supporting this campaign</p>
                      <div className="space-y-3">
                        {contributions.map((contribution, index) => (
                          <div key={index} className="bg-gray-800 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-white font-semibold">
                                  {shortenAddress(contribution.contributor)}
                                </p>
                                <p className="text-sm text-gray-400">
                                  {new Date(Number(contribution.timestamp) * 1000).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-green-400 font-semibold">
                                  {formatUSDC(contribution.amount)} USDC
                                </p>
                                {contribution.isCrossChain && (
                                  <p className="text-xs text-blue-400">Cross-chain</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No backers yet.</p>
                      <p className="text-sm text-gray-500 mt-2">Be the first to support this campaign!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Funding Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 sticky top-6">
              {/* Progress */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-white">
                    {formatUSDC(campaign.raisedAmount)} USDC
                  </span>
                  <span className="text-sm text-gray-400">
                    of {formatUSDC(campaign.goalAmount)} USDC goal
                  </span>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage(campaign.raisedAmount, campaign.goalAmount)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{getProgressPercentage(campaign.raisedAmount, campaign.goalAmount).toFixed(1)}% funded</span>
                  <span className={isExpired(campaign.deadline) ? 'text-red-400' : ''}>
                    {isExpired(campaign.deadline) ? 'Expired' : formatDeadline(campaign.deadline)}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{contributions.length}</div>
                  <div className="text-sm text-gray-400">Backers</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {isExpired(campaign.deadline) ? 'Expired' : formatDeadline(campaign.deadline)}
                  </div>
                  <div className="text-sm text-gray-400">
                    {isExpired(campaign.deadline) ? 'Campaign Ended' : 'Time Left'}
                  </div>
                </div>
              </div>

              {/* Fund Button */}
              {!campaign.isCompleted && !isExpired(campaign.deadline) && (
                <button
                  onClick={handleFundClick}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors mb-4"
                >
                  Fund This Campaign
                </button>
              )}

              {/* Campaign Status */}
              {(campaign.isCompleted || isExpired(campaign.deadline)) && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg text-center">
                  <p className="text-sm text-gray-300">
                    {campaign.isCompleted ? 'Campaign Completed' : 'Campaign Expired'}
                  </p>
                </div>
              )}

              {/* Campaign Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Category:</span>
                  <span className="text-white">{campaign.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Created by:</span>
                  <span className="text-white">{shortenAddress(campaign.creator)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Deadline:</span>
                  <span className="text-white">
                    {formatDeadline(campaign.deadline)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`text-white ${campaign.isCompleted ? 'text-green-400' : isExpired(campaign.deadline) ? 'text-red-400' : 'text-blue-400'}`}>
                    {campaign.isCompleted ? 'Completed' : isExpired(campaign.deadline) ? 'Expired' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fund Campaign Modal */}
      {showFundModal && (
        <FundCampaignModal
          campaign={campaign}
          onClose={() => setShowFundModal(false)}
          onSuccess={handleFundSuccess}
        />
      )}
    </div>
  );
} 