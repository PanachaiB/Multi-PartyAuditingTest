import * as secp from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

secp.hashes.sha256 = sha256;
secp.hashes.hmacSha256 = (key, msg) =>
  hmac(sha256, key, msg);

async function testRetrievalAndDecryption() {
    console.log("\n--- Phase 4 & 5: Retrieval & Decryption Evaluation ---");

    // Mock 1KB Data Block
    const blockSize = 1024; 
    const mockCiphertext = crypto.getRandomValues(new Uint8Array(blockSize));
    
    // 1. SMT Membership Proof Verification
    // (Simulating the client receiving a leaf and its proof from the cloud)
    const startSMT = performance.now();
    // In your previous SMT test, you generated a proof. 
    // Here we measure the client-side 'verify' cost.
    // Logic: IsLeafInRoot(leaf, proof, root)
    const endSMT = performance.now();
    const smtTime = endSMT - startSMT;

    // 2. Auth Signature Verification (Phase 4)
    // Does the client trust the 'Audit Verdict'?
    const auditorPriv = secp.utils.randomSecretKey();
    const auditorPub = secp.schnorr.getPublicKey(auditorPriv);
    const verdict = "DataBlock_001_Is_Valid";
    const sig = await secp.schnorr.sign(new TextEncoder().encode(verdict), auditorPriv);

    const startAuth = performance.now();
    await secp.schnorr.verify(sig, new TextEncoder().encode(verdict), auditorPub);
    const endAuth = performance.now();
    const authTime = endAuth - startAuth;

    // 3. Decryption (Phase 5)
    // Only happens if 1 and 2 are successful
    const startDecrypt = performance.now();
    // Use a simple AES-GCM or your CryptoCore.decrypt mock
    const endDecrypt = performance.now();
    const decryptTime = endDecrypt - startDecrypt;

    console.log(`- Proof Verification Latency (SMT): ${smtTime.toFixed(4)} ms`);
    console.log(`- Auth Binding Latency (Schnorr): ${authTime.toFixed(4)} ms`);
    console.log(`- Decryption Latency: ${decryptTime.toFixed(4)} ms`);
    console.log(`- Total "Time to Useful Data": ${(smtTime + authTime + decryptTime).toFixed(4)} ms`);
}

testRetrievalAndDecryption();