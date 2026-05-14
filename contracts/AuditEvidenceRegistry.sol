// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AuditAccessManager.sol";

contract AuditEvidenceRegistry {
    AuditAccessManager public accessManager;

    struct AuditSession {
        string partyId;      
        bytes32 smtRoot;     // Anchored Merkle Root from Phase 3
        uint256 voteCount;   // Number of success votes from auditors
        bool finalized;      // Becomes true when threshold T is reached
        bool isSuccess;      // Becomes true if finalized with valid integrity
    }

    // Challenge Hash (h_chal) => Audit Session
    mapping(bytes32 => AuditSession) public audits;
    
    // Track unique voters per session: h_chal => Peer Address => Has Voted
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    event AuditFinalized(bytes32 indexed h_chal, bool success, uint256 timestamp);

    constructor(address _accessManager) {
        accessManager = AuditAccessManager(_accessManager);
    }

    /**
     * @dev PHASE 3 (Anchor): Cloud anchors the expected Merkle Root
     */
    function initializeAudit(
        bytes32 h_chal, 
        string memory _partyId, 
        bytes32 _expectedRoot
    ) external {
        require(audits[h_chal].smtRoot == 0, "Audit already anchored");
        
        audits[h_chal].partyId = _partyId;
        audits[h_chal].smtRoot = _expectedRoot; 
        audits[h_chal].finalized = false;
        audits[h_chal].voteCount = 0;
    }

    /**
     * @dev PHASE 3 (Audit): Anonymous auditors submit ZKP-authorized votes
     */
    function submitVote(
        string memory partyId,
        bytes32 h_chal,
        bytes32 _calculatedRoot,
        bool localVerdict,
        bytes32 zkpProof,  
        string memory epoch 
    ) external {
        // 1. ANONYMOUS AUTHENTICATION CHECK (ZKP)
        bool isValid = accessManager.verifyZkpProof(partyId, zkpProof, msg.sender, epoch);
        require(isValid, "ZKP REJECTED: Invalid Identity Proof");

        AuditSession storage session = audits[h_chal];
        
        // 2. STATE CHECKS
        require(bytes(session.partyId).length != 0, "Audit not yet anchored by cloud");
        require(keccak256(bytes(session.partyId)) == keccak256(bytes(partyId)), "Party mismatch");
        require(!session.finalized, "Audit already finished");
        require(!hasVoted[h_chal][msg.sender], "Peer already voted");

        // 3. INTEGRITY CHECK
        // Vote only increments if the auditor's local calculation matches the cloud's anchor
        if (localVerdict) {
            require(_calculatedRoot == session.smtRoot, "INTEGRITY CRITICAL: Root mismatch detected!");
            session.voteCount += 1;
        }

        // Prevent double voting for this session
        hasVoted[h_chal][msg.sender] = true;

        // 4. CONSENSUS LOGIC
        // Dynamically fetch threshold T for this specific party from AccessManager
        (uint256 requiredT, ) = accessManager.getAuditConfig(partyId);

        if (session.voteCount >= requiredT) {
            session.finalized = true;
            session.isSuccess = true;
            emit AuditFinalized(h_chal, true, block.timestamp);
        }
    }

    /**
     * @dev PHASE 4 (Gatekeeper): Verifies consensus before allowing data retrieval
     * This is called by the Data Owner in phase4.ts
     */
    function verifyConsensus(bytes32 h_chal) external view returns (bool) {
        AuditSession storage session = audits[h_chal];
        
        // Return true only if auditors successfully reached the threshold
        return (session.finalized && session.isSuccess);
    }
}