import { SparseMerkleTreeKV } from "@kevincharm/sparse-merkle-tree";
import { keccak256, ethers } from "ethers";

export class AuditSMT {
    private tree: SparseMerkleTreeKV;

    constructor() {
        this.tree = new SparseMerkleTreeKV();
    }

    // Phase 2: Create a commitment for a piece of cloud data
    // In your paper, the key is the Data ID and value is the Data Hash
    public addData(dataId: string, dataContent: string) {
        const key = keccak256(ethers.toUtf8Bytes(dataId));
        const value = keccak256(ethers.toUtf8Bytes(dataContent));
        
        return this.tree.insert(key, value);
    }

    public getRoot() {
        return this.tree.root;
    }

    public generateProof(dataId: string) {
        const key = keccak256(ethers.toUtf8Bytes(dataId));
        const proof = this.tree.get(key);

        return proof;
    }
}