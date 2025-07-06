"use client";

import React from 'react';
import { AlertCircle, Shield, Globe, Calendar, XCircle, HelpCircle } from 'lucide-react';

interface VerificationDeniedProps {
  reason: 'age' | 'ofac' | 'country' | 'unknown';
  onRetry?: () => void;
  onContactSupport?: () => void;
}

export default function VerificationDenied({ 
  reason, 
  onRetry, 
  onContactSupport 
}: VerificationDeniedProps) {
  const getDenialContent = () => {
    switch (reason) {
      case 'age':
        return {
          icon: <Calendar className="w-16 h-16 text-red-400" />,
          title: "Age Requirement Not Met",
          description: "We're sorry, but you must be at least 18 years old to use ChainCrowdFund.",
          details: [
            "Platform is restricted to adults only",
            "This is required for legal compliance",
            "Age verification is based on your government-issued ID"
          ],
          canRetry: false,
          supportMessage: "If you believe this is an error, please contact our support team."
        };
      
      case 'ofac':
        return {
          icon: <Shield className="w-16 h-16 text-red-400" />,
          title: "Sanctions Check Failed",
          description: "We're unable to verify your identity due to sanctions compliance requirements.",
          details: [
            "Your information matches entries on restricted lists",
            "This is required for regulatory compliance",
            "We cannot process your verification at this time"
          ],
          canRetry: false,
          supportMessage: "If you believe this is an error, please contact our compliance team."
        };
      
      case 'country':
        return {
          icon: <Globe className="w-16 h-16 text-red-400" />,
          title: "Geographic Restriction",
          description: "We're sorry, but ChainCrowdFund is not available in your country.",
          details: [
            "Service is restricted in certain jurisdictions",
            "This is due to local regulations and compliance requirements",
            "We cannot process registrations from restricted countries"
          ],
          canRetry: false,
          supportMessage: "For questions about availability in your region, please contact support."
        };
      
      default:
        return {
          icon: <XCircle className="w-16 h-16 text-red-400" />,
          title: "Verification Failed",
          description: "We're unable to verify your identity at this time.",
          details: [
            "Your identity verification was unsuccessful",
            "This may be due to document quality or technical issues",
            "Please ensure your documents are clear and valid"
          ],
          canRetry: true,
          supportMessage: "If problems persist, please contact our support team for assistance."
        };
    }
  };

  const content = getDenialContent();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {content.icon}
          </div>
          <h1 className="text-3xl font-bold mb-2">{content.title}</h1>
          <p className="text-xl text-gray-300">{content.description}</p>
        </div>

        {/* Details Card */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-400 mb-2">Important Information</h3>
              <ul className="space-y-2 text-gray-300">
                {content.details.map((detail, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-500 mt-1">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Support Information */}
        <div className="bg-blue-900/30 border border-blue-600/30 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-400 mb-2">Need Help?</h3>
              <p className="text-gray-300 mb-3">{content.supportMessage}</p>
              <button
                onClick={onContactSupport}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {content.canRetry && (
            <button
              onClick={onRetry}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Try Again
            </button>
          )}
          
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Return to Homepage
          </button>
        </div>

        {/* Legal Notice */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            These restrictions are in place to ensure compliance with applicable laws and regulations.
            ChainCrowdFund is committed to maintaining a safe and compliant platform for all users.
          </p>
        </div>
      </div>
    </div>
  );
} 