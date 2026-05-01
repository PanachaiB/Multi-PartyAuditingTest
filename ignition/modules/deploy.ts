import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuditModule = buildModule("AuditModule", (m) => {
  
  const accessManager = m.contract("AuditAccessManager", []);

  const evidenceRegistry = m.contract("AuditEvidenceRegistry", [accessManager]);

  return { accessManager, evidenceRegistry };
});

export default AuditModule;