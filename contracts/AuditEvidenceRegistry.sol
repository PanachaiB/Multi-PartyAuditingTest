// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AuditAccessManager.sol"; // Import to link the logic

contract AuditEvidenceRegistry {
    AuditAccessManager public accessManager;

    struct AuditSession {
        bytes32 smtRoot;
        uint256 voteCount;
        bool finalized;
        bool isSuccess;
    }
    
    event AuditFinalized(
        bytes32 indexed challengeDigest, 
        bool result, 
        uint256 timestamp
    );

    mapping(bytes32 => AuditSession) public audits;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    constructor(address _accessManagerAddress) {
        accessManager = AuditAccessManager(_accessManagerAddress);
    }

    function submitVote(bytes32 h_chal, bytes32 _smtRoot, bool localVerdict) external {
        // Validate user via Access Manager [cite: 6]
        require(accessManager.isAuthorizedPeer(msg.sender), "Unauthorized");
        
        // Retrieve the global threshold T from Phase 1 
        (uint256 requiredT, ) = accessManager.getAuditConfig();

        AuditSession storage session = audits[h_chal];
        require(!session.finalized, "Audit already finished");
        require(!hasVoted[h_chal][msg.sender], "Peer already voted");

        if (localVerdict) {
            session.voteCount += 1;
            session.smtRoot = _smtRoot;
        }

        hasVoted[h_chal][msg.sender] = true;

        // Use the centralized threshold for finalization [cite: 17]
        if (session.voteCount >= requiredT) {
            session.finalized = true;
            session.isSuccess = true;
            emit AuditFinalized(h_chal, true, block.timestamp);
        }
    }
}