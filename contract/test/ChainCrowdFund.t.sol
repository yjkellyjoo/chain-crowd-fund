// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ChainCrowdFund} from "../src/ChainCrowdFund.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";



// Simplified Mock USDC contract for testing ChainCrowdFund
contract MockCCTPUSDC is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "USDC: transfer amount exceeds allowance");
        
        _transfer(from, to, amount);
        _allowances[from][msg.sender] = currentAllowance - amount;
        return true;
    }
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "USDC: transfer from the zero address");
        require(to != address(0), "USDC: transfer to the zero address");
        
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "USDC: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
        }
        _balances[to] += amount;
    }
    
    // Test helper function - simulates CCTP minting USDC to destination
    function mint(address to, uint256 amount) external {
        require(to != address(0), "USDC: mint to the zero address");
        _totalSupply += amount;
        _balances[to] += amount;
    }
    
    // Test helper function - simulates CCTP burning USDC from source
    function burn(address from, uint256 amount) external {
        require(from != address(0), "USDC: burn from the zero address");
        uint256 accountBalance = _balances[from];
        require(accountBalance >= amount, "USDC: burn amount exceeds balance");
        unchecked {
            _balances[from] = accountBalance - amount;
        }
        _totalSupply -= amount;
    }
}

// Mock MessageTransmitter for testing CCTP functionality
contract MockMessageTransmitter {
    mapping(bytes32 => bool) public processedMessages;
    
    function receiveMessage(bytes calldata message, bytes calldata signature) external returns (bool) {
        // Mock implementation for testing
        return true;
    }
    
    function isMessageProcessed(bytes32 messageHash) external view returns (bool) {
        return processedMessages[messageHash];
    }
    
    function markMessageProcessed(bytes32 messageHash) external {
        processedMessages[messageHash] = true;
    }
}

