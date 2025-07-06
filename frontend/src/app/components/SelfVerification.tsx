"use client";

import React, { useState, useEffect } from 'react';
import { SelfQRcodeWrapper, SelfAppBuilder } from '@selfxyz/qrcode';
import { v4 as uuidv4 } from 'uuid';
import VerificationDenied from './VerificationDenied';

interface SelfVerificationProps {
  onSuccess: (userIdentifier: string) => void;
}

type DenialReason = 'age' | 'ofac' | 'country' | 'unknown';

export default function SelfVerification({ onSuccess }: SelfVerificationProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [denialReason, setDenialReason] = useState<DenialReason | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Generate a user ID when the component mounts
    setUserId(uuidv4());
  }, []);

  const parseDenialReason = (errorMessage: string): DenialReason => {
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('age requirement not met') || lowerError.includes('minimum age')) {
      return 'age';
    }
    if (lowerError.includes('ofac sanctions check failed') || lowerError.includes('sanctions')) {
      return 'ofac';
    }
    if (lowerError.includes('excluded countries') || lowerError.includes('geographic restriction')) {
      return 'country';
    }
    return 'unknown';
  };

  const handleVerificationError = (error: unknown) => {
    console.error('Self Protocol verification failed:', error);
    
    // Try to extract error message from the error object
    let errorMessage = 'Unknown error';
    if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    } else if (error && typeof error === 'object' && 'error' in error) {
      errorMessage = String((error as { error: unknown }).error);
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    setVerificationError(errorMessage);
    setDenialReason(parseDenialReason(errorMessage));
  };

  const handleRetry = () => {
    setIsRetrying(true);
    setVerificationError(null);
    setDenialReason(null);
    
    // Generate a new user ID for retry
    setUserId(uuidv4());
    
    // Reset retry state after a short delay
    setTimeout(() => {
      setIsRetrying(false);
    }, 1000);
  };

  const handleContactSupport = () => {
    // Open support email or redirect to support page
    const supportEmail = "support@chaincrowdfund.com";
    const subject = `Identity Verification Issue - ${denialReason}`;
    const body = `Hello,

I encountered an issue with identity verification on ChainCrowdFund.

Error details:
- Reason: ${denialReason}
- Error message: ${verificationError}
- User ID: ${userId}

Please assist me with this issue.

Thank you.`;

    window.open(`mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  // Show denial interface if verification failed
  if (denialReason) {
    return (
      <VerificationDenied
        reason={denialReason}
        onRetry={denialReason === 'unknown' ? handleRetry : undefined}
        onContactSupport={handleContactSupport}
      />
    );
  }

  if (!userId) {
    return <div className="flex items-center justify-center">Generating verification...</div>;
  }

  // Create the SelfApp configuration
  const selfApp = new SelfAppBuilder({
    appName: "ChainCrowdFund",
    scope: "chain-crowd-fund-scope",
    endpoint: process.env.NEXT_PUBLIC_SITE_URL + '/api/verify' || 'http://localhost:3000/api/verify',
    userId,
    userDefinedData: "jfklds",
    disclosures: {
      minimumAge: 18,
      excludedCountries: ['IRN', 'PRK'],
      ofac: true,
      name: true,
      nationality: true,
      date_of_birth: true, 
    },
    version: 2,
  }).build();

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-2xl font-bold text-white">Identity Verification</h2>
      <p className="text-gray-300 text-center max-w-md">
        Scan this QR code with the Self app to verify your identity. This step is required to prevent fraud and ensure platform safety.
      </p>
      
      {isRetrying && (
        <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-4 mb-4">
          <p className="text-blue-400 text-center">Generating new verification request...</p>
        </div>
      )}
      
      <div className="bg-white p-4 rounded-lg">
        <SelfQRcodeWrapper
          selfApp={selfApp}
          onSuccess={() => {
            console.log('Self Protocol verification successful!');
            onSuccess(userId);
          }}
          onError={handleVerificationError}
          size={300}
        />
      </div>
      
      <div className="text-center">
        <p className="text-sm text-gray-400">
          User ID: {userId.substring(0, 8)}...
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Don&apos;t have the Self app? <a href="https://www.self.xyz/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Download here</a>
        </p>
      </div>
      
      {verificationError && !denialReason && (
        <div className="bg-red-900/30 border border-red-600/30 rounded-lg p-4 mt-4">
          <p className="text-red-400 text-center mb-2">Verification failed</p>
          <p className="text-sm text-gray-300 text-center">{verificationError}</p>
          <button
            onClick={handleRetry}
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors block mx-auto"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
} 