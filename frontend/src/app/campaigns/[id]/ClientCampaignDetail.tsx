"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallets } from "@privy-io/react-auth";
import { FundCampaignModal } from "../../components/FundCampaignModal";
import { useAuthAndVerification } from "../../hooks/useAuthAndVerification";

// Mock campaign data - in real app, this would come from your backend
const mockCampaigns = [
  {
    id: 1,
    title: "Clean Water Initiative",
    description: "Providing clean water access to rural communities. This project aims to install water purification systems in 5 villages, serving over 2,000 people. We will work with local communities to ensure sustainable maintenance and operation.",
    goal: 50000,
    raised: 32000,
    creator: "0x1234...5678",
    creatorName: "WaterCorp Foundation",
    image: "/api/placeholder/600/400",
    deadline: "2026-03-15",
    category: "Environment",
    backers: 127,
    updates: [
      { date: "2024-01-15", title: "Project Started", content: "Initial site survey completed" },
      { date: "2024-01-10", title: "Funding Milestone", content: "Reached 50% of funding goal!" }
    ]
  },
  {
    id: 2,
    title: "Educational Technology Hub",
    description: "Building a tech education center for underprivileged youth. This center will provide coding bootcamps, digital literacy training, and mentorship programs to help young people develop skills for the modern economy.",
    goal: 75000,
    raised: 45000,
    creator: "0x8765...4321",
    creatorName: "TechForAll Initiative",
    image: "/api/placeholder/600/400",
    deadline: "2024-02-28",
    category: "Education",
    backers: 89,
    updates: [
      { date: "2024-01-20", title: "Location Secured", content: "Found perfect location in downtown area" }
    ]
  },
  {
    id: 3,
    title: "Solar Power Project",
    description: "Installing solar panels for sustainable energy solutions. This project will install 500 solar panels across 3 communities, providing clean energy to 1,000 households and reducing carbon emissions by 200 tons annually.",
    goal: 100000,
    raised: 78000,
    creator: "0xabcd...efgh",
    creatorName: "GreenEnergy Solutions",
    image: "/api/placeholder/600/400",
    deadline: "2024-04-10",
    category: "Energy",
    backers: 203,
    updates: [
      { date: "2024-01-25", title: "Permits Approved", content: "All regulatory approvals obtained" },
      { date: "2024-01-12", title: "Community Meeting", content: "Successful town hall meeting" }
    ]
  }
];

interface ClientCampaignDetailProps {
  params: {
    id: string;
  };
}

export default function ClientCampaignDetail({ params }: ClientCampaignDetailProps) {
  const router = useRouter();
  const { isReady, isAuthenticated, isVerified, isLoading } = useAuthAndVerification(true);
  const { wallets } = useWallets();
  const [campaign, setCampaign] = useState<typeof mockCampaigns[0] | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [showFundModal, setShowFundModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'updates' | 'backers'>('description');

  useEffect(() => {
    // Only proceed if authentication is complete
    if (isReady && isAuthenticated && isVerified) {
      console.log('=== Campaign Detail Page Debug ===');
      console.log('Loading campaign ID:', params.id);
      
      // Find campaign by ID
      const campaignId = parseInt(params.id);
      const foundCampaign = mockCampaigns.find(c => c.id === campaignId);
      
      console.log('Found campaign:', foundCampaign);
      setCampaign(foundCampaign || null);
      setCampaignLoading(false);
    }
  }, [isReady, isAuthenticated, isVerified, params?.id]);

  // Handle campaign not found after loading is complete
  useEffect(() => {
    if (!campaignLoading && !campaign) {
      console.log('Campaign not found, redirecting to /campaigns');
      router.push("/campaigns");
    }
  }, [campaign, campaignLoading, router]);

  const getProgressPercentage = (raised: number, goal: number) => {
    return Math.min((raised / goal) * 100, 100);
  };

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleFundClick = () => {
    if (!wallets || wallets.length === 0) {
      alert("Please connect a wallet first");
      return;
    }
    setShowFundModal(true);
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
              <p className="text-gray-400">
                by <span className="text-blue-400">{campaign.creatorName}</span>
              </p>
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
                  {campaign.updates.map((update, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                      <h3 className="font-semibold text-white">{update.title}</h3>
                      <p className="text-sm text-gray-400 mb-2">{update.date}</p>
                      <p className="text-gray-300">{update.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'backers' && (
                <div className="space-y-4">
                  <p className="text-gray-300">{campaign.backers} backers supporting this campaign</p>
                  <div className="text-sm text-gray-400">
                    Individual backer information would be displayed here in a real application.
                  </div>
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
                    ${campaign.raised.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-400">
                    of ${campaign.goal.toLocaleString()} goal
                  </span>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage(campaign.raised, campaign.goal)}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{getProgressPercentage(campaign.raised, campaign.goal).toFixed(1)}% funded</span>
                  <span>{getDaysRemaining(campaign.deadline)} days to go</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{campaign.backers}</div>
                  <div className="text-sm text-gray-400">Backers</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{getDaysRemaining(campaign.deadline)}</div>
                  <div className="text-sm text-gray-400">Days Left</div>
                </div>
              </div>

              {/* Fund Button */}
              <button
                onClick={handleFundClick}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors mb-4"
              >
                Fund This Campaign
              </button>

              {/* Campaign Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Category:</span>
                  <span className="text-white">{campaign.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Created by:</span>
                  <span className="text-white">{campaign.creator}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Deadline:</span>
                  <span className="text-white">
                    {new Date(campaign.deadline).toLocaleDateString()}
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
          onSuccess={() => {
            setShowFundModal(false);
            // In a real app, you would refresh the campaign data here
          }}
        />
      )}
    </div>
  );
} 