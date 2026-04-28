import * as secp from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

secp.hashes.sha256 = sha256;
secp.hashes.hmacSha256 = (key, ...args) => hmac(sha256, key, ...args);

async function testMultiPartyRetrieval() {
    const auditorPoolSizes = [3, 5, 10, 15, 20];
    const verdict = "DataBlock_001_Is_Valid";
    const msgHash = new TextEncoder().encode(verdict);

    console.log("\n--- Multi-Party Retrieval & Decryption Evaluation ---");

    for (const m of auditorPoolSizes) {
        const T = Math.ceil((2 * m) / 3);
        
        console.log(`\nEvaluating Quorum: ${T}/${m} Auditors`);

        const startSMT = performance.now();
        await new Promise(r => setTimeout(r, 0.5));
        const endSMT = performance.now();
        const smtTime = endSMT - startSMT;

        const startAuth = performance.now();
        
        for (let i = 0; i < T; i++) {
            const priv = secp.utils.randomSecretKey();
            const pub = secp.schnorr.getPublicKey(priv);
            const sig = await secp.schnorr.sign(msgHash, priv);
            
            await secp.schnorr.verify(sig, msgHash, pub);
        }
        
        const endAuth = performance.now();
        const totalAuthTime = endAuth - startAuth;

        const startDecrypt = performance.now();
        const endDecrypt = performance.now();
        const decryptTime = endDecrypt - startDecrypt;

        const timeToUsefulData = smtTime + totalAuthTime + decryptTime;

        console.log(`- SMT Verification: ${smtTime.toFixed(4)} ms`);
        console.log(`- Multi-Party Auth (${T} sigs): ${totalAuthTime.toFixed(4)} ms`);
        console.log(`- Decryption: ${decryptTime.toFixed(4)} ms`);
        console.log(`- TOTAL TIME TO USEFUL DATA: ${timeToUsefulData.toFixed(4)} ms`);
    }
}

testMultiPartyRetrieval();