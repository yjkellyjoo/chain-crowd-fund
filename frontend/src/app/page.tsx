"use client";
import React from "react";
import { usePrivy, useLogin, useLogout, useUser } from "@privy-io/react-auth";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { user } = useUser();

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
            onClick={logout}
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
