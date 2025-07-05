import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import PrivyClientProvider from "./PrivyClientProvider";

export const metadata: Metadata = {
  title: "ChainCrowdFund",
  description: "Decentralized Crowdfunding",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrivyClientProvider>
          {children}
        </PrivyClientProvider>
      </body>
    </html>
  );
}
