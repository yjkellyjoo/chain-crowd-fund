"use client";
import React, { useState, useCallback } from "react";
import { useLogin, useLogout, useWallets } from "@privy-io/react-auth";
import SelfVerification from "./components/SelfVerification";
import CreateCampaign from "./components/CreateCampaign";
import { useAuthAndVerification, handleVerificationSuccess, handleLogout } from "./hooks/useAuthAndVerification";
import { useContract } from "./hooks/useContract";

export default function Home() {
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const { isReady, isAuthenticated, isVerified, isLoading, user } = useAuthAndVerification(false);
  const { network, isWalletConnected } = useContract();
  const [localIsVerified, setLocalIsVerified] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);

  // Get embedded Privy wallet specifically
  const getEmbeddedWallet = useCallback(() => {
    return wallets.find(wallet => wallet.walletClientType === 'privy');
  }, [wallets]);

  // Simple login handler - embedded wallet will be created automatically
  const handleLogin = async () => {
    try {
      login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Handle successful verification
  const handleVerificationComplete = (userIdentifier: string) => {
    const embeddedWallet = getEmbeddedWallet();
    handleVerificationSuccess(user, userIdentifier, embeddedWallet?.address);
    setLocalIsVerified(true);
    // Print wallet address to console
    if (embeddedWallet?.address) {
      console.log('=== Embedded Wallet Address ===');
      console.log('Wallet Address:', embeddedWallet.address);
    }
  };

  // Handle logout - clear verification status  
  const handleLogoutClick = () => {
    const embeddedWallet = getEmbeddedWallet();
    handleLogout(user, logout, embeddedWallet?.address);
    setLocalIsVerified(false);
  };

  // Update local state when hook verification changes
  React.useEffect(() => {
    setLocalIsVerified(isVerified);
    // Print detailed wallet information when verified
    const embeddedWallet = getEmbeddedWallet();
    if (isVerified && embeddedWallet) {
      console.log('=== User Verified & Embedded Wallet Ready ===');
      console.log('Wallet:', {
        address: embeddedWallet.address,
        imported: embeddedWallet.imported,
        walletClientType: embeddedWallet.walletClientType
      });
    }
  }, [isVerified, getEmbeddedWallet]);

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
          onClick={handleLogin}
        >
          Login with Email
        </button>
        <p className="text-sm text-gray-400 max-w-md text-center">
          An embedded wallet will be created automatically for you after login
        </p>
      </div>
    );
  }

  // Show verification screen if authenticated but not verified
  if (!localIsVerified) {
    const embeddedWallet = getEmbeddedWallet();
    
    return (
      <div className="min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h1 className="text-2xl font-bold">ChainCrowdFund</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              {embeddedWallet?.address && (
                <div>
                  <span className="text-xs text-gray-500">Wallet:</span><br/>
                  <span className="font-mono">{embeddedWallet.address}</span>
                </div>
              )}
              {user?.email?.address && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Email:</span><br/>
                  <span>{user.email.address}</span>
                </div>
              )}
            </div>
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

  const embeddedWallet = getEmbeddedWallet();

  return (
    <div className="min-h-screen">
      {/* Header with Account Button */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold">ChainCrowdFund</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {embeddedWallet?.address && (
              <div>
                <span className="text-xs text-gray-500">Wallet:</span><br/>
                <span className="font-mono">{embeddedWallet.address}</span>
              </div>
            )}
            {user?.email?.address && (
              <div className="mt-1">
                <span className="text-xs text-gray-500">Email:</span><br/>
                <span>{user.email.address}</span>
              </div>
            )}
          </div>
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
        <p className="text-lg">Welcome, {user?.email?.address || 'User'}</p>
        
        {/* Contract Status */}
        <div className="text-center">
          <p className="text-sm text-green-400 mb-2">✅ Identity Verified</p>
          <div className="text-sm">
            <p className="text-green-400">🌐 Network: {network.name}</p>
            {isWalletConnected ? (
              <p className="text-green-400">💳 Embedded Wallet Ready</p>
            ) : (
              <p className="text-yellow-400">💳 Wallet not ready - please refresh and login again</p>
            )}
          </div>
        </div>

        {/* Wallet Info */}
        <div className="text-center p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Your Embedded Wallet</h3>
          <div className="text-sm text-gray-300">
            {embeddedWallet && (
              <div className="space-y-1">
                <p><strong>Address:</strong> <span className="font-mono">{embeddedWallet.address}</span></p>
                <p><strong>Network:</strong> {network.name}</p>
                <div className="mt-2 p-2 bg-green-900 rounded text-green-200">
                  <p className="text-xs">✅ Embedded wallet ready for use</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => setShowCreateCampaign(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded font-semibold hover:bg-blue-700 transition-colors"
          >
            Create Campaign
          </button>
          <button
            onClick={() => window.location.href = '/campaigns'}
            className="bg-gray-600 text-white px-6 py-3 rounded font-semibold hover:bg-gray-700 transition-colors"
          >
            View Campaigns
          </button>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full mx-4">
            <CreateCampaign 
              onClose={() => setShowCreateCampaign(false)}
              onSuccess={() => {
                setShowCreateCampaign(false);
                console.log('Campaign created successfully!');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
