"use client";
import React, { useState, useEffect } from "react";
import { usePrivy, useLogin, useLogout, useUser } from "@privy-io/react-auth";
import SelfVerification from "./components/SelfVerification";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { user } = useUser();
  const [isVerified, setIsVerified] = useState(false);
  const [isLoadingVerification, setIsLoadingVerification] = useState(true);

  // Check verification status from localStorage on mount
  useEffect(() => {
    if (authenticated) {
      const verificationKey = `verified_${user?.wallet?.address || user?.email?.address}`;
      const stored = localStorage.getItem(verificationKey);
      setIsVerified(stored === 'true');
    }
    setIsLoadingVerification(false);
  }, [authenticated, user]);

  // Handle successful verification
  const handleVerificationSuccess = (userIdentifier: string) => {
    const verificationKey = `verified_${user?.wallet?.address || user?.email?.address}`;
    localStorage.setItem(verificationKey, 'true');
    localStorage.setItem(`verification_id_${user?.wallet?.address || user?.email?.address}`, userIdentifier);
    setIsVerified(true);
  };

  // Handle logout - clear verification status
  const handleLogout = () => {
    const verificationKey = `verified_${user?.wallet?.address || user?.email?.address}`;
    const verificationIdKey = `verification_id_${user?.wallet?.address || user?.email?.address}`;
    localStorage.removeItem(verificationKey);
    localStorage.removeItem(verificationIdKey);
    setIsVerified(false);
    logout();
  };

  if (!ready || isLoadingVerification) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!authenticated) {
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
  if (!isVerified) {
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
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Verification Content */}
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
          <SelfVerification onSuccess={handleVerificationSuccess} />
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
            onClick={handleLogout}
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
          <button className="bg-white text-black px-6 py-2 rounded font-semibold hover:bg-gray-200">
            Create Campaign
          </button>
          <button className="bg-white text-black px-6 py-2 rounded font-semibold hover:bg-gray-200">
            Fund Campaigns
          </button>
        </div>
        {/* TODO: Render campaign list, creation, and funding UIs */}
      </div>
    </div>
  );
}
