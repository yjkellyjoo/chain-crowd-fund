"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy, useUser, User, useWallets } from '@privy-io/react-auth';

interface AuthState {
  isReady: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  isLoading: boolean;
  user: User | null;
}

export function useAuthAndVerification(redirectOnFail: boolean = true): AuthState {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { user } = useUser();
  const { wallets } = useWallets();
  const [isVerified, setIsVerified] = useState(false);
  const [isLoadingVerification, setIsLoadingVerification] = useState(true);

  // Get embedded Privy wallet specifically
  const getEmbeddedWallet = useCallback(() => {
    return wallets.find(wallet => wallet.walletClientType === 'privy');
  }, [wallets]);

  useEffect(() => {
    console.log('=== Auth & Verification Hook Debug ===');
    console.log('ready:', ready);
    console.log('authenticated:', authenticated);
    console.log('user:', user);
    console.log('wallets:', wallets);
    console.log('embedded wallet:', getEmbeddedWallet());
    
    // Wait for Privy to be ready
    if (!ready) {
      console.log('⏳ Privy not ready yet, waiting...');
      return;
    }

    // Check authentication
    if (!authenticated) {
      console.log('❌ Not authenticated');
      if (redirectOnFail) {
        console.log('Redirecting to /');
        router.push('/');
      }
      setIsLoadingVerification(false);
      return;
    }
    console.log('✅ Authenticated with Privy');

    // Check Self verification
    if (user) {
      const embeddedWallet = getEmbeddedWallet();
      const userIdentifier = embeddedWallet?.address || user?.email?.address;
      const verificationKey = `verified_${userIdentifier}`;
      console.log('verificationKey:', verificationKey);
      const stored = localStorage.getItem(verificationKey);
      console.log('stored verification:', stored);
      const verified = stored === 'true';
      console.log('verified:', verified);
      
      setIsVerified(verified);
      
      if (!verified && redirectOnFail) {
        console.log('❌ Not verified, redirecting to /');
        router.push('/');
      } else if (verified) {
        console.log('✅ Self verification passed');
      }
    } else {
      console.log('❌ No user object');
      if (redirectOnFail) {
        console.log('Redirecting to /');
        router.push('/');
      }
    }
    
    setIsLoadingVerification(false);
    console.log('✅ Auth check completed');
  }, [ready, authenticated, user, getEmbeddedWallet, router, redirectOnFail]);

  return {
    isReady: ready,
    isAuthenticated: authenticated,
    isVerified,
    isLoading: isLoadingVerification,
    user
  };
}

// Helper function for handling verification success
export function handleVerificationSuccess(user: User | null, userIdentifier: string, walletAddress?: string) {
  console.log('=== Verification Success ===');
  console.log('userIdentifier:', userIdentifier);
  console.log('walletAddress:', walletAddress);
  console.log('user?.email?.address:', user?.email?.address);
  
  const userKey = walletAddress || user?.email?.address;
  const verificationKey = `verified_${userKey}`;
  console.log('Setting verification key:', verificationKey);
  localStorage.setItem(verificationKey, 'true');
  localStorage.setItem(`verification_id_${userKey}`, userIdentifier);
  console.log('✅ Verification data saved to localStorage');
}

// Helper function for handling logout
export function handleLogout(user: User | null, logout: () => void, walletAddress?: string) {
  console.log('=== Logout ===');
  const userKey = walletAddress || user?.email?.address;
  const verificationKey = `verified_${userKey}`;
  const verificationIdKey = `verification_id_${userKey}`;
  localStorage.removeItem(verificationKey);
  localStorage.removeItem(verificationIdKey);
  console.log('✅ Verification data cleared from localStorage');
  logout();
} 