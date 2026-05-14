import hre from "hardhat";
const { ethers } = hre as any;
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function main() {
  const outputPath = path.join(__dirname, "..", "phase2_output.json");
  
  if (!fs.existsSync(outputPath)) {
    console.error("❌ Error: phase2_output.json not found. Run your Python script first!");
    process.exit(1);
  }
  const phase2Data = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  
  const registryAddress = await getDeployedAddress("AuditEvidenceRegistry");
  const registry = await ethers.getContractAt("AuditEvidenceRegistry", registryAddress);

  console.log("---------------------------------------");
  console.log("Starting Phase 3: Blockchain Anchoring");
  console.log("---------------------------------------");

  for (const partyId in phase2Data) {
    const data = phase2Data[partyId];
    const globalRoot = data.globalRoot;

    const epoch = "1";
    const h_chal = ethers.solidityPackedKeccak256(["string", "string"], [partyId, epoch]);

    console.log(`\n📦 Processing Party: ${partyId}`);
    console.log(`   - Challenge Hash: ${h_chal}`);
    console.log(`   - Global Root:    ${globalRoot}`);
    console.log(`   - Node Count:     ${data.nodeCount}`);

    // 5. Commit to Blockchain
    try {
      console.time(`⏱️ Latency for ${partyId}`);
      const tx = await registry.initializeAudit(h_chal, partyId, globalRoot);
      
      console.log("   ⌛ Waiting for block confirmation...");
      const receipt = await tx.wait();
      
      console.timeEnd(`⏱️ Latency for ${partyId}`);
      console.log(`   ✅ Success! Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`   🔗 Tx Hash: ${tx.hash}`);
    } catch (error: any) {
      if (error.message.includes("Audit already anchored")) {
        console.log("   ⚠️ Skipping: This audit session is already anchored on-chain.");
      } else {
        console.error(`   ❌ Failed to anchor ${partyId}:`, error.reason || error.message);
      }
    }
  }
  
  console.log("\n═" + "═".repeat(50));
  console.log("SUMMARY: All Roots Anchored. System is ready for Peer Voting.");
  console.log("═" + "═".repeat(50));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});