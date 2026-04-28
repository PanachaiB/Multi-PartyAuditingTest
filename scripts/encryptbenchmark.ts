import * as crypto from 'crypto';

async function testEncryptionOverhead() {
    console.log("\n--- Phase 1: Baseline Encryption Evaluation ---");

    const sizes = [1024, 10240, 102400]; 
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    for (const size of sizes) {
        const data = crypto.randomBytes(size);

        const startEnc = performance.now();
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const tag = cipher.getAuthTag();
        const endEnc = performance.now();

        const startDec = performance.now();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        const endDec = performance.now();

        console.log(`Data Size: ${size / 1024} KB`);
        console.log(`- Encryption Latency: ${(endEnc - startEnc).toFixed(4)} ms`);
        console.log(`- Decryption Latency: ${(endDec - startDec).toFixed(4)} ms`);
    }
}

testEncryptionOverhead();