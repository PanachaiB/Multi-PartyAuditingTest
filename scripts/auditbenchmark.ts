import { CryptoCore } from "../dist/lib/CryptoCore.js";
import hre from "hardhat";
const { ethers } = hre as any;
import * as secp from "@noble/secp256k1";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from "fs";
import * as path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const signers = await ethers.getSigners();

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

async function testConsensusScaling() {
    console.log("\n--- Phase 3: Multi-Party Consensus Evaluation ---");

    const auditorPoolSizes = [3, 5, 10, 15, 20];
    const thresholdPercentage = 0.6;

    for (const m of auditorPoolSizes) {
        const T = Math.ceil(m * thresholdPercentage);

        const registryAddress = await getDeployedAddress("AuditEvidenceRegistry");
        const registry = await (hre as any).ethers.getContractAt("AuditEvidenceRegistry", registryAddress);

        let totalGasforConsensus = 0n;
        const mockRoot = ethers.ZeroHash;
        
        const sessionId = ethers.encodeBytes32String(`audit-session-${m}-${Date.now()}`);

        console.log(`\nAuditors (m): ${m} | Threshold (T): ${T}`);
        console.log(`Submitting votes to trigger Blockchain Evidence for Session: ${m}...`);

        for (let i = 0; i < T; i++) {
            try {
                const tx = await registry.connect(signers[i]).submitVote(sessionId, mockRoot, true, T);
                const receipt = await tx.wait();
        
                totalGasforConsensus += receipt.gasUsed;
        
                console.log(`Vote ${i + 1}/${T} accepted from ${signers[i].address}`);
        
                if (i === T - 1) {
                    console.log("✨ Threshold reached! AuditFinalized event emitted.");
                }
            } catch (error: any) {
                console.log(`Transaction failed for auditor ${i}: ${error.reason || error.message}`);
            }
        }

        const auditors = Array.from({ length: m }, () => {
            const priv = secp.utils.randomSecretKey();
            return { priv, pub: secp.schnorr.getPublicKey(priv) };
        });

        const challenge = "audit-block-verify-sequence-001";
        
        const proofs = await Promise.all(
            auditors.slice(0, T).map(a => CryptoCore.generateZKP(challenge, a.priv))
        );

        const startVerify = performance.now();
        await Promise.all(
            proofs.map((p, i) => CryptoCore.verifyZKP(p.full, challenge, auditors[i].pub))
        );
        const endVerify = performance.now();

        // 3. LOGGING RESULTS
        const totalLatency = (endVerify - startVerify);

        console.log(`- Batch Verification Latency: ${totalLatency.toFixed(4)} ms`);
        console.log(`- Total Consensus Gas: ${totalGasforConsensus.toString()} units`);
        console.log(`- Average Gas per Auditor: ${(totalGasforConsensus / BigInt(m)).toString()}`);
    }
}

testConsensusScaling();