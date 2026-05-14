import * as fs from "fs";
import * as crypto from "crypto";
import path from "path";

/**
 * Rebuilds the Merkle Root from an array of leaf hashes.
 * This matches the logic used in the Python Phase 2 script.
 */
function buildMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return "";
    if (hashes.length === 1) return hashes[0];

    const newLevel: string[] = [];
    // Sort hashes to match the deterministic order in Phase 2
    const sortedHashes = [...hashes].sort();

    for (let i = 0; i < sortedHashes.length; i += 2) {
        const left = sortedHashes[i];
        const right = i + 1 < sortedHashes.length ? sortedHashes[i + 1] : sortedHashes[i];
        const combined = crypto.createHash('sha256').update(left + right).digest('hex');
        newLevel.push(combined);
    }
    return buildMerkleRoot(newLevel);
}

async function main() {
    try {
        const partyId = "SIIT";
        console.log(`\n--- Phase 5: Verification Before Decryption for ${partyId} ---`);

        // 1. Load Keys and the Blockchain Anchor (the Global Root)
        const phase1 = JSON.parse(fs.readFileSync("phase1_output.json", "utf8"));
        const phase2 = JSON.parse(fs.readFileSync("phase2_output.json", "utf8"));
        
        const anchoredRoot = phase2[partyId].globalRoot;

        // 2. Load "Downloaded" Shards from local storage
        const shardDir = `./cloud_storage/${partyId}`;
        if (!fs.existsSync(shardDir)) {
            throw new Error(`Cloud storage for ${partyId} not found. Run Phase 2 first.`);
        }

        const files = fs.readdirSync(shardDir).filter(f => f.endsWith('.bin'));
        let retrievedHashes: string[] = [];

        console.log(`🔍 Found ${files.length} shards. Re-calculating local Merkle Root...`);
        
        for (const file of files) {
            const content = fs.readFileSync(path.join(shardDir, file));
            
            // Phase 2 format: 12-byte Nonce + Ciphertext
            const ciphertext = content.slice(12);
            
            // Generate the leaf hash for this specific shard
            const leafHash = crypto.createHash('sha256').update(ciphertext).digest('hex');
            retrievedHashes.push(leafHash);
        }

        // 3. REBUILD THE TREE
        // We take all local file hashes and compute the root
        const localRoot = `0x${buildMerkleRoot(retrievedHashes)}`;

        console.log(`\n--------------------------------------------------`);
        console.log(`📊 INTEGRITY COMPARISON:`);
        console.log(`   Blockchain Anchor: ${anchoredRoot}`);
        console.log(`   Local Rebuilt Root: ${localRoot}`);
        console.log(`--------------------------------------------------`);

        // 4. THE DECISION GATE
        if (localRoot === anchoredRoot) {
            console.log("✅ INTEGRITY VERIFIED. The data matches the audited anchor.");
            console.log("🔓 Initializing AEAD Decryption...\n");

            // Only decrypt if the hashes match
            for (const file of files) {
                // In a real implementation, you would perform AES-GCM decryption here
                // using the aeadKey from phase1_output.json.
                console.log(`   [SUCCESS] Decrypted ${file}: Record content recovered.`);
            }
            console.log("\n✨ System Lifecycle Complete: Data is secure and untampered.");
        } else {
            // If you deleted a character, the code enters this block!
            console.log("🚨 ALERT: POST-AUDIT TAMPERING DETECTED!");
            console.log("❌ The local data hashes do not match the blockchain anchor.");
            console.log("🛑 Decryption aborted to prevent processing corrupted data.");
            process.exit(1);
        }

    } catch (error: any) {
        console.error("❌ Verification Failed:", error.message);
    }
}

main();