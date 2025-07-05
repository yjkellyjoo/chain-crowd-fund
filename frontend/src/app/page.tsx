"use client";
import React, { useState } from "react";
import { useLogin, useLogout } from "@privy-io/react-auth";
import SelfVerification from "./components/SelfVerification";
import { useAuthAndVerification, handleVerificationSuccess, handleLogout } from "./hooks/useAuthAndVerification";

export default function Home() {
  const { login } = useLogin();
  const { logout } = useLogout();
  const { isReady, isAuthenticated, isVerified, isLoading, user } = useAuthAndVerification(false);
  const [localIsVerified, setLocalIsVerified] = useState(false);

  // Handle successful verification
  const handleVerificationComplete = (userIdentifier: string) => {
    handleVerificationSuccess(user, userIdentifier);
    setLocalIsVerified(true);
  };

  // Handle logout - clear verification status  
  const handleLogoutClick = () => {
    handleLogout(user, logout);
    setLocalIsVerified(false);
  };

  // Update local state when hook verification changes
  React.useEffect(() => {
    setLocalIsVerified(isVerified);
  }, [isVerified]);

  if (!isReady || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-3xl font-bold">Welcome to ChainCrowdFund</h1>
        <p className="text-lg">Decentralized Crowdfunding Platform</p>
        <button
          className="bg-white text-black px-6 py-2 rounded font-semibold hover:bg-gray-200"
          onClick={login}
        >
          Login with Privy
        </button>
      </div>
    );
  }

  // Show verification screen if authenticated but not verified
  if (!localIsVerified) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h1 className="text-2xl font-bold">ChainCrowdFund</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {user?.email?.address || user?.wallet?.address}
            </span>
            <button
              onClick={handleLogoutClick}
              className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Verification Content */}
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
          <SelfVerification onSuccess={handleVerificationComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header with Account Button */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold">ChainCrowdFund</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {user?.email?.address || user?.wallet?.address}
          </span>
          <button
            onClick={handleLogoutClick}
            className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] gap-8">
        <h2 className="text-3xl font-bold">Welcome to ChainCrowdFund</h2>
        <p className="text-lg">Welcome, {user?.email?.address || user?.wallet?.address}</p>
        <div className="text-center">
          <p className="text-sm text-green-400 mb-4">✅ Identity Verified</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => alert("Create Campaign feature coming soon!")}
            className="bg-white text-black px-6 py-2 rounded font-semibold hover:bg-gray-200"
          >
            Create Campaign
          </button>
          <button 
            onClick={() => {
              console.log('=== Fund Campaigns Button Clicked ===');
              console.log('Current verification status:', localIsVerified);
              console.log('About to navigate to /campaigns');
              window.location.href = '/campaigns';
            }}
            className="bg-white text-black px-6 py-2 rounded font-semibold hover:bg-gray-200"
          >
            Fund Campaigns
          </button>
        </div>
        {/* TODO: Render campaign list, creation, and funding UIs */}
      </div>
    </div>
  );
}
