// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AuditAccessManager
 * @dev Enforces a gateway to ensure only the intended are able to access blockchain.
 */

contract AuditAccessManager {
    address public dataOwner;
    bytes32 public currentChallengeDigest;
    bool public sessionActive;

    mapping(address => bool) public isAuthorizedPeer;

    event SessionActivated(bytes32 challengeDigest, uint256 timestamp);

    constructor() {
        dataOwner = msg.sender;
    }

    function authorizePeer(address peer) external {
        require(msg.sender == dataOwner, "Only Data Owner can authorize");
        isAuthorizedPeer[peer] = true;
    }

    function activateSession(bytes32 _h_chal) external {
        require(isAuthorizedPeer[msg.sender], "Not an authorized peer");
        currentChallengeDigest = _h_chal;
        sessionActive = true;
        
        emit SessionActivated(_h_chal, block.timestamp);
    }
}