"use client";
import React, { useEffect, useState } from "react";
import { usePrivy, useLogin, useUser } from "@privy-io/react-auth";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { user } = useUser();
  const [selfVerified, setSelfVerified] = useState(false);

  // Placeholder: Simulate Self Protocol verification
  useEffect(() => {
    if (authenticated && !selfVerified) {
      // TODO: Integrate Self Protocol SDK here
      setTimeout(() => setSelfVerified(true), 1000); // Simulate async verification
    }
  }, [authenticated, selfVerified]);

  if (!ready) {
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

  if (!selfVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h2 className="text-2xl font-bold">Identity Verification</h2>
        <p>Verifying your identity with Self Protocol...</p>
        {/* TODO: Add real Self Protocol verification UI */}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <h1 className="text-3xl font-bold">ChainCrowdFund</h1>
      <p className="text-lg">Welcome, {user?.email?.address || user?.wallet?.address}</p>
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
  );
}
