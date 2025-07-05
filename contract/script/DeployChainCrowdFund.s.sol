// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ChainCrowdFund} from "../src/ChainCrowdFund.sol";

contract DeployChainCrowdFund is Script {
    // Arbitrum Sepolia Testnet CCTP Addresses
    address constant ARB_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant ARB_SEPOLIA_MESSAGE_TRANSMITTER = 0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872;

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy ChainCrowdFund with Arbitrum Sepolia CCTP contracts
        ChainCrowdFund crowdFund = new ChainCrowdFund(
            ARB_SEPOLIA_USDC,
            ARB_SEPOLIA_MESSAGE_TRANSMITTER
        );
        
        console.log("ChainCrowdFund deployed on Arbitrum Sepolia at:", address(crowdFund));
        console.log("USDC Contract:", ARB_SEPOLIA_USDC);
        console.log("MessageTransmitter Contract:", ARB_SEPOLIA_MESSAGE_TRANSMITTER);
        
        vm.stopBroadcast();
    }
} 