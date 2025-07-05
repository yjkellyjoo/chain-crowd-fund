// // TODO: write contract code and interact with it
// /**
//  * CCTP V2 Integration Service
//  * 
//  * This service handles Cross-Chain Transfer Protocol (CCTP) V2 operations
//  * for secure cross-chain USDC transfers using Circle's burn and mint mechanism.
//  * 
//  * Resources:
//  * - CCTP V2 Documentation: https://developers.circle.com/stablecoins/generic-message-passing#hooks
//  * - Privy Funding: https://docs.privy.io/wallets/funding/overview
//  */


// // Placeholder types for demonstration (replace with actual ethers when installed)
// interface Signer {
//   getAddress(): Promise<string>;
// }

// interface Contract {
//   balanceOf(address: string): Promise<string>;
//   decimals(): Promise<number>;
//   approve(spender: string, amount: string): Promise<{ hash: string; wait: () => Promise<void> }>;
//   depositForBurn(...args: any[]): Promise<{ hash: string; wait: () => Promise<void> }>;
//   depositForBurnWithHook(...args: any[]): Promise<{ hash: string; wait: () => Promise<void> }>;
//   receiveMessage(message: string, attestation: string): Promise<{ hash: string; wait: () => Promise<void> }>;
// }

// // Mock implementation for demonstration
// const mockEthers = {
//   providers: {
//     JsonRpcProvider: class {
//       constructor(public url: string) {}
//       getTransactionReceipt = async (txHash: string) => ({ 
//         logs: [{ topics: ['', 'mockMessageHash'] }] 
//       });
//     }
//   },
//   Contract: class {
//     constructor(public address: string, public abi: any[], public signerOrProvider: any) {}
//     balanceOf = async (address: string) => "1000000000"; // 1000 USDC in wei
//     decimals = async () => 6;
//     approve = async (spender: string, amount: string) => ({ 
//       hash: "0xmockApprovalHash", 
//       wait: async () => {} 
//     });
//     depositForBurn = async (...args: any[]) => ({ 
//       hash: "0xmockBurnHash", 
//       wait: async () => {} 
//     });
//     depositForBurnWithHook = async (...args: any[]) => ({ 
//       hash: "0xmockBurnHookHash", 
//       wait: async () => {} 
//     });
//     receiveMessage = async (message: string, attestation: string) => ({ 
//       hash: "0xmockMintHash", 
//       wait: async () => {} 
//     });
//   },
//   utils: {
//     formatUnits: (value: string, decimals: number) => (parseInt(value) / Math.pow(10, decimals)).toString(),
//     parseUnits: (value: string, decimals: number) => (parseFloat(value) * Math.pow(10, decimals)).toString(),
//     hexZeroPad: (value: string, length: number) => '0x' + value.replace('0x', '').padStart(length * 2, '0')
//   }
// };

// export interface CCTPChain {
//   id: number;
//   name: string;
//   symbol: string;
//   domain: number;
//   rpcUrl: string;
//   explorerUrl: string;
//   tokenMessengerAddress: string;
//   messageTransmitterAddress: string;
//   usdcAddress: string;
//   fast: boolean; // CCTP V2 Fast Transfer support
// }

// export interface TransferRequest {
//   amount: string; // Amount in USDC (with decimals)
//   sourceChain: CCTPChain;
//   destinationChain: CCTPChain;
//   recipient: string; // Destination address
//   fast?: boolean; // Use Fast Transfer
//   hooks?: string; // Contract address for post-transfer hooks
// }

// export interface TransferResult {
//   txHash: string;
//   attestation?: string;
//   messageHash?: string;
//   success: boolean;
//   error?: string;
// }

