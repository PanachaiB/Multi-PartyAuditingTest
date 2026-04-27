import { CryptoCore } from "../lib/CryptoCore.js";
import hre from "hardhat";
const { ethers } = hre as any;
import * as secp from "@noble/secp256k1";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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

async function testConsensusScaling() {


    console.log("\n--- Phase 3: Multi-Party Consensus Evaluation ---");


    const auditorPoolSizes = [3, 5, 10, 15, 20]; // Total auditors (m)
    const thresholdPercentage = 0.6; // 60% threshold (T)

    for (const m of auditorPoolSizes) {
        const T = Math.ceil(m * thresholdPercentage);
            
        const registryAddress = await getDeployedAddress("AuditEvidenceRegistry");
        const registry = await (hre as any).ethers.getContractAt("AuditEvidenceRegistry", registryAddress);

        let totalGasforConsensus = 0n;
        const mockRoot = ethers.ZeroHash;
        const mockChallenge = ethers.encodeBytes32String(`audit-${m}`);

        for (let i = 0; i < T; i++) {
            const tx = await registry.submitVote(mockChallenge, mockRoot, true);
            const receipt = await tx.wait();
            totalGasforConsensus += receipt.gasUsed;
        }
        // Setup auditors
        const auditors = Array.from({ length: m }, () => {
            const priv = secp.utils.randomSecretKey();
            return { priv, pub: secp.schnorr.getPublicKey(priv) };
        });

        const challenge = "audit-block-verify-sequence-001";

        // A. Measure Parallel Proving Time (Simulation of auditors working)
        // In a real network, this happens in parallel, so we take the "Max" 
        // or just one instance plus overhead.
        const startProving = performance.now();
        const proofs = await Promise.all(
            auditors.slice(0, T).map(a => CryptoCore.generateZKP(challenge, a.priv))
        );
        const endProving = performance.now();

        // B. Measure Batch Verification Time (Consensus Overhead)
        // This is how long the Blockchain/Lead Peer takes to verify T proofs.
        const startVerify = performance.now();
        const results = await Promise.all(
            proofs.map((p, i) => CryptoCore.verifyZKP(p.full, challenge, auditors[i].pub))
        );
        const endVerify = performance.now();

        const totalLatency = (endVerify - startVerify);

        console.log(`Auditors (m): ${m} | Threshold (T): ${T}`);
        console.log(`- Batch Verification Latency: ${totalLatency.toFixed(4)} ms`);
        console.log(`- Average per-auditor overhead: ${(totalLatency / T).toFixed(4)} ms`);
        console.log(`- Total Consensus Gas: ${totalGasforConsensus.toString()} units`);
        console.log(`- Average Gas per Auditor: ${(totalGasforConsensus / BigInt(m)).toString()}`);
    }
}

testConsensusScaling();