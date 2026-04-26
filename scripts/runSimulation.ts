import { CryptoCore } from "../lib/CryptoCore.js";
import * as secp from "@noble/secp256k1";

async function runThresholdSimulation() {
    console.log("--- Phase 3 & 5: Threshold Consensus Simulation ---");

    // 1. Configuration
    const m = 10; // Total auditing peers
    const T = 7;  // Required threshold for approval
    const maliciousCount = 5; // Peers that intentionally fail verification
    const offlineCount = 1;   // Peers that don't respond
    
    console.log(`Setup: ${m} total peers | Threshold: ${T} | Malicious: ${maliciousCount} | Offline: ${offlineCount}\n`);

    const challenge = "audit-challenge-id-2026";
    const auditResults: boolean[] = [];

    // 2. Peer Execution Loop
    for (let i = 0; i < m; i++) {
        // Simulate Offline Peers (they skip the process)
        if (i < offlineCount) {
            console.log(`Peer ${i}: [OFFLINE] - No response`);
            continue; 
        }

        const privKey = secp.utils.randomSecretKey();
        const pubKey = secp.schnorr.getPublicKey(privKey);

        // Generate the proof (NIZK)
        const proof = await CryptoCore.generateZKP(challenge, privKey);

        // Simulate Malicious Peers (they send a valid proof, but we simulate verification failure)
        // Or they could send "False" data in a real scenario.
        let isVerified: boolean;
        if (i >= offlineCount && i < (offlineCount + maliciousCount)) {
            isVerified = false; // Intentionally simulate a rejection/failure
            console.log(`Peer ${i}: [REJECTED] - Signature/Data mismatch`);
        } else {
            isVerified = await CryptoCore.verifyZKP(proof.full, challenge, pubKey);
            console.log(`Peer ${i}: [APPROVED] - Proof verified`);
        }

        auditResults.push(isVerified);
    }

    // 3. Consensus Finalization
    const validVotes = auditResults.filter(res => res === true).length;
    const finalVerdict = validVotes >= T;

    console.log("\n--- Audit Finalized ---");
    console.log(`Total Valid Proofs: ${validVotes} / ${T} required`);
    console.log(`Status: ${finalVerdict ? "PASSED (Consensus Reached)" : "FAILED (Insufficient Proofs)"}`);
    
    // Safety check for your paper
    if (finalVerdict && (m - maliciousCount - offlineCount) < T) {
        console.warn("WARNING: Logic error—threshold met despite insufficient honest peers.");
    }
}

runThresholdSimulation();