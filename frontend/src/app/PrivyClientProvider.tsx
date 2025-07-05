"use client";
import { PrivyProvider } from "@privy-io/react-auth";

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider 
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // Encourage wallet connection during login
        loginMethods: ['wallet', 'email', 'sms'],
        // Prioritize wallet connection
        appearance: {
          theme: 'dark',
          accentColor: '#3b82f6',
        },
        // Automatically prompt for wallet connection after login
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}