contract ChainCrowdFundTest is Test {
    ChainCrowdFund public crowdFund;
    MockCCTPUSDC public usdc;
    MockMessageTransmitter public messageTransmitter;
    
    address public creator = address(0x1);
    address public contributor1 = address(0x2);
    address public contributor2 = address(0x3);
    address public attacker = address(0x4);
    
    uint256 constant GOAL_AMOUNT = 1000e6; // 1000 USDC
    uint256 constant DURATION = 30 days;
    uint256 constant CONTRIBUTION_AMOUNT = 100e6; // 100 USDC
    
    // CCTP test parameters
    uint32 constant ETHEREUM_DOMAIN = 0;
    uint32 constant AVALANCHE_DOMAIN = 1;
    uint32 constant ARBITRUM_DOMAIN = 3;
    uint32 constant UNSUPPORTED_DOMAIN = 999;
    
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

    function setUp() public {
        // Deploy mock contracts
        usdc = new MockCCTPUSDC();
        messageTransmitter = new MockMessageTransmitter();
        
        // Deploy ChainCrowdFund contract
        crowdFund = new ChainCrowdFund(address(usdc), address(messageTransmitter));
        
        // Setup initial balances - simulate users having USDC
        usdc.mint(contributor1, 10000e6);
        usdc.mint(contributor2, 10000e6);
        
        // Setup allowances for direct contributions
        vm.prank(contributor1);
        usdc.approve(address(crowdFund), type(uint256).max);
        
        vm.prank(contributor2);
        usdc.approve(address(crowdFund), type(uint256).max);
    }
    
    function createTestCampaign() internal returns (uint256 campaignId) {
        vm.prank(creator);
        crowdFund.createCampaign(
            "Test Campaign",
            "Test Description",
            GOAL_AMOUNT,
            DURATION,
            "Technology"
        );
        return 0; // First campaign ID
    }
    
    // Basic functionality tests
    function testCreateCampaign() public {
        vm.expectEmit(true, true, true, true);
        emit CampaignCreated(0, creator, GOAL_AMOUNT, block.timestamp + DURATION, "Test Description");
        
        uint256 campaignId = createTestCampaign();
        
        (
            string memory title,
            string memory description,
            uint256 goalAmount,
            uint256 raisedAmount,
            address campaignCreator,
            uint256 deadline,
            string memory category,
            bool isCompleted,
            bool hasSubmittedResults
        ) = crowdFund.getCampaign(campaignId);
        
        assertEq(title, "Test Campaign");
        assertEq(description, "Test Description");
        assertEq(goalAmount, GOAL_AMOUNT);
        assertEq(raisedAmount, 0);
        assertEq(campaignCreator, creator);
        assertEq(deadline, block.timestamp + DURATION);
        assertEq(category, "Technology");
        assertEq(isCompleted, false);
        assertEq(hasSubmittedResults, false);
    }
    
    function testDirectContribution() public {
        uint256 campaignId = createTestCampaign();
        
        uint256 initialBalance = usdc.balanceOf(contributor1);
        
        vm.expectEmit(true, true, true, true);
        emit Contributed(campaignId, contributor1, CONTRIBUTION_AMOUNT, block.timestamp);
        
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT);
        
        // Check balances
        assertEq(usdc.balanceOf(contributor1), initialBalance - CONTRIBUTION_AMOUNT);
        assertEq(usdc.balanceOf(address(crowdFund)), CONTRIBUTION_AMOUNT);
        
        // Check campaign state
        (, , , uint256 raisedAmount, , , , , ) = crowdFund.getCampaign(campaignId);
        assertEq(raisedAmount, CONTRIBUTION_AMOUNT);
        
        // Check contribution details
        (uint256 amount, uint256 timestamp, bool isCrossChain, uint32 sourceChainDomain, bytes32 originalTxHash) = 
            crowdFund.getContribution(campaignId, contributor1);
        assertEq(amount, CONTRIBUTION_AMOUNT);
        assertEq(timestamp, block.timestamp);
        assertEq(isCrossChain, false);
        assertEq(sourceChainDomain, 0);
        assertEq(originalTxHash, bytes32(0));
    }
    
    // CCTP Cross-Chain Contribution Tests
    function testCrossChainContribution() public {
        uint256 campaignId = createTestCampaign();
        
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        vm.expectEmit(true, true, true, true);
        emit Contributed(campaignId, contributor1, CONTRIBUTION_AMOUNT, block.timestamp);
        
        vm.expectEmit(true, true, true, true);
        emit CrossChainContributed(campaignId, contributor1, CONTRIBUTION_AMOUNT, ETHEREUM_DOMAIN, originalTxHash, messageHash);
        
        // Simulate CCTP message transmitter calling contributeCrossChain
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            CONTRIBUTION_AMOUNT,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
        
        // Check campaign state
        (, , , uint256 raisedAmount, , , , , ) = crowdFund.getCampaign(campaignId);
        assertEq(raisedAmount, CONTRIBUTION_AMOUNT);
        
        // Check contribution details
        (uint256 amount, uint256 timestamp, bool isCrossChain, uint32 sourceChainDomain, bytes32 storedTxHash) = 
            crowdFund.getContribution(campaignId, contributor1);
        assertEq(amount, CONTRIBUTION_AMOUNT);
        assertEq(timestamp, block.timestamp);
        assertEq(isCrossChain, true);
        assertEq(sourceChainDomain, ETHEREUM_DOMAIN);
        assertEq(storedTxHash, originalTxHash);
        
        // Check cross-chain contribution tracking
        ChainCrowdFund.CrossChainContribution memory ccContribution = crowdFund.getCrossChainContribution(messageHash);
        assertEq(ccContribution.campaignId, campaignId);
        assertEq(ccContribution.contributor, contributor1);
        assertEq(ccContribution.amount, CONTRIBUTION_AMOUNT);
        assertEq(ccContribution.sourceChainDomain, ETHEREUM_DOMAIN);
        assertEq(ccContribution.originalTxHash, originalTxHash);
        assertEq(ccContribution.messageHash, messageHash);
    }
    
    function testSimulatedCCTPWorkflow() public {
        uint256 campaignId = createTestCampaign();
        uint256 contributionAmount = 300e6;
        
        // Simulate the CCTP workflow from ChainCrowdFund's perspective:
        // 1. User burns USDC on source chain (happens outside our contract)
        // 2. CCTP infrastructure transmits message cross-chain
        // 3. MessageTransmitter receives message and mints USDC to crowdfunding contract
        // 4. MessageTransmitter calls contributeCrossChain() on our contract
        
        bytes32 messageHash = keccak256("cctp_message_hash");
        bytes32 originalTxHash = keccak256("source_chain_tx");
        
        // Step 1: Simulate CCTP minting USDC to the crowdfunding contract
        // (In real CCTP, this would be done by TokenMinter via MessageTransmitter)
        usdc.mint(address(crowdFund), contributionAmount);
        
        // Step 2: MessageTransmitter calls contributeCrossChain to record the contribution
        vm.expectEmit(true, true, true, true);
        emit Contributed(campaignId, contributor1, contributionAmount, block.timestamp);
        
        vm.expectEmit(true, true, true, true);
        emit CrossChainContributed(campaignId, contributor1, contributionAmount, ETHEREUM_DOMAIN, originalTxHash, messageHash);
        
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            contributionAmount,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
        
        // Verify final state
        (, , , uint256 raisedAmount, , , , , ) = crowdFund.getCampaign(campaignId);
        assertEq(raisedAmount, contributionAmount);
        
        (uint256 amount, , bool isCrossChain, uint32 sourceChainDomain, bytes32 storedTxHash) = 
            crowdFund.getContribution(campaignId, contributor1);
        assertEq(amount, contributionAmount);
        assertTrue(isCrossChain);
        assertEq(sourceChainDomain, ETHEREUM_DOMAIN);
        assertEq(storedTxHash, originalTxHash);
        
        // Check cross-chain contribution tracking
        ChainCrowdFund.CrossChainContribution memory ccContribution = crowdFund.getCrossChainContribution(messageHash);
        assertEq(ccContribution.processed, true);
        assertEq(ccContribution.timestamp, block.timestamp);
        
        // Check message processing tracking
        assertEq(crowdFund.processedMessages(messageHash), true);
    }
    
    function testCrossChainContributionFromDifferentDomains() public {
        uint256 campaignId = createTestCampaign();
        
        // Test contributions from different supported domains
        uint32[] memory domains = new uint32[](4);
        domains[0] = ETHEREUM_DOMAIN;
        domains[1] = AVALANCHE_DOMAIN;
        domains[2] = ARBITRUM_DOMAIN;
        domains[3] = 6; // Base Sepolia
        
        for (uint i = 0; i < domains.length; i++) {
            bytes32 messageHash = keccak256(abi.encodePacked("message_hash_", i));
            bytes32 originalTxHash = keccak256(abi.encodePacked("original_tx_hash_", i));
            
            vm.prank(address(messageTransmitter));
            crowdFund.contributeCrossChain(
                campaignId,
                contributor1,
                CONTRIBUTION_AMOUNT,
                domains[i],
                originalTxHash,
                messageHash
            );
            
            // Verify contribution was recorded
            ChainCrowdFund.CrossChainContribution memory ccContribution = crowdFund.getCrossChainContribution(messageHash);
            assertEq(ccContribution.sourceChainDomain, domains[i]);
            assertEq(ccContribution.processed, true);
        }
        
        // Check total raised amount
        (, , , uint256 raisedAmount, , , , , ) = crowdFund.getCampaign(campaignId);
        assertEq(raisedAmount, CONTRIBUTION_AMOUNT * 4);
    }
    
    function testCrossChainContributionFailsWithUnsupportedDomain() public {
        uint256 campaignId = createTestCampaign();
        
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        vm.expectRevert(abi.encodeWithSelector(ChainCrowdFund.UnsupportedDomain.selector, UNSUPPORTED_DOMAIN));
        
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            CONTRIBUTION_AMOUNT,
            UNSUPPORTED_DOMAIN,
            originalTxHash,
            messageHash
        );
    }
    
    function testCrossChainContributionFailsWithDuplicateMessage() public {
        uint256 campaignId = createTestCampaign();
        
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        // First contribution should succeed
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            CONTRIBUTION_AMOUNT,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
        
        // Second contribution with same message hash should fail
        vm.expectRevert(abi.encodeWithSelector(ChainCrowdFund.MessageAlreadyProcessed.selector, messageHash));
        
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            CONTRIBUTION_AMOUNT,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
    }
    
    function testCrossChainContributionFailsWithInvalidMessageTransmitter() public {
        uint256 campaignId = createTestCampaign();
        
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        vm.expectRevert(abi.encodeWithSelector(ChainCrowdFund.InvalidMessageTransmitter.selector));
        
        // Try to call from non-message transmitter address
        vm.prank(attacker);
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            CONTRIBUTION_AMOUNT,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
    }
    
    function testMixedContributions() public {
        uint256 campaignId = createTestCampaign();
        
        // Direct contribution
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT);
        
        // Cross-chain contribution
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor2,
            CONTRIBUTION_AMOUNT,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
        
        // Check total raised amount
        (, , , uint256 raisedAmount, , , , , ) = crowdFund.getCampaign(campaignId);
        assertEq(raisedAmount, CONTRIBUTION_AMOUNT * 2);
        
        // Check individual contributions
        (uint256 amount1, , bool isCrossChain1, , ) = crowdFund.getContribution(campaignId, contributor1);
        (uint256 amount2, , bool isCrossChain2, , ) = crowdFund.getContribution(campaignId, contributor2);
        
        assertEq(amount1, CONTRIBUTION_AMOUNT);
        assertEq(isCrossChain1, false);
        assertEq(amount2, CONTRIBUTION_AMOUNT);
        assertEq(isCrossChain2, true);
    }
    
    function testMultipleContributionsFromSameContributor() public {
        uint256 campaignId = createTestCampaign();
        
        // First direct contribution
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT);
        
        // Second direct contribution from same contributor
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT);
        
        // Cross-chain contribution from same contributor
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            CONTRIBUTION_AMOUNT,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
        
        // Check total contribution from contributor1
        (uint256 totalAmount, , , , ) = crowdFund.getContribution(campaignId, contributor1);
        assertEq(totalAmount, CONTRIBUTION_AMOUNT * 3);
        
        // Check campaign total
        (, , , uint256 raisedAmount, , , , , ) = crowdFund.getCampaign(campaignId);
        assertEq(raisedAmount, CONTRIBUTION_AMOUNT * 3);
    }
    
    function testSuccessfulCampaignWorkflow() public {
        uint256 campaignId = createTestCampaign();
        
        // Contribute enough to reach goal
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, GOAL_AMOUNT);
        
        // Submit results
        vm.prank(creator);
        crowdFund.submitResults(campaignId);
        
        // Check results submitted
        (, , , , , , , , bool hasSubmittedResults) = crowdFund.getCampaign(campaignId);
        assertEq(hasSubmittedResults, true);
        
        // Release funds
        uint256 creatorBalanceBefore = usdc.balanceOf(creator);
        
        vm.prank(creator);
        crowdFund.releaseFunds(campaignId);
        
        // Check funds released
        assertEq(usdc.balanceOf(creator), creatorBalanceBefore + GOAL_AMOUNT);
        (, , , , , , , bool isCompleted, ) = crowdFund.getCampaign(campaignId);
        assertEq(isCompleted, true);
    }
    
    function testRefundWorkflow() public {
        uint256 campaignId = createTestCampaign();
        
        // Contribute less than goal
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT);
        
        // Wait for deadline to pass
        vm.warp(block.timestamp + DURATION + 1);
        
        // Request refund
        uint256 contributorBalanceBefore = usdc.balanceOf(contributor1);
        
        vm.prank(contributor1);
        crowdFund.refund(campaignId);
        
        // Check refund
        assertEq(usdc.balanceOf(contributor1), contributorBalanceBefore + CONTRIBUTION_AMOUNT);
        
        // Check campaign state
        (, , , uint256 raisedAmount, , , , bool isCompleted, ) = crowdFund.getCampaign(campaignId);
        assertEq(raisedAmount, 0);
        assertEq(isCompleted, true);
    }
    
    function testAdminFunctions() public {
        // Test updating message transmitter
        address newMessageTransmitter = address(0x999);
        
        vm.prank(address(messageTransmitter));
        crowdFund.updateMessageTransmitter(newMessageTransmitter);
        
        assertEq(crowdFund.messageTransmitter(), newMessageTransmitter);
        
        // Test updating supported domain
        crowdFund.updateSupportedDomain(UNSUPPORTED_DOMAIN, true);
        assertEq(crowdFund.supportedDomains(UNSUPPORTED_DOMAIN), true);
        
        crowdFund.updateSupportedDomain(ETHEREUM_DOMAIN, false);
        assertEq(crowdFund.supportedDomains(ETHEREUM_DOMAIN), false);
    }
    
    function testGetContributions() public {
        uint256 campaignId = createTestCampaign();
        
        // Add multiple contributions
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT);
        
        vm.prank(contributor2);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT * 2);
        
        // Get all contributions
        ChainCrowdFund.Contribution[] memory contributions = crowdFund.getContributions(campaignId);
        
        assertEq(contributions.length, 2);
        assertEq(contributions[0].contributor, contributor1);
        assertEq(contributions[0].amount, CONTRIBUTION_AMOUNT);
        assertEq(contributions[0].isCrossChain, false);
        
        assertEq(contributions[1].contributor, contributor2);
        assertEq(contributions[1].amount, CONTRIBUTION_AMOUNT * 2);
        assertEq(contributions[1].isCrossChain, false);
    }
    
    // Edge case tests
    function testContributionAfterDeadline() public {
        uint256 campaignId = createTestCampaign();
        
        // Warp past deadline
        vm.warp(block.timestamp + DURATION + 1);
        
        // Try to contribute - should fail
        vm.expectRevert("Campaign ended");
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, CONTRIBUTION_AMOUNT);
        
        // Cross-chain contribution should also fail
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        vm.expectRevert("Campaign ended");
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            CONTRIBUTION_AMOUNT,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
    }
    
    function testZeroAmountContribution() public {
        uint256 campaignId = createTestCampaign();
        
        // Try to contribute zero amount
        vm.expectRevert("Amount must be positive");
        vm.prank(contributor1);
        crowdFund.contribute(campaignId, 0);
        
        // Cross-chain zero contribution should also fail
        bytes32 messageHash = keccak256("test_message_hash");
        bytes32 originalTxHash = keccak256("original_tx_hash");
        
        vm.expectRevert("Amount must be positive");
        vm.prank(address(messageTransmitter));
        crowdFund.contributeCrossChain(
            campaignId,
            contributor1,
            0,
            ETHEREUM_DOMAIN,
            originalTxHash,
            messageHash
        );
    }
} 