import * as crypto from 'crypto';
import * as secp from "@noble/secp256k1";
import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
const { ethers } = hre as any;

async function getDeployedAddress(contractName: string): Promise<string> {
    const filePath = path.resolve(process.cwd(), "ignition", "deployments", "chain-31337", "deployed_addresses.json");

    if (!fs.existsSync(filePath)) {
        throw new Error(`Deployment file not found. Run: npx hardhat ignition deploy ./ignition/modules/AuditModule.ts --network localhost`);
    }
    const addresses = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const key = Object.keys(addresses).find(k => k.includes(contractName));
    if (!key) throw new Error(`Contract ${contractName} not found in deployment logs.`);
    return addresses[key];
}

async function initializePKG() {
    try {
        console.log(`--- Phase 1: Multi-Party PKG Initialization ---`);
        
        const accessManagerAddress = await getDeployedAddress("AuditAccessManager");
        const accessManager = await ethers.getContractAt("AuditAccessManager", accessManagerAddress);
        const signers = await ethers.getSigners();

        // Define your multiple parties and their specific requirements
        const parties = [
            { id: "SIIT", threshold: 3, peerCount: 5 },
            { id: "Chula", threshold: 2, peerCount: 3 }
        ];

        let multiPartyConfig: any = {};

        for (const party of parties) {
            console.log(`\n> Setting up ${party.id} (T=${party.threshold}, M=${party.peerCount})...`);

            // 1. Generate unique keys for THIS party
            const aeadKey = crypto.randomBytes(32);
            const gmsk = secp.utils.randomSecretKey();
            const gpk = secp.getPublicKey(gmsk);

            console.log(`\n>AEAD for ${party.id} is ${aeadKey.toString('hex')}`);
            console.log(`Group Master Secret Key for ${party.id} is ${Buffer.from(gmsk).toString('hex')}`);
            console.log(`Group Public Key (GPK) for ${party.id} is ${Buffer.from(gpk).toString('hex')}`);

            // 2. Authorize peers on-chain for THIS specific partyId
            // We use different signers from Hardhat to simulate different people
            const startIndex = parties.indexOf(party) * 5 + 1; 
            const partyPeers = signers.slice(startIndex, startIndex + party.peerCount);

            for (const peer of partyPeers) {
                // Calling the NEW contract function: authorizePeer(partyId, address, threshold)
                const tx = await accessManager.authorizePeer(party.id, peer.address, party.threshold);
                await tx.wait();
                console.log(`   [OK] Authorized ${peer.address} for ${party.id}`);
            }

            // 3. Store config for this party
            multiPartyConfig[party.id] = {
                partyId: party.id,
                epoch: 1, // Start at Epoch 1
                threshold: party.threshold.toString(),
                aeadKey: aeadKey.toString('hex'),
                gmsk: Buffer.from(gmsk).toString('hex'),
                gpk: Buffer.from(gpk).toString('hex'),
                authorizedPeers: partyPeers.map((p: any) => p.address)
            };
        }

        // --- Export everything to a single JSON ---
        const outputPath = path.resolve(process.cwd(), "pkg_params_multi.json");
        fs.writeFileSync(outputPath, JSON.stringify(multiPartyConfig, null, 4));
        
        console.log(`\n--- [SUCCESS] ---`);
        console.log(`Multi-party parameters exported to: ${outputPath}`);

    } catch (error) {
        console.error("Setup Failed:", error);
    }
}

initializePKG();