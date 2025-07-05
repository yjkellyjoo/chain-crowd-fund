"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy, useUser, User } from '@privy-io/react-auth';

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
  const [isVerified, setIsVerified] = useState(false);
  const [isLoadingVerification, setIsLoadingVerification] = useState(true);

  useEffect(() => {
    console.log('=== Auth & Verification Hook Debug ===');
    console.log('ready:', ready);
    console.log('authenticated:', authenticated);
    console.log('user:', user);
    
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
      const verificationKey = `verified_${user?.wallet?.address || user?.email?.address}`;
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
  }, [ready, authenticated, user, router, redirectOnFail]);

  return {
    isReady: ready,
    isAuthenticated: authenticated,
    isVerified,
    isLoading: isLoadingVerification,
    user
  };
}

// Helper function for handling verification success
export function handleVerificationSuccess(user: User | null, userIdentifier: string) {
  console.log('=== Verification Success ===');
  console.log('userIdentifier:', userIdentifier);
  console.log('user?.wallet?.address:', user?.wallet?.address);
  console.log('user?.email?.address:', user?.email?.address);
  
  const verificationKey = `verified_${user?.wallet?.address || user?.email?.address}`;
  console.log('Setting verification key:', verificationKey);
  localStorage.setItem(verificationKey, 'true');
  localStorage.setItem(`verification_id_${user?.wallet?.address || user?.email?.address}`, userIdentifier);
  console.log('✅ Verification data saved to localStorage');
}

// Helper function for handling logout
export function handleLogout(user: User | null, logout: () => void) {
  console.log('=== Logout ===');
  const verificationKey = `verified_${user?.wallet?.address || user?.email?.address}`;
  const verificationIdKey = `verification_id_${user?.wallet?.address || user?.email?.address}`;
  localStorage.removeItem(verificationKey);
  localStorage.removeItem(verificationIdKey);
  console.log('✅ Verification data cleared from localStorage');
  logout();
} 