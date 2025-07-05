"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthAndVerification } from "../hooks/useAuthAndVerification";

// Mock campaign data - in real app, this would come from your backend
const mockCampaigns = [
  {
    id: 1,
    title: "Clean Water Initiative",
    description: "Providing clean water access to rural communities",
    goal: 50000,
    raised: 32000,
    creator: "0x1234...5678",
    image: "/api/placeholder/400/300",
    deadline: "2024-03-15",
    category: "Environment"
  },
  {
    id: 2,
    title: "Educational Technology Hub",
    description: "Building a tech education center for underprivileged youth",
    goal: 75000,
    raised: 45000,
    creator: "0x8765...4321",
    image: "/api/placeholder/400/300",
    deadline: "2024-02-28",
    category: "Education"
  },
  {
    id: 3,
    title: "Solar Power Project",
    description: "Installing solar panels for sustainable energy solutions",
    goal: 100000,
    raised: 78000,
    creator: "0xabcd...efgh",
    image: "/api/placeholder/400/300",
    deadline: "2024-04-10",
    category: "Energy"
  }
];

export default function CampaignsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, isVerified, isLoading } = useAuthAndVerification(true);
  const [campaigns] = useState(mockCampaigns);
  const [campaignLoading, setCampaignLoading] = useState(true);

  // Simulate campaign loading
  React.useEffect(() => {
    if (isReady && isAuthenticated && isVerified) {
      console.log('✅ All checks passed, loading campaigns');
      setTimeout(() => {
        console.log('✅ Campaigns loaded');
        setCampaignLoading(false);
      }, 1000);
    }
  }, [isReady, isAuthenticated, isVerified]);

  const handleCampaignClick = (campaignId: number) => {
    router.push(`/campaigns/${campaignId}`);
  };

  const getProgressPercentage = (raised: number, goal: number) => {
    return Math.min((raised / goal) * 100, 100);
  };

  if (!isReady || isLoading || campaignLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>{!isReady ? 'Initializing...' : 'Loading campaigns...'}</p>
        </div>
      </div>
    );
  }

  // If not authenticated or verified, the hook will handle redirects
  if (!isAuthenticated || !isVerified) {
    return null;
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
                      {getProgressPercentage(campaign.raised, campaign.goal).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(campaign.raised, campaign.goal)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Funding Stats */}
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <span className="text-gray-400">Raised: </span>
                    <span className="text-white font-semibold">
                      ${campaign.raised.toLocaleString()} USDC
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Goal: </span>
                    <span className="text-white font-semibold">
                      ${campaign.goal.toLocaleString()} USDC
                    </span>
                  </div>
                </div>

                {/* Deadline */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">
                    Deadline: {new Date(campaign.deadline).toLocaleDateString()}
                  </span>
                  <span className="text-gray-400">
                    By: {campaign.creator}
                  </span>
                </div>
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
    </div>
  );
} 