import { CryptoCore } from "../lib/CryptoCore.js";
import * as secp from "@noble/secp256k1";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import hre from "hardhat";
const { ethers } = hre as any;
import * as fs from "fs";
import * as path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getDeployedAddress(contractName: string) {
    // This will now work correctly
    const filePath = path.join(__dirname, "../ignition/deployments/chain-31337/deployed_addresses.json");
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`Deployment file not found at ${filePath}. Did you run ignition deploy?`);
    }

    const addresses = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const key = Object.keys(addresses).find(k => k.includes(contractName));
    return key ? addresses[key] : null;
}

async function runBenchmarks() {
    console.log("--- Research Paper Performance Evaluation ---");
    
    // Setup: Generate a valid 32-byte private key for the "Auditor"
    const privKey = secp.utils.randomSecretKey();
    const pubKey = secp.schnorr.getPublicKey(privKey);
    
    // Phase 2 Mock Data: Graph Node with 3 Structural Links
    const nodeId = "node-001";
    const mockCiphertext = "encrypted_data_block_xyz".repeat(50); // ~1KB block
    const mockAdjacency = ["node-002", "node-005", "node-009"];

    // 1. Measure Phase 2: Graph-Aware Tag (HVT) Generation
    const startTag = performance.now();
    const hvt = CryptoCore.generateGraphTag(nodeId, mockCiphertext, mockAdjacency);
    const endTag = performance.now();
    console.log(`[Phase 2] HVT Generation (Local): ${(endTag - startTag).toFixed(4)} ms`);

    // 2. Measure Phase 3: ZKP (Schnorr) Generation
    // This is the "Proving Time" for your paper
    const challenge = "audit-session-challenge-2026";
    const startZKP = performance.now();
    const proof = await CryptoCore.generateZKP(challenge, privKey);
    const endZKP = performance.now();
    console.log(`[Phase 3] ZKP Proving Time (Auditor): ${(endZKP - startZKP).toFixed(4)} ms`);

    const startVerify = performance.now();
    const isValid = await CryptoCore.verifyZKP(proof.full, challenge, pubKey);
    const endVerify = performance.now();

    const registryAddress = await getDeployedAddress("AuditEvidenceRegistry");
    const registry = await (hre as any).ethers.getContractAt("AuditEvidenceRegistry", registryAddress);

    const mockRoot = ethers.ZeroHash; 
    const mockChallenge = ethers.encodeBytes32String("auth-test");
    const tx = await registry.submitVote(mockChallenge, mockRoot, true); 
    const receipt = await tx.wait();

    console.log(`[Phase 5] Auth Verification Time (Verifier): ${(endVerify - startVerify).toFixed(4)} ms`);
    console.log(`Verification Successful: ${isValid}`);
    
    console.log("-------------------------------------------");
    console.log(`- On-Chain Verification Gas: ${receipt.gasUsed.toString()} units`);
    console.log(`Proof Size: 64 bytes (R: 32B, s: 32B)`);
    console.log(`HVT Size: 32 bytes`);
}

runBenchmarks();