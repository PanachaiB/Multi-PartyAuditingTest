require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};

task("audit", "Submits a ZKP-authorized vote")
  .addParam("party", "The party name")
  .addParam("signer", "Account index (acts as the anonymous carrier)")
  .addParam("epoch", "The epoch string")
  .addOptionalParam("success", "Verdict", "true")
  .setAction(async (taskArgs, hre) => {
    const { party, signer, epoch, success } = taskArgs;
    const isSuccess = success === "true";

    try {
      const accounts = await hre.ethers.getSigners();
      const auditor = accounts[parseInt(signer)];

      // 1. Load Configurations and Deployment Data
      const phase1 = JSON.parse(fs.readFileSync("./phase1_output.json", "utf8"));
      const partyConfig = phase1[party];

      const deployData = require("./ignition/deployments/chain-31337/deployed_addresses.json");
      const registry = await hre.ethers.getContractAt(
        "AuditEvidenceRegistry",
        deployData["AuditModule#AuditEvidenceRegistry"]
      );

      const phase2 = JSON.parse(fs.readFileSync("./phase2_output.json", "utf8"));
      const h_chal = hre.ethers.solidityPackedKeccak256(["string", "string"], [party, epoch]);

      // 2. IDENTITY AUTHORIZATION & ZKP GENERATION
      let zkpProof;
      const authorizedPeers = partyConfig.authorizedPeers;

      // Check if the current signer is in the authorized list for this party
      if (!authorizedPeers.includes(auditor.address)) {
        console.log(`\n⚠️  SECURITY ALERT: Signer ${auditor.address} is NOT authorized for ${party}.`);
        console.log(`🕵️  Simulating unauthorized attempt (Generating Invalid Proof)...`);
        
        // Use a dummy hash that won't match the contract's expected ZKP
        zkpProof = hre.ethers.id("unauthorized_access_attempt");
      } else {
        console.log(`\n🕵️  Authorized Auditor detected. Generating Anonymous ZKP Proof...`);
        
        // Formatting the Verifying Key to ensure it's treated as Bytes32
        const vKey = partyConfig.zkpVerifyingKey.startsWith("0x")
          ? partyConfig.zkpVerifyingKey
          : "0x" + partyConfig.zkpVerifyingKey;

        // Generate proof: keccak256(VerifyingKey + Epoch + AuditorAddress)
        zkpProof = hre.ethers.solidityPackedKeccak256(
          ["bytes32", "string", "address"],
          [vKey, epoch, auditor.address]
        );
      }

      // 3. PREPARE ROOT TO SUBMIT
      const rootToSubmit = isSuccess 
        ? phase2[party].globalRoot 
        : hre.ethers.id("simulated_integrity_failure");

      console.log(`📜 Proof Hash: ${zkpProof}`);
      console.log(`📊 Verdict: ${isSuccess ? "PASS" : "FAIL"}`);

      // 4. SUBMIT TO SMART CONTRACT
      const tx = await registry.connect(auditor).submitVote(
        party,
        h_chal,
        rootToSubmit,
        isSuccess,
        zkpProof,
        epoch
      );

      console.log(`⏳ Transaction sent... ${tx.hash}`);
      await tx.wait();
      
      console.log("✅ Audit Recorded successfully!");

    } catch (error) {
      const message = error.message || "";
      // Extract the short revert reason if available
      const match = message.match(/'([^']+)'/);
      console.log(`\n--------------------------------------------------`);
      console.log(`❌ TRANSACTION REVERTED`);
      console.log(`📝 Reason: ${match ? match[1] : message}`);
      console.log(`--------------------------------------------------\n`);
    }
  });