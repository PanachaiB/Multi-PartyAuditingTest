import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuditModule = buildModule("AuditModule", (m) => {

  const threshold = 7;
  // Deploy the Access Manager
  const accessManager = m.contract("AuditAccessManager", [threshold]);

  // Deploy the Evidence Registry
  const evidenceRegistry = m.contract("AuditEvidenceRegistry", [accessManager]);

  return { accessManager, evidenceRegistry };
});

export default AuditModule;