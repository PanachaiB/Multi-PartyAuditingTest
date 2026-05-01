// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AuditAccessManager {
    address public dataOwner;
    uint256 public threshold; // T: Required votes
    uint256 public totalPeers; // m: Total authorized peers
    
    mapping(address => bool) public isAuthorizedPeer;

    constructor(uint256 _threshold) {
        dataOwner = msg.sender;
        threshold = _threshold; // Set during Phase 1: Setup 
    }

    function authorizePeer(address peer) external {
        require(msg.sender == dataOwner, "Only Data Owner can authorize");
        if (!isAuthorizedPeer[peer]) {
            isAuthorizedPeer[peer] = true;
            totalPeers++; // Track m
        }
    }
    
    // New function to allow the Registry to check the rules
    function getAuditConfig() external view returns (uint256, uint256) {
        return (threshold, totalPeers);
    }
}