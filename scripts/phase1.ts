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
        console.log(`--- Phase 1: Multi-Party PKG Initialization with ZKP ---`);
        const accessManagerAddress = await getDeployedAddress("AuditAccessManager");
        const accessManager = await ethers.getContractAt("AuditAccessManager", accessManagerAddress);
        const signers = await ethers.getSigners();

        const parties = [
            { id: "SIIT", threshold: 3, peerCount: 5 },
            { id: "Chula", threshold: 2, peerCount: 3 }
        ];

        let multiPartyConfig: any = {};

        for (const party of parties) {
            console.log(`\n> Setting up ${party.id}...`);

            // 1. ZKP Key Generation Simulation
            const masterSecret = crypto.randomBytes(32).toString('hex');
            const provingKey = crypto.createHmac('sha256', masterSecret).update("PROVE").digest('hex');
            const verifyingKey = crypto.createHmac('sha256', masterSecret).update("VERIFY").digest('hex');

            // 2. Existing Group Keys
            const aeadKey = crypto.randomBytes(32);
            const gmsk = secp.utils.randomSecretKey();
            const gpk = secp.getPublicKey(gmsk);

            // 3. Define the peers for this party (Fixes the ReferenceError)
            const startIndex = parties.indexOf(party) * 5 + 1; 
            const partyPeers = signers.slice(startIndex, startIndex + party.peerCount);

            // 4. ANCHOR ON-CHAIN: Call the NEW authorizeParty function
            console.log(`   Anchoring Verifying Key for ${party.id}...`);
            const vKeyBytes32 = `0x${verifyingKey}`;
            
            const tx = await accessManager.authorizeParty(
                party.id, 
                party.threshold, 
                party.peerCount, 
                vKeyBytes32
            );
            await tx.wait();

            // 5. Store config for JSON export
            multiPartyConfig[party.id] = {
                partyId: party.id,
                epoch: 1,
                threshold: party.threshold.toString(),
                aeadKey: aeadKey.toString('hex'),
                gmsk: Buffer.from(gmsk).toString('hex'),
                gpk: Buffer.from(gpk).toString('hex'),
                zkpProvingKey: provingKey,
                zkpVerifyingKey: verifyingKey, 
                authorizedPeers: partyPeers.map((p: any) => p.address)
            };
            
            console.log(`   [OK] ${party.id} setup complete.`);
        }

        const outputPath = path.resolve(process.cwd(), "phase1_output.json");
        fs.writeFileSync(outputPath, JSON.stringify(multiPartyConfig, null, 4));
        console.log(`\n--- [SUCCESS] Phase 1 Config Exported ---`);
    } catch (error) {
        console.error("Setup Failed:", error);
    }
}

initializePKG();