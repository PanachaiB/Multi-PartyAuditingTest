import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";
const { ethers } = hre as any;

// Helper to get address from deployment logs
async function getDeployedAddress(contractName: string): Promise<string> {
    const filePath = path.resolve(process.cwd(), "ignition", "deployments", "chain-31337", "deployed_addresses.json");
    if (!fs.existsSync(filePath)) {
        throw new Error(`Deployment file not found. Run: npx hardhat ignition deploy ...`);
    }
    const addresses = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const key = Object.keys(addresses).find(k => k.includes(contractName));
    if (!key) throw new Error(`Contract ${contractName} not found.`);
    return addresses[key];
}

async function main() {
    try {
        const partyId = "SIIT";
        const epoch = "4"; // Must match the epoch used in Phase 3
        
        const registryAddress = await getDeployedAddress("AuditEvidenceRegistry");
        const registry = await ethers.getContractAt("AuditEvidenceRegistry", registryAddress);

        // Generate the same challenge hash used in Phase 3
        const h_chal = ethers.solidityPackedKeccak256(["string", "string"], [partyId, epoch]);
        
        // Fetch the session state from the blockchain
        const session = await registry.audits(h_chal);

        console.log(`--- Phase 4: Consensus-Based Retrieval for ${partyId} ---`);
        console.log(`🔍 Checking Blockchain State for Challenge: ${h_chal}`);
        
        // Logic: Only allow retrieval if auditors reached the threshold (T)
        if (session.finalized && session.isSuccess) {
            console.log("✅ CONSENSUS VERIFIED: Audit passed and finalized.");
            
            const cloudPath = `./cloud_storage/${partyId}`;
            if (fs.existsSync(cloudPath)) {
                console.log(`📂 Fetching encrypted shards from ${cloudPath}...`);
                const shards = fs.readdirSync(cloudPath);
                
                // Simulate saving the retrieved "downloaded" shards for Phase 5
                const retrievalData = {
                    partyId,
                    epoch,
                    retrievedAt: new Date().toISOString(),
                    shards: shards
                };
                
                fs.writeFileSync(`./retrieved_${partyId}.json`, JSON.stringify(retrievalData, null, 4));
                console.log(`✨ Successfully retrieved ${shards.length} shards.`);
            } else {
                console.log("⚠️  Error: Cloud storage folder not found. Run Phase 2 first!");
            }
        } else {
            console.log("❌ ACCESS DENIED: The required audit threshold has not been met.");
            console.log(`   Status - Finalized: ${session.finalized}, Success: ${session.isSuccess}`);
        }
    } catch (error) {
        console.error("Retrieval Failed:", error);
    }
}

main();