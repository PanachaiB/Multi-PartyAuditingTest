// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AuditAccessManager.sol";

contract AuditEvidenceRegistry {
    AuditAccessManager public accessManager;

    struct AuditSession {
        string partyId;      // Bound to a specific company
        bytes32 smtRoot;
        uint256 voteCount;
        bool finalized;
        bool isSuccess;
    }

    // Challenge Hash => Audit Session
    mapping(bytes32 => AuditSession) public audits;
    // Challenge Hash => Peer Address => Has Voted
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    event AuditFinalized(bytes32 indexed h_chal, bool success, uint256 timestamp);

    constructor(address _accessManager) {
        accessManager = AuditAccessManager(_accessManager);
    }

    // This replaces the nested structure you had
    function submitVote(
        string memory partyId, 
        bytes32 h_chal, 
        bytes32 _smtRoot, 
        bool localVerdict
    ) external {
        // 1. Verify this peer belongs to this specific Party
        require(accessManager.verifyPeer(partyId, msg.sender), "Unauthorized for this Party");

        // 2. Get the specific security threshold for this Party
        (uint256 requiredT, ) = accessManager.getAuditConfig(partyId);

        AuditSession storage session = audits[h_chal];
        
        // 3. Initialize session with partyId if it's the first vote
        if (bytes(session.partyId).length == 0) {
            session.partyId = partyId;
        } else {
            // Ensure someone doesn't try to vote for Company A on Company B's challenge
            require(keccak256(bytes(session.partyId)) == keccak256(bytes(partyId)), "Party mismatch");
        }

        require(!session.finalized, "Audit already finished");
        require(!hasVoted[h_chal][msg.sender], "Peer already voted");

        if (localVerdict) {
            session.voteCount += 1;
            session.smtRoot = _smtRoot;
        }

        hasVoted[h_chal][msg.sender] = true;

        // 4. Finalize based on the Party's T threshold
        if (session.voteCount >= requiredT) {
            session.finalized = true;
            session.isSuccess = true;
            emit AuditFinalized(h_chal, true, block.timestamp);
        }
    }
}