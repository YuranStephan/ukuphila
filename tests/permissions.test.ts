import { describe, expect, it } from "vitest";
import { can, type Capability } from "@/server/auth/permissions";
import type { Role } from "@/server/db/schema";

const roles: Role[] = ["merchant", "agent", "supplier", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst", "admin", "auditor"];
const readStaff: Role[] = ["agent", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst", "admin", "auditor"];
const matrix: Record<Capability, Role[]> = {
  "merchant.read": readStaff,
  "merchant.assist": ["agent"],
  "ledger.read": ["credit_analyst", "credit_approver", "risk_analyst", "auditor"],
  "kyc.review": ["kyc_reviewer"],
  "document.view": ["kyc_reviewer", "auditor"],
  "credit.analyse": ["credit_analyst"],
  "credit.approve": ["credit_approver"],
  "credit.policy.propose": ["credit_analyst", "risk_analyst"],
  "credit.policy.approve": ["credit_approver"],
  "credit.read": ["credit_analyst", "credit_approver", "risk_analyst", "admin", "auditor"],
  "credit.repayment.record": ["agent", "credit_analyst"],
  "risk.manage": ["risk_analyst"],
  "risk.read": ["risk_analyst", "credit_approver", "admin", "auditor"],
  "ops.manage": ["admin"],
  "ops.read": ["admin", "auditor", "risk_analyst"],
  "settings.manage": ["admin"],
  "team.manage": ["admin"],
  "kb.approve": ["admin"],
  "audit.read": ["admin", "auditor", "risk_analyst"],
  "supplier.portal": ["supplier"],
};
const capabilities = Object.keys(matrix) as Capability[];

describe("capability segregation", () => {
  it.each(capabilities)("grants %s only to the designated roles", (capability) => {
    for (const role of roles) expect(can(role, capability), `${role}: ${capability}`).toBe(matrix[capability].includes(role));
  });

  it("does not grant KYC or credit approval to management", () => {
    for (const capability of ["kyc.review", "credit.analyse", "credit.approve", "credit.policy.approve"] as const) {
      expect(can("admin", capability)).toBe(false);
    }
  });

  it("lets an auditor read while denying every mutation capability", () => {
    const reads: Capability[] = ["merchant.read", "ledger.read", "document.view", "credit.read", "risk.read", "ops.read", "audit.read"];
    for (const capability of capabilities) expect(can("auditor", capability)).toBe(reads.includes(capability));
  });
});
