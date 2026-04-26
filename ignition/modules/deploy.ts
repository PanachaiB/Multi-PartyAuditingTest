import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuditModule = buildModule("AuditModule", (m) => {
  // Deploy the Access Manager
  const accessManager = m.contract("AuditAccessManager");

  // Deploy the Evidence Registry
  const evidenceRegistry = m.contract("AuditEvidenceRegistry");

  return { accessManager, evidenceRegistry };
});

export default AuditModule;