import type { Role } from "../db/schema";

/*
 * Least privilege and segregation of duties (KB §21, §29). `admin` runs the programme but cannot approve its own
 * KYC, credit or risk decisions: those belong to separate roles, and `auditor` reads everything and changes nothing.
 */
const CAPABILITIES = {
  "merchant.read": ["agent", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst", "admin", "auditor"],
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
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability) {
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  merchant: "Comerciante",
  agent: "Agente",
  supplier: "Fornecedor",
  kyc_reviewer: "Revisão KYC",
  credit_analyst: "Análise de crédito",
  credit_approver: "Aprovação de crédito",
  risk_analyst: "Risco",
  admin: "Gestão",
  auditor: "Auditoria",
};

/** Where each role lands after signing in. */
export function homeFor(role: Role) {
  switch (role) {
    case "merchant":
      return "/app";
    case "agent":
      return "/agente";
    case "supplier":
      return "/fornecedor";
    case "risk_analyst":
      return "/risco";
    default:
      return "/gestao";
  }
}

export const STRONG_AUTH_ROLES: Role[] = ["kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst", "admin", "auditor"];
