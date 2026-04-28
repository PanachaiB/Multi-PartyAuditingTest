import hre from "hardhat";
const { ethers } = hre as any;
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from "fs";
import * as path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getDeployedAddress(contractName: string) {
    
    const filePath = path.resolve(process.cwd(), "ignition", "deployments", "chain-31337", "deployed_addresses.json");

    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Deployment file not found at ${filePath}. Did you run ignition deploy?`
        );
    }
    const addresses = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const key = Object.keys(addresses).find(k => k.includes(contractName));
    return key ? addresses[key] : null;
}

async function fetchAuditLogs() {
    const registryAddress = await getDeployedAddress("AuditEvidenceRegistry");
    const registry = await (hre as any).ethers.getContractAt("AuditEvidenceRegistry", registryAddress);
    console.log("\n--- Retrieving Audit Evidence Logs from Blockchain ---");

    const allEvents = await registry.queryFilter("*", 0, "latest")
    console.log(`Debug: Total events of any type found: ${allEvents.length}`);
    const filter = registry.filters.AuditFinalized();
    const logs = await registry.queryFilter(filter, 0, "latest");

    if (logs.length === 0) {
        console.log("No audit evidence found. Run an audit first!");
        return;
    }

    console.log(`Found ${logs.length} finalized audit records:\n`);

    logs.forEach((log: any, index: number) => {
        const challengeDigest = log.args[0];
        const result = log.args[1];
        const timestamp = log.args[2]; 

        console.log(`Evidence #${index + 1}:`);
        console.log(`- Session ID: ${challengeDigest}`);
        console.log(`- Verdict:    ${result ? "INTEGRITY VERIFIED" : "TAMPERING DETECTED"}`);
        console.log(`- Timestamp:  ${new Date(Number(timestamp) * 1000).toLocaleString()}`);
        console.log("--------------------------------------------------");
    });
}

fetchAuditLogs().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});