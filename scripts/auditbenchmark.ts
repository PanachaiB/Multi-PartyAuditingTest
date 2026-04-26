import { CryptoCore } from "../lib/CryptoCore.js";
import * as secp from "@noble/secp256k1";

async function testConsensusScaling() {
    console.log("\n--- Phase 3: Multi-Party Consensus Evaluation ---");
    
    const auditorPoolSizes = [3, 5, 10, 15, 20]; // Total auditors (m)
    const thresholdPercentage = 0.6; // 60% threshold (T)

    for (const m of auditorPoolSizes) {
        const T = Math.ceil(m * thresholdPercentage);
        
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
    }
}

testConsensusScaling();