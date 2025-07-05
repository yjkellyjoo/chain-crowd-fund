"use client";
import React, { useState } from "react";
import { useLogin, useLogout, useConnectWallet, useWallets } from "@privy-io/react-auth";
import SelfVerification from "./components/SelfVerification";
import CreateCampaign from "./components/CreateCampaign";
import { useAuthAndVerification, handleVerificationSuccess, handleLogout } from "./hooks/useAuthAndVerification";
import { useContract } from "./hooks/useContract";

export default function Home() {
  const { login } = useLogin();
  const { logout } = useLogout();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();
  const { isReady, isAuthenticated, isVerified, isLoading, user } = useAuthAndVerification(false);
  const { network, isWalletConnected } = useContract();
  const [localIsVerified, setLocalIsVerified] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle login with wallet connection
  const handleLoginWithWallet = async () => {
    setIsConnecting(true);
    try {
      // First login with Privy
      login();
      // Note: login() opens a modal, we'll handle wallet connection in useEffect
    } catch (error) {
      console.error('Login failed:', error);
      setIsConnecting(false);
    }
  };

  // Auto-connect wallet after successful login
  React.useEffect(() => {
    const connectWalletAfterLogin = async () => {
      if (isAuthenticated && isReady && !isWalletConnected && isConnecting) {
        try {
          await connectWallet();
          console.log('Wallet connected successfully after login');
        } catch (error) {
          console.error('Failed to connect wallet after login:', error);
        } finally {
          setIsConnecting(false);
        }
      }
    };

    connectWalletAfterLogin();
  }, [isAuthenticated, isReady, isWalletConnected, isConnecting, connectWallet]);

  // Handle successful verification
  const handleVerificationComplete = (userIdentifier: string) => {
    handleVerificationSuccess(user, userIdentifier, wallets[0]?.address);
    setLocalIsVerified(true);
  };

  // Handle logout - clear verification status  
  const handleLogoutClick = () => {
    handleLogout(user, logout, wallets[0]?.address);
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
          className="bg-white text-black px-6 py-2 rounded font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleLoginWithWallet}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Login & Connect Wallet'}
        </button>
        <p className="text-sm text-gray-400 max-w-md text-center">
          This will connect your Privy account and crypto wallet in one step
        </p>
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
              {user?.email?.address || wallets[0]?.address || 'No wallet connected'}
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
          {!isWalletConnected && (
            <div className="mb-6 p-4 bg-yellow-900 border border-yellow-600 rounded-lg text-center max-w-md">
              <p className="text-yellow-200 text-sm">
                💳 Setting up your wallet connection...
              </p>
              <p className="text-yellow-300 text-xs mt-1">
                If wallet connection fails, please refresh and try again.
              </p>
            </div>
          )}
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
              {user?.email?.address || wallets[0]?.address || 'No wallet connected'}
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
        <p className="text-lg">Welcome, {user?.email?.address || wallets[0]?.address || 'User'}</p>
        
        {/* Contract Status */}
        <div className="text-center">
          <p className="text-sm text-green-400 mb-2">✅ Identity Verified</p>
          <div className="text-sm">
            <p className="text-green-400">🌐 Network: {network.name}</p>
            {isWalletConnected ? (
              <p className="text-green-400">💳 Wallet Connected</p>
            ) : (
              <p className="text-yellow-400">💳 Wallet not connected - please refresh and login again</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            onClick={() => setShowCreateCampaign(true)}
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

        {/* Get Test Tokens Link */}
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-2">Need test USDC?</p>
          <a
            href="https://faucet.arbitrum.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline text-sm"
          >
            Get Arbitrum Sepolia ETH →
          </a>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateCampaign && (
        <CreateCampaign
          onClose={() => setShowCreateCampaign(false)}
          onSuccess={() => {
            // Optionally refresh campaigns data
            console.log('Campaign created successfully!');
          }}
        />
      )}
    </div>
  );
}
