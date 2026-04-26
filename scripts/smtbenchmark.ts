import { MerkleTree } from 'merkletreejs';
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from '@noble/hashes/utils';

async function testSMTScaling() {
    // Dataset sizes for evaluation: 100 to 10,000 nodes 
    const datasetSizes = [100, 500, 1000, 5000, 10000];
    
    console.log("--- SMT Performance Evaluation ---");

    for (const size of datasetSizes) {
        // Step 1: Generate Mock Leaves (l_i) for the dataset
        // In your paper: l_i = H(NodeID_i || HVT_i) [cite: 1085]
        const leaves = Array.from({ length: size }, (_, i) =>
            Buffer.from(sha256(new TextEncoder().encode(`leaf_data_${i}`)
    )
  )
);

        // Step 2: Measure SMT Construction Time (Preprocessing Latency)
        const startBuild = performance.now();
        const tree = new MerkleTree(leaves, sha256, { sortPairs: true });
        const root = tree.getHexRoot();
        const endBuild = performance.now();

        // Step 3: Measure Membership Proof Generation (Auditing Overhead)
        // This is needed for Phase 3 peer verification [cite: 1012, 1087]
        const testLeaf = leaves[0];
        const startProof = performance.now();
        const proof = tree.getProof(testLeaf);
        const endProof = performance.now();

        console.log(`\nDataset Size: ${size} nodes`);
        console.log(`- Build Time (SMT Root): ${(endBuild - startBuild).toFixed(4)} ms`);
        console.log(`- Proof Generation: ${(endProof - startProof).toFixed(4)} ms`);
        console.log(`- Root Hash: ${root.slice(0, 16)}...`);
    }
}

testSMTScaling();