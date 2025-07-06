import { NextRequest, NextResponse } from 'next/server';
import { 
  SelfBackendVerifier, 
  AttestationId,
  DefaultConfigStore
} from '@selfxyz/core';
import { BigNumberish } from 'ethers';

// Initialize verifier
const configStore = new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: ['IRN', 'PRK'] as const,
    ofac: true
});

const allowPassports = new Map<AttestationId, boolean>();
allowPassports.set(1, true);

const selfBackendVerifier = new SelfBackendVerifier(
  'chain-crowd-fund-scope',
  process.env.NEXT_PUBLIC_SITE_URL + '/api/verify' || 'http://localhost:3000/api/verify',
  true, // Force mock mode for development
  allowPassports,
  configStore,
  'hex'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attestationId, proof, publicSignals, userContextData } = body;
    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return NextResponse.json(
        { message: 'Missing required fields', received: Object.keys(body) },
        { status: 400 }
      );
    }

    // Verify the proof with the extracted user context
    const result = await selfBackendVerifier.verify(
      attestationId,
      proof,
      publicSignals as BigNumberish[],
      userContextData
    );
        
    // Check overall verification result
    if (!result.isValidDetails.isValid) {
        return NextResponse.json(
          { error: 'Cryptographic proof verification failed' },
          { status: 400 }
        );
      }
      
      // Check specific requirements
      if (!result.isValidDetails.isMinimumAgeValid) {
        return NextResponse.json(
          { error: 'Age requirement not met' },
          { status: 403 }
        );
      }
      
      if (!result.isValidDetails.isOfacValid) {
        return NextResponse.json(
          { error: 'OFAC sanctions check failed' },
          { status: 403 }
        );
      }

      // Check excluded countries manually
      // Note: The Self SDK handles this internally, but we can add additional checks if needed
      const excludedCountries = ['IRN', 'PRK'];
      if (userContextData && userContextData.nationality) {
        const userNationality = userContextData.nationality.toUpperCase();
        if (excludedCountries.includes(userNationality)) {
          return NextResponse.json(
            { error: 'Geographic restriction - service not available in your country' },
            { status: 403 }
          );
        }
      }

    // Return successful verification response
      return NextResponse.json({
        status: 'success',
        result: true, 
      });

  } catch (error) {
    console.error('Error verifying proof:', error);
    return NextResponse.json({
      status: 'error',
      result: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 