/**
 * CCTP V2 Integration Service
 * 
 * This service handles Cross-Chain Transfer Protocol (CCTP) V2 operations
 * for secure cross-chain USDC transfers using Circle's burn and mint mechanism.
 * 
 * Resources:
 * - CCTP V2 Documentation: https://developers.circle.com/stablecoins/transfer-usdc-on-testnet-from-ethereum-to-avalanche
 * - Circle API: https://iris-api-sandbox.circle.com/v2/messages
 */

import { ethers } from 'ethers';

export interface CCTPChain {
  id: number;
  name: string;
  symbol: string;
  domain: number;
  rpcUrl: string;
  explorerUrl: string;
  tokenMessengerAddress: string;
  messageTransmitterAddress: string;
  usdcAddress: string;
  fast: boolean; // CCTP V2 Fast Transfer support
}

export interface TransferRequest {
  amount: string; // Amount in USDC (with decimals)
  sourceChain: CCTPChain;
  destinationChain: CCTPChain;
  recipient: string; // Destination address
  fast?: boolean; // Use Fast Transfer
  destinationCaller?: string; // Contract address for post-transfer calls
  maxFee?: string; // Max fee for fast transfers
}

export interface TransferResult {
  txHash: string;
  attestation?: string;
  messageHash?: string;
  success: boolean;
  error?: string;
}

export interface AttestationResponse {
  status: string;
  message?: string;
  attestation?: string;
}

// CCTP V2 Supported Chains (Testnet)
export const CCTP_V2_CHAINS: CCTPChain[] = [
  {
    id: 11155111, // Ethereum Sepolia
    name: "Ethereum Sepolia",
    symbol: "ETH",
    domain: 0,
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerUrl: "https://sepolia.etherscan.io",
    tokenMessengerAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // CCTP V2 TokenMessenger
    messageTransmitterAddress: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // CCTP V2 MessageTransmitter
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    fast: true
  },
  {
    id: 421614, // Arbitrum Sepolia
    name: "Arbitrum Sepolia",
    symbol: "ARB",
    domain: 3,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerUrl: "https://sepolia.arbiscan.io",
    tokenMessengerAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // CCTP V2 TokenMessenger
    messageTransmitterAddress: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // CCTP V2 MessageTransmitter
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    fast: true
  },
  {
    id: 84532, // Base Sepolia
    name: "Base Sepolia",
    symbol: "BASE",
    domain: 6,
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    tokenMessengerAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // CCTP V2 TokenMessenger
    messageTransmitterAddress: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // CCTP V2 MessageTransmitter
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    fast: true
  },
  {
    id: 43113, // Avalanche Fuji
    name: "Avalanche Fuji",
    symbol: "AVAX",
    domain: 1,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    explorerUrl: "https://testnet.snowtrace.io",
    tokenMessengerAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // CCTP V2 TokenMessenger
    messageTransmitterAddress: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // CCTP V2 MessageTransmitter
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
    fast: false
  }
];

// CCTP V2 Contract ABIs
const TOKEN_MESSENGER_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64)"
];

const MESSAGE_TRANSMITTER_ABI = [
  "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)",
  "event MessageSent(bytes message)"
];

const USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

export class CCTPService {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private signer?: ethers.Signer;

  constructor() {
    // Providers will be initialized lazily when needed
  }

  private getProvider(chainId: number): ethers.JsonRpcProvider {
    if (!this.providers.has(chainId)) {
      const chain = this.getChainById(chainId);
      if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
      
      console.log(`🔗 Initializing provider for ${chain.name} (${chainId}) - RPC: ${chain.rpcUrl}`);
      
      try {
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        this.providers.set(chainId, provider);
        console.log(`✅ Provider initialized successfully for ${chain.name}`);
      } catch (error) {
        console.error(`❌ Failed to initialize provider for ${chain.name}:`, error);
        throw new Error(`Failed to connect to ${chain.name}`);
      }
    }
    
    return this.providers.get(chainId)!;
  }