// // CCTP V2 Supported Chains (Testnet)
// export const CCTP_V2_CHAINS: CCTPChain[] = [
//   {
//     id: 11155111, // Ethereum Sepolia
//     name: "Ethereum Sepolia",
//     symbol: "ETH",
//     domain: 0,
//     rpcUrl: "https://rpc.sepolia.org",
//     explorerUrl: "https://sepolia.etherscan.io",
//     tokenMessengerAddress: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
//     messageTransmitterAddress: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
//     usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
//     fast: true
//   },
//   {
//     id: 421614, // Arbitrum Sepolia
//     name: "Arbitrum Sepolia",
//     symbol: "ARB",
//     domain: 3,
//     rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
//     explorerUrl: "https://sepolia.arbiscan.io",
//     tokenMessengerAddress: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
//     messageTransmitterAddress: "0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872",
//     usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
//     fast: true
//   },
//   {
//     id: 84532, // Base Sepolia
//     name: "Base Sepolia",
//     symbol: "BASE",
//     domain: 6,
//     rpcUrl: "https://sepolia.base.org",
//     explorerUrl: "https://sepolia.basescan.org",
//     tokenMessengerAddress: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
//     messageTransmitterAddress: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
//     usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
//     fast: true
//   },
//   {
//     id: 43113, // Avalanche Fuji
//     name: "Avalanche Fuji",
//     symbol: "AVAX",
//     domain: 1,
//     rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
//     explorerUrl: "https://testnet.snowtrace.io",
//     tokenMessengerAddress: "0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79",
//     messageTransmitterAddress: "0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79",
//     usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
//     fast: false
//   },
//   {
//     id: 10, // Optimism Mainnet (for demo)
//     name: "Optimism",
//     symbol: "OP",
//     domain: 2,
//     rpcUrl: "https://mainnet.optimism.io",
//     explorerUrl: "https://optimistic.etherscan.io",
//     tokenMessengerAddress: "0x2B4069517957735bE00ceE0fadAE88a26365528f",
//     messageTransmitterAddress: "0x4d41f22c5a0e5c74090899E5a8Fb597a8842b3e8",
//     usdcAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
//     fast: true
//   }
// ];

// // CCTP V2 Contract ABIs (simplified)
// const TOKEN_MESSENGER_ABI = [
//   "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)",
//   "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, address hookContract, bytes calldata hookData) external returns (uint64)"
// ];

// const MESSAGE_TRANSMITTER_ABI = [
//   "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)"
// ];

// const USDC_ABI = [
//   "function balanceOf(address account) external view returns (uint256)",
//   "function approve(address spender, uint256 amount) external returns (bool)",
//   "function decimals() external view returns (uint8)"
// ];

// export class CCTPService {
//   private providers: Map<number, any> = new Map();
//   private signer?: Signer;

//   constructor() {
//     // Initialize providers for each supported chain
//     CCTP_V2_CHAINS.forEach(chain => {
//       this.providers.set(chain.id, new mockEthers.providers.JsonRpcProvider(chain.rpcUrl));
//     });
//   }

//   setSigner(signer: Signer) {
//     this.signer = signer;
//   }

//   getChainById(chainId: number): CCTPChain | undefined {
//     return CCTP_V2_CHAINS.find(chain => chain.id === chainId);
//   }

//   async getUSDCBalance(chainId: number, address: string): Promise<string> {
//     const chain = this.getChainById(chainId);
//     if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

//     const provider = this.providers.get(chainId);
//     if (!provider) throw new Error(`No provider for chain: ${chainId}`);

//     const usdcContract = new mockEthers.Contract(chain.usdcAddress, USDC_ABI, provider);
//     const balance = await usdcContract.balanceOf(address);
//     const decimals = await usdcContract.decimals();
    
//     return mockEthers.utils.formatUnits(balance, decimals);
//   }

//   async approveUSDC(chainId: number, amount: string): Promise<string> {
//     if (!this.signer) throw new Error("Signer not set");

//     const chain = this.getChainById(chainId);
//     if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

//     const usdcContract = new mockEthers.Contract(chain.usdcAddress, USDC_ABI, this.signer);
//     const decimals = await usdcContract.decimals();
//     const amountWei = mockEthers.utils.parseUnits(amount, decimals);

//     const tx = await usdcContract.approve(chain.tokenMessengerAddress, amountWei);
//     await tx.wait();
    
//     return tx.hash;
//   }

//   async burnUSDC(request: TransferRequest): Promise<TransferResult> {
//     if (!this.signer) throw new Error("Signer not set");

//     try {
//       const tokenMessenger = new mockEthers.Contract(
//         request.sourceChain.tokenMessengerAddress,
//         TOKEN_MESSENGER_ABI,
//         this.signer
//       );

//       const decimals = 6; // USDC has 6 decimals
//       const amountWei = mockEthers.utils.parseUnits(request.amount, decimals);
//       const recipientBytes32 = mockEthers.utils.hexZeroPad(request.recipient, 32);

//       let tx;
      
