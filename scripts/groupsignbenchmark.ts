import * as secp from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

secp.hashes.sha256 = sha256;
secp.hashes.hmacSha256 = (key, ...args) => hmac(sha256, key, ...args);

async function runGroupSigDemo() {
    console.log("--- Group Signature Amortization Demo ---");
    
    const batchSize = 100;
    const iterations = 10;
    
    // Generate dummy data
    const encoder = new TextEncoder();
    const nodeHashes = Array.from({ length: batchSize }, (_, i) => 
    sha256(encoder.encode(`Node_Data_${i}`))
);
    const privKey = secp.utils.randomSecretKey();
    const pubKey = secp.getPublicKey(privKey);

    console.log(`\nScenario A: Signing ${batchSize} nodes individually...`);
    let totalTimeA = 0;
    for (let i = 0; i < iterations; i++) {
        const startA = performance.now();
        for (const hash of nodeHashes) {
            const sig = await secp.sign(hash, privKey);
            await secp.verify(sig, hash, pubKey);
        }
        totalTimeA += (performance.now() - startA);
    }
    const avgTimeA = totalTimeA / iterations;
    
    
    console.log(`Scenario B: Batching ${batchSize} nodes and signing once...`);
    let totalTimeB = 0;
    for (let i = 0; i < iterations; i++) {
        const startB = performance.now();
        const combined = new Uint8Array(batchSize * 32);
        nodeHashes.forEach((h, i) => combined.set(h, i * 32));
        const batchRoot = sha256(combined);
        const batchSig = await secp.sign(batchRoot, privKey);
        await secp.verify(batchSig, batchRoot, pubKey);
        totalTimeB += (performance.now() - startB);
    }
    const avgtimeB = totalTimeB / iterations;

    console.log("\n--- RESULTS ---");
    console.log(`Average Individual Signing Total: ${avgTimeA.toFixed(4)} ms`);
    console.log(`Average Batch/Group Signing Total: ${avgtimeB.toFixed(4)} ms`);
    console.log(`Performance Gain: ${((avgTimeA / avgtimeB)).toFixed(1)}x faster`);
}

runGroupSigDemo();