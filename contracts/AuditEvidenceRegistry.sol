// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AuditEvidenceRegistry {
    struct AuditSession {
        bytes32 smtRoot;   
        uint256 voteCount; 
        uint256 requiredThreshold;
        bool finalized;    
        bool isSuccess;      
        uint256 timestamp;
    }

    mapping(bytes32 => AuditSession) public audits;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    // Added timestamp to event for easier benchmarking in scripts
    event AuditFinalized(bytes32 indexed challengeDigest, bool result, uint256 timestamp);

    /**
     * @dev Submits a vote. 
     * @param targetT The threshold required to finalize this specific audit session.
     */
    function submitVote(
        bytes32 h_chal, 
        bytes32 _smtRoot, 
        bool localVerdict, 
        uint256 targetT
    ) external {
        AuditSession storage session = audits[h_chal];
        
        if (session.requiredThreshold == 0) {
            session.requiredThreshold = targetT;
        }

        require(!session.finalized, "Audit already finished");
        require(!hasVoted[h_chal][msg.sender], "Peer already voted");

        if (localVerdict) {
            session.voteCount += 1;
            session.smtRoot = _smtRoot;
        }

        hasVoted[h_chal][msg.sender] = true;

        if (session.voteCount >= session.requiredThreshold) {
            session.finalized = true;
            session.isSuccess = true;
            session.timestamp = block.timestamp;
            emit AuditFinalized(h_chal, true, block.timestamp);
        }
    }
}