  setSigner(signer: ethers.Signer) {
    this.signer = signer;
  }

  getChainById(chainId: number): CCTPChain | undefined {
    return CCTP_V2_CHAINS.find(chain => chain.id === chainId);
  }

  async getUSDCBalance(chainId: number, address: string): Promise<string> {
    const chain = this.getChainById(chainId);
    if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

    const provider = this.getProvider(chainId);
    const usdcContract = new ethers.Contract(chain.usdcAddress, USDC_ABI, provider);
    const balance = await usdcContract.balanceOf(address);
    const decimals = await usdcContract.decimals();
    
    return ethers.formatUnits(balance, decimals);
  }

  async getUSDCAllowance(chainId: number, owner: string, spender: string): Promise<string> {
    const chain = this.getChainById(chainId);
    if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

    const provider = this.getProvider(chainId);
    const usdcContract = new ethers.Contract(chain.usdcAddress, USDC_ABI, provider);
    const allowance = await usdcContract.allowance(owner, spender);
    const decimals = await usdcContract.decimals();
    
    return ethers.formatUnits(allowance, decimals);
  }

  async approveUSDC(chainId: number, amount: string): Promise<string> {
    if (!this.signer) throw new Error("Signer not set");

    const chain = this.getChainById(chainId);
    if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

    const usdcContract = new ethers.Contract(chain.usdcAddress, USDC_ABI, this.signer);
    const decimals = await usdcContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    const tx = await usdcContract.approve(chain.tokenMessengerAddress, amountWei);
    await tx.wait();
    
    return tx.hash;
  }