//       if (request.hooks) {
//         // Use depositForBurnWithHook for CCTP V2 with hooks
//         tx = await tokenMessenger.depositForBurnWithHook(
//           amountWei,
//           request.destinationChain.domain,
//           recipientBytes32,
//           request.sourceChain.usdcAddress,
//           request.hooks,
//           "0x" // Empty hook data for now
//         );
//       } else {
//         // Standard or Fast Transfer
//         tx = await tokenMessenger.depositForBurn(
//           amountWei,
//           request.destinationChain.domain,
//           recipientBytes32,
//           request.sourceChain.usdcAddress
//         );
//       }

//       await tx.wait();
      
//       return {
//         txHash: tx.hash,
//         success: true
//       };
//     } catch (error) {
//       console.error("Burn USDC error:", error);
//       return {
//         txHash: "",
//         success: false,
//         error: error instanceof Error ? error.message : "Unknown error"
//       };
//     }
//   }

//   async getAttestation(txHash: string, sourceChainId: number): Promise<string> {
//     // In a real implementation, you would call Circle's Attestation API
//     // For testnet: https://iris-api-sandbox.circle.com/attestations/{messageHash}
//     // For mainnet: https://iris-api.circle.com/attestations/{messageHash}
    
//     const sourceChain = this.getChainById(sourceChainId);
//     if (!sourceChain) throw new Error(`Unsupported source chain: ${sourceChainId}`);

//     try {
//       // Extract message hash from transaction receipt
//       const provider = this.providers.get(sourceChainId);
//       if (!provider) throw new Error(`No provider for chain: ${sourceChainId}`);

//       const receipt = await provider.getTransactionReceipt(txHash);
//       if (!receipt) throw new Error("Transaction not found");

//       // Parse MessageSent event to get messageHash
//       const messageHash = receipt.logs[0]?.topics[1] || "";

//       // Call Circle's Attestation API (mocked for demo)
//       const attestationUrl = `https://iris-api-sandbox.circle.com/attestations/${messageHash}`;
      
//       // Mock attestation response
//       console.log(`Would call: ${attestationUrl}`);
//       return "0xmockAttestationSignature";
//     } catch (error) {
//       console.error("Get attestation error:", error);
//       throw error;
//     }
//   }

//   async mintUSDC(
//     attestation: string,
//     message: string,
//     destinationChainId: number
//   ): Promise<TransferResult> {
//     if (!this.signer) throw new Error("Signer not set");

//     try {
//       const destinationChain = this.getChainById(destinationChainId);
//       if (!destinationChain) throw new Error(`Unsupported destination chain: ${destinationChainId}`);

//       const messageTransmitter = new mockEthers.Contract(
//         destinationChain.messageTransmitterAddress,
//         MESSAGE_TRANSMITTER_ABI,
//         this.signer
//       );

//       const tx = await messageTransmitter.receiveMessage(message, attestation);
//       await tx.wait();
      
//       return {
//         txHash: tx.hash,
//         success: true
//       };
//     } catch (error) {
//       console.error("Mint USDC error:", error);
//       return {
//         txHash: "",
//         success: false,
//         error: error instanceof Error ? error.message : "Unknown error"
//       };
//     }
//   }

//   // Privy On-Ramp Integration
//   async initiatePivyOnRamp(amount: string, destinationAddress: string): Promise<boolean> {
//     // This would integrate with Privy's on-ramp functionality
//     console.log(`Initiating Privy on-ramp for ${amount} USDC to ${destinationAddress}`);
    
//     // In a real implementation, you would call Privy's funding API
//     // https://docs.privy.io/wallets/funding/overview
    
//     return true;
//   }

//   // Complete cross-chain transfer flow
//   async crossChainTransfer(request: TransferRequest): Promise<TransferResult> {
//     try {
//       // Step 1: Approve USDC spending
//       await this.approveUSDC(request.sourceChain.id, request.amount);

//       // Step 2: Burn USDC on source chain
//       const burnResult = await this.burnUSDC(request);
//       if (!burnResult.success) {
//         throw new Error(burnResult.error || "Burn failed");
//       }

//       // Step 3: Get attestation from Circle
//       const attestation = await this.getAttestation(burnResult.txHash, request.sourceChain.id);

//       // Step 4: Mint USDC on destination chain would happen here
//       // Note: In a real implementation, you might need to switch to the destination chain
      
//       return {
//         txHash: burnResult.txHash,
//         attestation,
//         success: true
//       };
//     } catch (error) {
//       console.error("Cross-chain transfer error:", error);
//       return {
//         txHash: "",
//         success: false,
//         error: error instanceof Error ? error.message : "Transfer failed"
//       };
//     }
//   }
// }

// // Singleton instance
// export const cctpService = new CCTPService(); 