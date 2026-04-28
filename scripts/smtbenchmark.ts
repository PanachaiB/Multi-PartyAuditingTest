import { MerkleTree } from 'merkletreejs';
import { sha256 } from "@noble/hashes/sha2.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import hre from "hardhat";
const { ethers } = hre as any;
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

async function testSMTScaling() {
    const datasetSizes = [100, 500, 1000, 5000, 10000, 20000, 40000, 60000, 80000, 100000];
    const T = 1;
    console.log("--- SMT Performance Evaluation ---");

    for (const size of datasetSizes) {
        const leaves = Array.from({ length: size }, (_, i) =>
            Buffer.from(sha256(new TextEncoder().encode(`leaf_data_${i}`)
    )
  )
);

        const startBuild = performance.now();
        const tree = new MerkleTree(leaves, sha256, { sortPairs: true });
        const root = tree.getHexRoot();
        const endBuild = performance.now();

        const registryAddress = await getDeployedAddress("AuditEvidenceRegistry");
        const AuditRegistry = await (hre as any).ethers.getContractFactory("AuditEvidenceRegistry");
        const registry = await AuditRegistry.attach(registryAddress);

        const mockChallenge = ethers.encodeBytes32String(`sim-${size}-${Date.now()}`);

        const tx = await registry.submitVote(mockChallenge, root, true, T); 
        const receipt = await tx.wait();

        const testLeaf = leaves[0];
        const startProof = performance.now();
        const proof = tree.getProof(testLeaf);
        const endProof = performance.now();

        console.log(`\nDataset Size: ${size} nodes`);
        console.log(`- Build Time (SMT Root): ${(endBuild - startBuild).toFixed(4)} ms`);
        console.log(`- Proof Generation: ${(endProof - startProof).toFixed(4)} ms`);
        console.log(`- Root Hash: ${root.slice(0, 16)}...`);
        console.log(`- On-Chain Gas Cost: ${receipt.gasUsed.toString()} units`);
    }
}

testSMTScaling();