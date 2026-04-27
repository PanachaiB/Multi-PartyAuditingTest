import * as secp from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bytesToHex, utf8ToBytes, concatBytes, hexToBytes } from "@noble/hashes/utils.js";

secp.hashes.sha256 = sha256;
secp.hashes.hmacSha256 = (key, msg) =>
  hmac(sha256, key, msg);

export class CryptoCore {
    /**
     * Phase 2: Graph-Aware Integrity Binding (HVT Generation)
     */
    static generateGraphTag(nodeId: string, ciphertext: string, adjacencyList: string[]) {
        // Hash ciphertext
        const cipherHash = sha256(utf8ToBytes(ciphertext));
        // Hash graph structure
        const adjHash = sha256(utf8ToBytes(adjacencyList.join(",")));
        // HVT = H(nodeId || cipherHash || adjHash)
        const hvt = sha256(concatBytes(utf8ToBytes(nodeId), cipherHash, adjHash));
        return bytesToHex(hvt);
}

    /**
     * Phase 3: ZKP / Schnorr Authorization (Standardized BIP340)
     * This proves the auditor's identity without revealing the private key.
     */
    static async generateZKP(message: string, privateKey: Uint8Array) {
        // We use the built-in schnorr implementation for high security
        // The message is the "Challenge" from your paper
        const messageBytes = sha256(new TextEncoder().encode(message));
        
        // Generates a 64-byte Schnorr signature (R and s)
        const signature = await secp.schnorr.sign(messageBytes, privateKey);
        
        // Extract R (first 32 bytes) and s (last 32 bytes) for your paper's data table
        const sigHex = bytesToHex(signature);
        return {
            R: sigHex.slice(0, 64),
            s: sigHex.slice(64),
            full: sigHex
        };
    }

    /**
     * Phase 5: Verification (On the Edge or in the Contract)
     */
    static async verifyZKP(signatureHex: string, message: string, publicKeyHex: string | Uint8Array) {
        // BIP340 expects a 32-byte message digest
        const messageBytes = sha256(new TextEncoder().encode(message));
        // Decode Schnorr signature from hex
        const sigBytes = hexToBytes(signatureHex);
        // Accept hex or raw bytes for pubkey
        const pubKeyBytes = typeof publicKeyHex === "string"? hexToBytes(publicKeyHex): publicKeyHex;
        // Verify Schnorr proof
        return await secp.schnorr.verify(sigBytes, messageBytes, pubKeyBytes);
    }
}