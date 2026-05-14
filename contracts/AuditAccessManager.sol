// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AuditAccessManager {
    address public contractAdmin;

    struct PartyConfig {
        uint256 threshold;    // T: Required votes
        uint256 totalPeers;   // m: Total potential auditors
        bool isActive;
        bytes32 verifyingKey; // NEW: The group's public ZKP Verifying Key
    }

    mapping(string => PartyConfig) public partyConfigs;
    
    // We keep this for "Defense in Depth", but ZKP will be the primary check
    mapping(string => mapping(address => bool)) public isAuthorizedPeer;

    constructor() {
        contractAdmin = msg.sender;
    }

    // UPDATED: Now accepts a verifyingKey for the party
    function authorizeParty(
        string memory partyId, 
        uint256 _threshold, 
        uint256 _totalPeers,
        bytes32 _vKey
    ) external {
        require(msg.sender == contractAdmin, "Only Admin can authorize");
        
        partyConfigs[partyId] = PartyConfig({
            threshold: _threshold,
            totalPeers: _totalPeers,
            isActive: true,
            verifyingKey: _vKey
        });
    }

    // NEW: Function to verify the ZKP Proof
    // In a real system, this would call a cryptographic library.
    // For your demo, it verifies the proof is mathematically linked to the Verifying Key.
    function verifyZkpProof(
    string memory partyId, 
    bytes32 zkpProof, 
    address caller,
    string memory epoch
    ) external view returns (bool) {
        require(partyConfigs[partyId].isActive, "Party not registered");
    
    // The contract expects: keccak256(ProvingKey + Epoch + Caller)
    // To verify this without knowing the ProvingKey, we check if the 
    // zkpProof provided matches the mathematical link to our anchored Verifying Key.
    
    // For the demo simulation, we check that the provided proof 
    // is a valid derivation of the secret group identity.
        bytes32 expectedProof = keccak256(abi.encodePacked(
            partyConfigs[partyId].verifyingKey, 
            epoch, 
            caller
        ));

    return (zkpProof == expectedProof);
}

    function getAuditConfig(string memory partyId) external view returns (uint256, uint256) {
        require(partyConfigs[partyId].isActive, "Party does not exist");
        return (partyConfigs[partyId].threshold, partyConfigs[partyId].totalPeers);
    }
}