// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AuditAccessManager {
    address public contractAdmin;

    // Struct to store configuration for each specific company/party
    struct PartyConfig {
        uint256 threshold;    // T: Required votes for THIS party
        uint256 totalPeers;   // m: Total authorized peers for THIS party
        bool isActive;        // Check if party exists
    }

    // Mappings to isolate data by Party_ID
    mapping(string => PartyConfig) public partyConfigs;
    
    // Nested mapping: partyId => peerAddress => isAuthorized
    mapping(string => mapping(address => bool)) public isAuthorizedPeer;

    constructor() {
        contractAdmin = msg.sender;
    }

    // Authorize a peer for a SPECIFIC Party_ID
    function authorizePeer(string memory partyId, address peer, uint256 _threshold) external {
        // In a real scenario, you'd check if msg.sender is the admin OR the specific DataOwner for that party
        require(msg.sender == contractAdmin, "Only Admin can authorize");

        // Initialize or update the party configuration
        if (!partyConfigs[partyId].isActive) {
            partyConfigs[partyId].isActive = true;
        }
        
        // Only increment peer count if it's a new peer for this specific party
        if (!isAuthorizedPeer[partyId][peer]) {
            isAuthorizedPeer[partyId][peer] = true;
            partyConfigs[partyId].totalPeers++;
        }

        // Set/Update the security threshold for this party
        partyConfigs[partyId].threshold = _threshold;
    }

    // Function for the Registry contract to verify if a peer belongs to a specific party
    function verifyPeer(string memory partyId, address peer) external view returns (bool) {
        return isAuthorizedPeer[partyId][peer];
    }

    // Function to get config for a specific party
    function getAuditConfig(string memory partyId) external view returns (uint256, uint256) {
        require(partyConfigs[partyId].isActive, "Party does not exist");
        return (partyConfigs[partyId].threshold, partyConfigs[partyId].totalPeers);
    }
}