"use client";

import React, { useState } from 'react';
import VerificationDenied from '../components/VerificationDenied';

type DenialReason = 'age' | 'ofac' | 'country' | 'unknown';

export default function VerificationDemoPage() {
  const [selectedReason, setSelectedReason] = useState<DenialReason>('age');
  const [showDemo, setShowDemo] = useState(false);

  const handleContactSupport = () => {
    console.log('Contact support clicked');
    alert('Support contact would be opened here');
  };

  const handleRetry = () => {
    console.log('Retry clicked');
    alert('Verification retry would be initiated here');
  };

  if (showDemo) {
    return (
      <VerificationDenied
        reason={selectedReason}
        onRetry={selectedReason === 'unknown' ? handleRetry : undefined}
        onContactSupport={handleContactSupport}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Verification Denial Interface Demo</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Different Denial Scenarios</h2>
          <p className="text-gray-300 mb-6">
            This demo shows how the verification denial interface appears for different failure reasons.
            Select a scenario below to see the corresponding denial screen.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setSelectedReason('age')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedReason === 'age' 
                  ? 'border-blue-500 bg-blue-900/30' 
                  : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <h3 className="font-semibold text-lg mb-2">Age Restriction</h3>
              <p className="text-sm text-gray-300">User is under 18 years old</p>
            </button>
            
            <button
              onClick={() => setSelectedReason('ofac')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedReason === 'ofac' 
                  ? 'border-blue-500 bg-blue-900/30' 
                  : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <h3 className="font-semibold text-lg mb-2">OFAC Sanctions</h3>
              <p className="text-sm text-gray-300">User appears on sanctions list</p>
            </button>
            
            <button
              onClick={() => setSelectedReason('country')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedReason === 'country' 
                  ? 'border-blue-500 bg-blue-900/30' 
                  : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <h3 className="font-semibold text-lg mb-2">Geographic Restriction</h3>
              <p className="text-sm text-gray-300">User is from restricted country</p>
            </button>
            
            <button
              onClick={() => setSelectedReason('unknown')}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedReason === 'unknown' 
                  ? 'border-blue-500 bg-blue-900/30' 
                  : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <h3 className="font-semibold text-lg mb-2">Unknown Error</h3>
              <p className="text-sm text-gray-300">General verification failure</p>
            </button>
          </div>
          
          <div className="border-t border-gray-700 pt-6">
            <h3 className="font-semibold mb-3">Selected Scenario: {selectedReason}</h3>
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <h4 className="font-medium mb-2">Description:</h4>
              <p className="text-gray-300 text-sm">
                {selectedReason === 'age' && "This scenario shows the denial interface when a user is under 18 years old. The interface explains the age requirement and does not offer a retry option."}
                {selectedReason === 'ofac' && "This scenario shows the denial interface when a user appears on the OFAC sanctions list. The interface explains the compliance requirements and provides contact information."}
                {selectedReason === 'country' && "This scenario shows the denial interface when a user is from a restricted country (Iran or North Korea). The interface explains geographic restrictions."}
                {selectedReason === 'unknown' && "This scenario shows the denial interface for general verification failures. Unlike other scenarios, this one offers a retry option as the issue might be temporary."}
              </p>
            </div>
            
            <button
              onClick={() => setShowDemo(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Show Denial Interface
            </button>
          </div>
        </div>
        
        <div className="bg-yellow-900/30 border border-yellow-600/30 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-400 mb-2">Implementation Notes</h3>
          <ul className="text-yellow-200 text-sm space-y-1">
            <li>• The denial interface automatically parses error messages from the verification API</li>
            <li>• Different denial reasons show different icons and messaging</li>
            <li>• Age, OFAC, and country restrictions do not offer retry options</li>
            <li>• Unknown errors allow retry in case of temporary issues</li>
            <li>• Support contact functionality opens email client with pre-filled information</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 