import { ethers } from 'ethers';
// Import ABI directly from generated ABI file (via Foundry)
import ChainCrowdFundABI from './ChainCrowdFund.abi.json';

// Deployed contract address on Arbitrum Sepolia
export const CHAINCROWDFUND_CONTRACT_ADDRESS = '0xfa85C33eD5Eaa493e41386d7F68318741D08c285';

// Arbitrum Sepolia network info
export const ARBITRUM_SEPOLIA = {
  chainId: 421614,
  name: 'Arbitrum Sepolia',
  rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
  explorerUrl: 'https://sepolia.arbiscan.io',
  usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  messageTransmitter: '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872'
};

// Use the generated ABI directly
export const CHAINCROWDFUND_ABI = ChainCrowdFundABI;

// USDC contract ABI (for approvals)
export const USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

// Types
export interface Campaign {
  id: number;
  title: string;
  description: string;
  goalAmount: bigint;
  raisedAmount: bigint;
  creator: string;
  deadline: bigint;
  category: string;
  isCompleted: boolean;
  hasSubmittedResults: boolean;
}

export interface Contribution {
  contributor: string;
  amount: bigint;
  timestamp: bigint;
  isCrossChain: boolean;
  sourceChainDomain: number;
  originalTxHash: string;
}

export interface CrossChainContribution {
  campaignId: bigint;
  contributor: string;
  amount: bigint;
  sourceChainDomain: number;
  originalTxHash: string;
  messageHash: string;
  processed: boolean;
  timestamp: bigint;
}

export class ChainCrowdFundService {
  private provider: ethers.JsonRpcProvider;
  private signer?: ethers.Signer;
  private contract: ethers.Contract;
  private usdcContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA.rpcUrl);
    this.contract = new ethers.Contract(CHAINCROWDFUND_CONTRACT_ADDRESS, CHAINCROWDFUND_ABI, this.provider) as ethers.Contract;
    this.usdcContract = new ethers.Contract(ARBITRUM_SEPOLIA.usdcAddress, USDC_ABI, this.provider) as ethers.Contract;
  }

  setSigner(signer: ethers.Signer) {
    this.signer = signer;
    this.contract = this.contract.connect(signer) as ethers.Contract;
    this.usdcContract = this.usdcContract.connect(signer) as ethers.Contract;
  }

  // Campaign management
  async createCampaign(
    title: string,
    description: string,
    goalAmount: string, // in USDC (e.g., "1000" for 1000 USDC)
    duration: number, // in seconds
    category: string
  ): Promise<string> {
    if (!this.signer) throw new Error("Signer not set");
    
    const goalAmountWei = ethers.parseUnits(goalAmount, 6); // USDC has 6 decimals
    const tx = await this.contract.createCampaign(title, description, goalAmountWei, duration, category);
    await tx.wait();
    return tx.hash;
  }

  // Get campaign count
  async getCampaignCount(): Promise<number> {
    const count = await this.contract.campaignCount();
    return Number(count);
  }

  // Get single campaign
  async getCampaign(campaignId: number): Promise<Campaign> {
    const result = await this.contract.getCampaign(campaignId);
    return {
      id: campaignId,
      title: result[0],
      description: result[1],
      goalAmount: result[2],
      raisedAmount: result[3],
      creator: result[4],
      deadline: result[5],
      category: result[6],
      isCompleted: result[7],
      hasSubmittedResults: result[8]
    };
  }

  // Get all campaigns
  async getAllCampaigns(): Promise<Campaign[]> {
    const count = await this.getCampaignCount();
    const campaigns: Campaign[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const campaign = await this.getCampaign(i);
        campaigns.push(campaign);
      } catch (error) {
        console.error(`Error fetching campaign ${i}:`, error);
      }
    }
    
    return campaigns;
  }

  // Get campaign contributions
  async getCampaignContributions(campaignId: number): Promise<Contribution[]> {
    const contributions = await this.contract.getContributions(campaignId);
    return contributions.map((contrib: {
      contributor: string;
      amount: bigint;
      timestamp: bigint;
      isCrossChain: boolean;
      sourceChainDomain: number;
      originalTxHash: string;
    }) => ({
      contributor: contrib.contributor,
      amount: contrib.amount,
      timestamp: contrib.timestamp,
      isCrossChain: contrib.isCrossChain,
      sourceChainDomain: Number(contrib.sourceChainDomain),
      originalTxHash: contrib.originalTxHash
    }));
  }

  // USDC operations
  async getUSDCBalance(address: string): Promise<string> {
    const balance = await this.usdcContract.balanceOf(address);
    return ethers.formatUnits(balance, 6);
  }

  async getUSDCAllowance(owner: string): Promise<string> {
    const allowance = await this.usdcContract.allowance(owner, CHAINCROWDFUND_CONTRACT_ADDRESS);
    return ethers.formatUnits(allowance, 6);
  }

  async approveUSDC(amount: string): Promise<string> {
    if (!this.signer) throw new Error("Signer not set");
    
    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await this.usdcContract.approve(CHAINCROWDFUND_CONTRACT_ADDRESS, amountWei);
    await tx.wait();
    return tx.hash;
  }

  // Direct contribution
  async contribute(campaignId: number, amount: string): Promise<string> {
    if (!this.signer) throw new Error("Signer not set");
    
    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await this.contract.contribute(campaignId, amountWei);
    await tx.wait();
    return tx.hash;
  }

  // Campaign completion
  async submitResults(campaignId: number): Promise<string> {
    if (!this.signer) throw new Error("Signer not set");
    
    const tx = await this.contract.submitResults(campaignId);
    await tx.wait();
    return tx.hash;
  }

  async releaseFunds(campaignId: number): Promise<string> {
    if (!this.signer) throw new Error("Signer not set");
    
    const tx = await this.contract.releaseFunds(campaignId);
    await tx.wait();
    return tx.hash;
  }

  async refund(campaignId: number): Promise<string> {
    if (!this.signer) throw new Error("Signer not set");
    
    const tx = await this.contract.refund(campaignId);
    await tx.wait();
    return tx.hash;
  }

  // Utility functions
  formatUSDC(amount: bigint): string {
    return ethers.formatUnits(amount, 6);
  }

  parseUSDC(amount: string): bigint {
    return ethers.parseUnits(amount, 6);
  }

  formatDeadline(timestamp: bigint): string {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  }

  isExpired(deadline: bigint): boolean {
    return Date.now() > Number(deadline) * 1000;
  }

  getProgressPercentage(raised: bigint, goal: bigint): number {
    if (goal === BigInt(0)) return 0;
    return Math.min(Number((raised * BigInt(100)) / goal), 100);
  }
}

// Export singleton instance
export const chainCrowdFundService = new ChainCrowdFundService(); 