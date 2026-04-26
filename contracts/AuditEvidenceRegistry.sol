// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AuditEvidenceRegistry
 * @dev Creates the voting system, allowing for multi-party collaborative auditing.
 */

contract AuditEvidenceRegistry {
    struct AuditSession {
        bytes32 smtRoot;   
        uint256 voteCount; 
        bool finalized;    
        bool isSuccess;      
    }

    uint256 public constant THRESHOLD = 2; // T = 2 for this demo
    mapping(bytes32 => AuditSession) public audits;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    event AuditFinalized(bytes32 challengeDigest, bool result);

    // Phase 4: Submit local verdict (v_j)
    function submitVote(bytes32 h_chal, bytes32 _smtRoot, bool localVerdict) external {
        AuditSession storage session = audits[h_chal];
        
        require(!session.finalized, "Audit already finished");
        require(!hasVoted[h_chal][msg.sender], "Peer already voted");

        if (localVerdict) {
            session.voteCount += 1;
            session.smtRoot = _smtRoot; // Store the root for public verification
        }

        hasVoted[h_chal][msg.sender] = true;

        // Phase 5: Threshold-based Decision
        if (session.voteCount >= THRESHOLD) {
            session.finalized = true;
            session.isSuccess = true;
            emit AuditFinalized(h_chal, true);
        }
    }
}