  async burnUSDC(request: TransferRequest): Promise<TransferResult> {
    if (!this.signer) throw new Error("Signer not set");

    try {
      const tokenMessenger = new ethers.Contract(
        request.sourceChain.tokenMessengerAddress,
        TOKEN_MESSENGER_ABI,
        this.signer
      );

      const decimals = 6; // USDC has 6 decimals
      const amountWei = ethers.parseUnits(request.amount, decimals);
      const recipientBytes32 = ethers.zeroPadValue(request.recipient, 32);
      const destinationCallerBytes32 = request.destinationCaller 
        ? ethers.zeroPadValue(request.destinationCaller, 32)
        : ethers.ZeroHash;

      // Always use CCTP V2 signature
      const maxFeeWei = ethers.parseUnits(request.maxFee || "0.0005", decimals);
      const minFinalityThreshold = (request.fast && request.sourceChain.fast) ? 1000 : 2000;
      
      const tx = await tokenMessenger.depositForBurn(
        amountWei,
        request.destinationChain.domain,
        recipientBytes32,
        request.sourceChain.usdcAddress,
        destinationCallerBytes32,
        maxFeeWei,
        minFinalityThreshold
      );

      await tx.wait();
      
      return {
        txHash: tx.hash,
        success: true
      };
    } catch (error) {
      console.error("Burn USDC error:", error);
      return {
        txHash: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  async extractMessageFromTx(txHash: string, sourceChainId: number): Promise<string> {
    const provider = this.getProvider(sourceChainId);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error("Transaction not found");

    // Find MessageSent event
    const messageTransmitter = new ethers.Contract(
      this.getChainById(sourceChainId)!.messageTransmitterAddress,
      MESSAGE_TRANSMITTER_ABI,
      provider
    );

    const events = await messageTransmitter.queryFilter(
      messageTransmitter.filters.MessageSent(),
      receipt.blockNumber,
      receipt.blockNumber
    );

    const event = events.find(e => e.transactionHash === txHash);
    if (!event) throw new Error("MessageSent event not found");

    // Cast to EventLog to access args property
    const eventLog = event as ethers.EventLog;
    return eventLog.args[0]; // message bytes
  }

  async getAttestation(txHash: string, sourceChainId: number): Promise<AttestationResponse> {
    const sourceChain = this.getChainById(sourceChainId);
    if (!sourceChain) throw new Error(`Unsupported source chain: ${sourceChainId}`);

    try {
      // Call Circle's Attestation API V2
      const attestationUrl = `https://iris-api-sandbox.circle.com/v2/messages/${sourceChain.domain}?transactionHash=${txHash}`;
      
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max wait
      
      while (attempts < maxAttempts) {
        const response = await fetch(attestationUrl);
        
        if (response.status === 404) {
          console.log('Waiting for attestation...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          const message = data.messages[0];
          if (message.status === 'complete') {
            return {
              status: 'complete',
              message: message.message,
              attestation: message.attestation
            };
          }
        }
        
        console.log('Waiting for attestation...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
      
      throw new Error('Attestation timeout');
    } catch (error) {
      console.error("Get attestation error:", error);
      throw error;
    }
  }

  async mintUSDC(
    message: string,
    attestation: string,
    destinationChainId: number
  ): Promise<TransferResult> {
    if (!this.signer) throw new Error("Signer not set");

    try {
      const destinationChain = this.getChainById(destinationChainId);
      if (!destinationChain) throw new Error(`Unsupported destination chain: ${destinationChainId}`);

      const messageTransmitter = new ethers.Contract(
        destinationChain.messageTransmitterAddress,
        MESSAGE_TRANSMITTER_ABI,
        this.signer
      );

      // Ensure message and attestation are properly formatted as bytes
      const messageBytes = message.startsWith('0x') ? message : `0x${message}`;
      const attestationBytes = attestation.startsWith('0x') ? attestation : `0x${attestation}`;

      console.log("🔄 Calling receiveMessage with:");
      console.log("Message length:", messageBytes.length);
      console.log("Attestation length:", attestationBytes.length);
      console.log("MessageTransmitter address:", destinationChain.messageTransmitterAddress);
      console.log("Message (first 100 chars):", messageBytes.substring(0, 100) + "...");
      console.log("Attestation (first 100 chars):", attestationBytes.substring(0, 100) + "...");
      
      // Check current network and wallet state
      const currentNetwork = await this.signer.provider?.getNetwork();
      const walletAddress = await this.signer.getAddress();
      const balance = await this.signer.provider?.getBalance(walletAddress);
      
      console.log("🔍 Network and wallet info:");
      console.log("Current network ID:", currentNetwork?.chainId.toString());
      console.log("Expected network ID:", destinationChainId);
      console.log("Wallet address:", walletAddress);
      console.log("ETH balance:", balance ? ethers.formatEther(balance) : "unknown");
      
      // Validate we're on the right network
      if (currentNetwork && Number(currentNetwork.chainId) !== destinationChainId) {
        throw new Error(`Wrong network! Currently on chain ${currentNetwork.chainId}, but need to be on ${destinationChainId}`);
      }
      
      // Basic validation of message and attestation format
      if (messageBytes.length < 10) {
        throw new Error("Message appears to be too short or invalid");
      }
      if (attestationBytes.length < 10) {
        throw new Error("Attestation appears to be too short or invalid");
      }
      
      // Test if we can interact with the MessageTransmitter contract
      try {
        // Try to get the contract's version (a simple read-only call)
        const code = await this.signer.provider?.getCode(destinationChain.messageTransmitterAddress);
        if (!code || code === '0x') {
          throw new Error(`MessageTransmitter contract not found at address ${destinationChain.messageTransmitterAddress} on chain ${destinationChainId}`);
        }
        console.log("✅ MessageTransmitter contract exists and is accessible");
      } catch (contractError) {
        console.error("❌ Contract validation failed:", contractError);
        throw new Error(`Cannot access MessageTransmitter contract: ${contractError instanceof Error ? contractError.message : 'Unknown error'}`);
      }

      // First, let's try to call receiveMessage directly
      // If it fails, we'll provide a more helpful error message
      try {
        const tx = await messageTransmitter.receiveMessage(messageBytes, attestationBytes);
        const receipt = await tx.wait();
        
        console.log("✅ Message received successfully:", receipt.hash);
        
        return {
          txHash: receipt.hash,
          success: true
        };
      } catch (receiveError) {
        console.error("❌ receiveMessage failed:", receiveError);
        
                 // For "missing revert data" errors, we need to investigate further
         if (receiveError instanceof Error) {
           const errorMessage = receiveError.message.toLowerCase();
           
           if (errorMessage.includes("missing revert data")) {
             // This usually means the transaction would revert for a specific reason
             // Let's try to get more information
             console.log("🔍 Got 'missing revert data' - investigating further...");
             
             // Common causes for CCTP V2:
             // 1. Message already used (most common)
             // 2. Message expired
             // 3. Invalid attestation
             // 4. Wrong network
             
             throw new Error("Transaction would fail. This usually means:\n• The message has already been used (CCTP messages can only be used once)\n• The message has expired\n• You're on the wrong network\n• The attestation is invalid\n\nTry starting a fresh cross-chain transfer.");
           } else if (errorMessage.includes("message already used") || 
               errorMessage.includes("nonce") || 
               errorMessage.includes("already received")) {
             throw new Error("This message has already been used. Each cross-chain transfer can only be completed once.");
           } else if (errorMessage.includes("invalid attestation") || 
                      errorMessage.includes("invalid signature")) {
             throw new Error("Invalid attestation data. The attestation may be corrupted or from the wrong network.");
           } else if (errorMessage.includes("invalid message") || 
                      errorMessage.includes("malformed")) {
             throw new Error("Invalid message format. The message data may be corrupted.");
           } else if (errorMessage.includes("expired")) {
             throw new Error("This attestation has expired. Please request a new attestation.");
           } else if (errorMessage.includes("insufficient funds")) {
             throw new Error("Insufficient funds for gas fees on the destination chain.");
           }
         }
         
         // If none of the specific cases match, throw the original error for debugging
         throw receiveError;
      }
    } catch (error) {
      console.error("Mint USDC error:", error);
      return {
        txHash: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  // Complete cross-chain transfer flow
  async crossChainTransfer(request: TransferRequest): Promise<TransferResult> {
    try {
      // Step 1: Check and approve USDC spending if needed
      const userAddress = await this.signer!.getAddress();
      const currentAllowance = await this.getUSDCAllowance(
        request.sourceChain.id,
        userAddress,
        request.sourceChain.tokenMessengerAddress
      );

      if (parseFloat(currentAllowance) < parseFloat(request.amount)) {
        console.log("Approving USDC spending...");
        await this.approveUSDC(request.sourceChain.id, request.amount);
      }

      // Step 2: Burn USDC on source chain
      console.log("Burning USDC on source chain...");
      const burnResult = await this.burnUSDC(request);
      if (!burnResult.success) {
        throw new Error(burnResult.error || "Burn failed");
      }

      // Step 3: Get attestation from Circle
      console.log("Getting attestation from Circle...");
      const attestationResult = await this.getAttestation(burnResult.txHash, request.sourceChain.id);

      return {
        txHash: burnResult.txHash,
        attestation: attestationResult.attestation,
        messageHash: attestationResult.message,
        success: true
      };
    } catch (error) {
      console.error("Cross-chain transfer error:", error);
      return {
        txHash: "",
        success: false,
        error: error instanceof Error ? error.message : "Transfer failed"
      };
    }
  }

  // Helper method to complete the transfer on destination chain
  async completeTransfer(
    message: string,
    attestation: string,
    destinationChainId: number
  ): Promise<TransferResult> {
    return this.mintUSDC(message, attestation, destinationChainId);
  }
}

// Singleton instance
export const cctpService = new CCTPService(); 