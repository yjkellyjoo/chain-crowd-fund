# ChainCrowdFund Deployment Guide

## Overview

This guide walks you through deploying the ChainCrowdFund contract on Arbitrum Sepolia testnet using Circle's CCTP (Cross-Chain Transfer Protocol) infrastructure.

## Prerequisites

1. **Foundry** - Ensure you have Foundry installed
2. **Private Key** - A wallet with testnet ETH for gas fees
3. **Testnet ETH** - Get from faucets (much easier than Avalanche!)

## Network Information

### Arbitrum Sepolia (Testnet)
- **Chain ID**: 421614
- **Explorer**: https://sepolia.arbiscan.io
- **USDC Contract**: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- **CCTP MessageTransmitter**: `0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872`

## Deployment Steps

### 1. Environment Setup

Create a `.env` file in the contract directory:

```bash
# Deployment Configuration
PRIVATE_KEY=your_private_key_here_with_0x_prefix
```

### 2. Deploy to Arbitrum Sepolia Testnet

```bash
# Deploy to Arbitrum Sepolia testnet
forge script script/DeployChainCrowdFund.s.sol:DeployChainCrowdFund \
  --rpc-url arbitrum_sepolia \
  --broadcast \
  -vvvv
```

### 3. Verify Contract (optional)

You can verify the contract on testnet for easier debugging:

```bash
# Verify on Arbiscan (if you have API key)
forge verify-contract \
  --chain arbitrum_sepolia \
  --etherscan-api-key $ARBISCAN_API_KEY \
  <CONTRACT_ADDRESS> \
  src/ChainCrowdFund.sol:ChainCrowdFund \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d 0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872)
```

## Contract Features

The deployed ChainCrowdFund contract will support:

- **Direct USDC Contributions**: Users can contribute USDC directly on Avalanche
- **Cross-Chain Contributions**: Accept USDC from other CCTP-supported chains:
  - Ethereum (Domain 0)
  - Avalanche (Domain 1) 
  - Arbitrum (Domain 3)
  - Base (Domain 6)
  - Polygon (Domain 7)
- **Campaign Management**: Create, fund, and manage crowdfunding campaigns
- **Refund Mechanism**: Automatic refunds if campaign goals aren't met

## Post-Deployment Checklist

1. **Test Basic Functions**: 
   - Create a test campaign
   - Make a small contribution
2. **Get Testnet USDC**: Use [Circle's Faucet](https://faucet.circle.com/) to get testnet USDC
3. **Test Cross-Chain**: Try contributing USDC from other testnet chains like Ethereum Sepolia

## Useful Commands

```bash
# Check deployment (dry run)
forge script script/DeployChainCrowdFund.s.sol:DeployChainCrowdFund --rpc-url arbitrum_sepolia

# Run tests
forge test

# Check contract size
forge build --sizes

# Gas estimation
forge test --gas-report
```

## Contract Address (Update After Deployment)

```
Arbitrum Sepolia: `0xfa85c33ed5eaa493e41386d7f68318741d08c285`
``` 