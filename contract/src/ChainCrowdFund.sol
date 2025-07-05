// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ChainCrowdFund {
    // Stablecoin 
    IERC20 public usdc;
    
    // Contribution details
    struct Contribution {
        address contributor;
        uint256 amount;
        uint256 timestamp;
        bool isCrossChain;
        uint32 sourceChainDomain; // CCTP domain of source chain
        bytes32 originalTxHash; // Original transaction hash from source chain
    }
    
    // Cross-chain contribution tracking
    struct CrossChainContribution {
        uint256 campaignId;
        address contributor;
        uint256 amount;
        uint32 sourceChainDomain;
        bytes32 originalTxHash;
        bytes32 messageHash;
        bool processed;
        uint256 timestamp;
    }
    
    // Campaign details
    struct Campaign {
        string title;
        string description;
        uint256 goalAmount;
        uint256 raisedAmount;
        address creator;
        uint256 deadline;
        string category;
        bool isCompleted;
        bool hasSubmittedResults;
        Contribution[] contributions;
        mapping(address => uint256) contributorIndex; // Track contributor's index in contributions array
    }
    
    // Campaign ID to Campaign
    mapping(uint256 => Campaign) public campaigns;
    uint256 public campaignCount;
    
    // Cross-chain contribution tracking
    mapping(bytes32 => CrossChainContribution) public crossChainContributions;
    mapping(bytes32 => bool) public processedMessages; // Track processed CCTP messages
    
    // CCTP Message Transmitter for verification
    address public messageTransmitter;
    
    // Supported CCTP domains
    mapping(uint32 => bool) public supportedDomains;

    // Events for transparency
    event CampaignCreated(uint256 indexed campaignId, address creator, uint256 goal, uint256 deadline, string description);
    event Contributed(uint256 indexed campaignId, address contributor, uint256 amount, uint256 timestamp);
    event CrossChainContributed(
        uint256 indexed campaignId, 
        address contributor, 
        uint256 amount, 
        uint32 sourceChainDomain,
        bytes32 originalTxHash,
        bytes32 messageHash
    );
    event ResultsSubmitted(uint256 indexed campaignId, address creator);
    event FundsReleased(uint256 indexed campaignId, uint256 amount);
    event Refunded(uint256 indexed campaignId, address contributor, uint256 amount);

    // Errors
    error InvalidMessageTransmitter();
    error UnsupportedDomain(uint32 domain);
    error MessageAlreadyProcessed(bytes32 messageHash);
    error InvalidCrossChainData();

    constructor(address _usdc, address _messageTransmitter) {
        usdc = IERC20(_usdc);
        messageTransmitter = _messageTransmitter;
        
        // Initialize supported CCTP domains (testnet)
        supportedDomains[0] = true; // Ethereum Sepolia
        supportedDomains[1] = true; // Avalanche Fuji
        supportedDomains[3] = true; // Arbitrum Sepolia
        supportedDomains[6] = true; // Base Sepolia
    }

    // Modifier to ensure only message transmitter can call cross-chain functions
    modifier onlyMessageTransmitter() {
        if (msg.sender != messageTransmitter) revert InvalidMessageTransmitter();
        _;
    }

    // Create a new campaign
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goalAmount,
        uint256 _duration,
        string memory _category
    ) external {
        require(_goalAmount > 0, "Goal must be positive");
        require(_duration > 0, "Duration must be positive");

        uint256 campaignId = campaignCount++;
        Campaign storage campaign = campaigns[campaignId];
        
        campaign.title = _title;
        campaign.description = _description;
        campaign.goalAmount = _goalAmount;
        campaign.raisedAmount = 0;
        campaign.creator = msg.sender;
        campaign.deadline = block.timestamp + _duration;
        campaign.category = _category;
        campaign.isCompleted = false;
        campaign.hasSubmittedResults = false;

        emit CampaignCreated(campaignId, msg.sender, _goalAmount, campaign.deadline, _description);
    }

    // Contribute USDC to a campaign (direct contribution)
    function contribute(uint256 _campaignId, uint256 _amount) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(!campaign.isCompleted, "Campaign completed");
        require(_amount > 0, "Amount must be positive");

        require(usdc.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");
        
        _addContribution(_campaignId, msg.sender, _amount, false, 0, bytes32(0));
    }

    // Handle cross-chain contribution via CCTP
    function contributeCrossChain(
        uint256 _campaignId,
        address _contributor,
        uint256 _amount,
        uint32 _sourceChainDomain,
        bytes32 _originalTxHash,
        bytes32 _messageHash
    ) external onlyMessageTransmitter {
        if (!supportedDomains[_sourceChainDomain]) revert UnsupportedDomain(_sourceChainDomain);
        if (processedMessages[_messageHash]) revert MessageAlreadyProcessed(_messageHash);
        
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(!campaign.isCompleted, "Campaign completed");
        require(_amount > 0, "Amount must be positive");

        // Mark message as processed
        processedMessages[_messageHash] = true;
        
        // Store cross-chain contribution details
        crossChainContributions[_messageHash] = CrossChainContribution({
            campaignId: _campaignId,
            contributor: _contributor,
            amount: _amount,
            sourceChainDomain: _sourceChainDomain,
            originalTxHash: _originalTxHash,
            messageHash: _messageHash,
            processed: true,
            timestamp: block.timestamp
        });

        // Add to campaign contributions
        _addContribution(_campaignId, _contributor, _amount, true, _sourceChainDomain, _originalTxHash);

        emit CrossChainContributed(_campaignId, _contributor, _amount, _sourceChainDomain, _originalTxHash, _messageHash);
    }

    // Internal function to add contribution to campaign
    function _addContribution(
        uint256 _campaignId,
        address _contributor,
        uint256 _amount,
        bool _isCrossChain,
        uint32 _sourceChainDomain,
        bytes32 _originalTxHash
    ) internal {
        Campaign storage campaign = campaigns[_campaignId];
        
        // Check if contributor already exists
        uint256 contributorIndex = campaign.contributorIndex[_contributor];
        if (contributorIndex == 0) {
            // New contributor
            campaign.contributions.push(Contribution({
                contributor: _contributor,
                amount: _amount,
                timestamp: block.timestamp,
                isCrossChain: _isCrossChain,
                sourceChainDomain: _sourceChainDomain,
                originalTxHash: _originalTxHash
            }));
            campaign.contributorIndex[_contributor] = campaign.contributions.length;
        } else {
            // Existing contributor - update amount
            campaign.contributions[contributorIndex - 1].amount += _amount;
            campaign.contributions[contributorIndex - 1].timestamp = block.timestamp;
        }
        
        campaign.raisedAmount += _amount;

        emit Contributed(_campaignId, _contributor, _amount, block.timestamp);
    }

    // Submit campaign results
    function submitResults(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Only creator");
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(!campaign.isCompleted, "Campaign already completed");
        require(campaign.raisedAmount >= campaign.goalAmount, "Goal not met");
        require(!campaign.hasSubmittedResults, "Results already submitted");

        campaign.hasSubmittedResults = true;
        emit ResultsSubmitted(_campaignId, msg.sender);
    }

    // Release funds to creator if goal met and results submitted
    function releaseFunds(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Only creator");
        require(campaign.hasSubmittedResults, "Results not submitted");
        require(!campaign.isCompleted, "Campaign already completed");
        require(campaign.raisedAmount >= campaign.goalAmount, "Goal not met");

        campaign.isCompleted = true;
        require(usdc.transfer(campaign.creator, campaign.raisedAmount), "USDC transfer failed");

        emit FundsReleased(_campaignId, campaign.raisedAmount);
    }

    // Refund contributors if goal not met
    function refund(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.deadline, "Campaign ongoing");
        require(!campaign.isCompleted, "Campaign already completed");
        require(campaign.raisedAmount < campaign.goalAmount, "Goal met");

        uint256 contributorIndex = campaign.contributorIndex[msg.sender];
        require(contributorIndex > 0, "No contribution");

        Contribution storage contribution = campaign.contributions[contributorIndex - 1];
        uint256 amount = contribution.amount;
        require(amount > 0, "No contribution");

        contribution.amount = 0;
        require(usdc.transfer(msg.sender, amount), "USDC refund failed");

        campaign.raisedAmount -= amount;

        // Only mark as completed if this was the last contribution
        if (campaign.raisedAmount == 0) {
            campaign.isCompleted = true;
        }

        emit Refunded(_campaignId, msg.sender, amount);
    }

    // Get campaign details
    function getCampaign(uint256 _campaignId) external view returns (
        string memory title,
        string memory description,
        uint256 goalAmount,
        uint256 raisedAmount,
        address creator,
        uint256 deadline,
        string memory category,
        bool isCompleted,
        bool hasSubmittedResults
    ) {
        Campaign storage campaign = campaigns[_campaignId];
        return (
            campaign.title,
            campaign.description,
            campaign.goalAmount,
            campaign.raisedAmount,
            campaign.creator,
            campaign.deadline,
            campaign.category,
            campaign.isCompleted,
            campaign.hasSubmittedResults
        );
    }

    // Get contribution details for a specific address in a campaign
    function getContribution(uint256 _campaignId, address _contributor) external view returns (
        uint256 amount, 
        uint256 timestamp,
        bool isCrossChain,
        uint32 sourceChainDomain,
        bytes32 originalTxHash
    ) {
        uint256 contributorIndex = campaigns[_campaignId].contributorIndex[_contributor];
        require(contributorIndex > 0, "No contribution");
        Contribution storage contribution = campaigns[_campaignId].contributions[contributorIndex - 1];
        return (
            contribution.amount,
            contribution.timestamp,
            contribution.isCrossChain,
            contribution.sourceChainDomain,
            contribution.originalTxHash
        );
    }

    // Get all contributions for a campaign
    function getContributions(uint256 _campaignId) external view returns (Contribution[] memory) {
        return campaigns[_campaignId].contributions;
    }

    // Get cross-chain contribution details
    function getCrossChainContribution(bytes32 _messageHash) external view returns (CrossChainContribution memory) {
        return crossChainContributions[_messageHash];
    }

    // Admin functions
    function updateMessageTransmitter(address _newMessageTransmitter) external {
        // In a real implementation, you'd want proper access control here
        require(msg.sender == messageTransmitter, "Only current message transmitter");
        messageTransmitter = _newMessageTransmitter;
    }

    function updateSupportedDomain(uint32 _domain, bool _supported) external {
        // In a real implementation, you'd want proper access control here
        supportedDomains[_domain] = _supported;
    }
}