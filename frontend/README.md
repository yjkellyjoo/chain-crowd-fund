# ChainCrowdFund Frontend

A decentralized crowdfunding platform built with [Next.js](https://nextjs.org), featuring Privy authentication and Self Protocol identity verification.

## Features

- **Privy Authentication**: Wallet and social login integration
- **Self Protocol Identity Verification**: Age and compliance verification via QR code
- **Decentralized Crowdfunding**: Create and fund campaigns with USDC
- **Circle CCTP Integration**: Cross-chain USDC payments
- **Modern UI**: Built with Next.js, TypeScript, and Tailwind CSS

## Environment Variables

Create a `.env.local` file in the frontend directory with the following variables:

```bash
# Site URL for Self Protocol verification
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Privy App ID - Replace with your actual Privy app ID from https://dashboard.privy.io
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id-here
```

## Getting Started

1. **Install Dependencies**
   ```bash
   yarn install
   ```

2. **Set up Environment Variables**
   - Create `.env.local` file with the variables shown above
   - Get your Privy App ID from [Privy Dashboard](https://dashboard.privy.io)

3. **Run Development Server**
   ```bash
   yarn dev
   ```

4. **Open Application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## User Flow

1. **Login with Privy** - Users authenticate using wallet or social login
2. **Self Protocol Verification** - Users scan QR code with Self app for identity verification
3. **Access Platform** - After verification, users can create or fund campaigns

## Self Protocol Integration

The app uses Self Protocol for identity verification with the following requirements:
- Minimum age: 18
- Excluded countries: Iran (IRN), North Korea (PRK)
- OFAC compliance checks enabled
- Required disclosures: name, nationality, date of birth

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Authentication**: Privy
- **Identity Verification**: Self Protocol
- **Payments**: Circle CCTP for USDC
- **Smart Contracts**: Foundry (in `/contract` directory)

## Development

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Privy Documentation](https://docs.privy.io) - wallet authentication and management
- [Self Protocol Documentation](https://docs.self.xyz) - identity verification
- [Circle Documentation](https://developers.circle.com) - USDC and cross-chain transfers

## Next Steps

- Set up campaign creation UI
- Integrate Circle CCTP for USDC payments
- Add campaign funding interface
- Connect to smart contracts

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
