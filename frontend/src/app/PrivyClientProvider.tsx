"use client";
import { PrivyProvider } from "@privy-io/react-auth";

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider 
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // Prioritize email and SMS login methods which will trigger embedded wallet creation
        loginMethods: ['email', 'sms'],
        // Configure appearance
        appearance: {
          theme: 'dark',
          accentColor: '#3b82f6',
          showWalletLoginFirst: false,
        },
        // Enable automatic embedded wallet creation
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        // Remove external wallet configuration - we're using embedded wallets now
      }}
    >
      {children}
    </PrivyProvider>
  );
}