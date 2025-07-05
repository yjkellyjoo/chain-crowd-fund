"use client";

import React, { useState, useEffect } from 'react';
import { SelfQRcodeWrapper, SelfAppBuilder } from '@selfxyz/qrcode';
import { v4 as uuidv4 } from 'uuid';

interface SelfVerificationProps {
  onSuccess: (userIdentifier: string) => void;
}

export default function SelfVerification({ onSuccess }: SelfVerificationProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Generate a user ID when the component mounts
    setUserId(uuidv4());
  }, []);

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
      
      <div className="bg-white p-4 rounded-lg">
        <SelfQRcodeWrapper
          selfApp={selfApp}
          onSuccess={() => {
            console.log('Self Protocol verification successful!');
            onSuccess(userId);
          }}
          onError={(error) => {
            console.error('Self Protocol verification failed:', error);
          }}
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
    </div>
  );
} 