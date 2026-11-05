import { describe, expect, expectTypeOf, it } from "vitest";
import { evaluateTrust, type TrustFacts } from "@/server/trust/engine";
import { readyFacts, trustFacts, trustPolicy } from "./fixtures";

describe("explainable trust", () => {
  it.each([
    [1, trustFacts({ activeDays30: 1 })],
    [2, trustFacts({ activeDays14: 2, activeDays30: 2 })],
    [3, trustFacts({ activeDays14: 2, activeDays30: 3, kycLevel: 1 })],
    [4, readyFacts()],
  ] as const)("reaches ring %i from financial evidence", (ring, facts) => {
    const result = evaluateTrust(facts, trustPolicy);
    expect(result.ring).toBe(ring);
    expect(result.policyVersion).toBe(trustPolicy.version);
    expect(result.rings[ring - 1].done).toBe(true);
    expect(result.signals.every((signal) => signal.evidence.length > 0)).toBe(true);
    if (ring === 4) expect(result.readiness).toBe("pronto_para_revisao");
    else expect(result.rings[ring].missing.length).toBeGreaterThan(0);
  });

  it("explains the first record and does not invent evidence", () => {
    const result = evaluateTrust(trustFacts(), trustPolicy);
    expect(result.ring).toBe(1);
    expect(result.rings[0]).toMatchObject({ done: false, missing: ["Regista a tua primeira venda."] });
    expect(result.signals.find((signal) => signal.key === "xitique")?.state).toBe("sem_dados");
  });

  it("requires earlier rings even when later thresholds are met", () => {
    const result = evaluateTrust({ ...readyFacts(), activeDays14: 1 }, trustPolicy);
    expect(result.rings[3].done).toBe(true);
    expect(result.ring).toBe(1);
  });

  it("blocks ring four on an overdue instalment and explains why", () => {
    const result = evaluateTrust({ ...readyFacts(), creditOverdue: 1 }, trustPolicy);
    expect(result.ring).toBe(3);
    expect(result.rings[3].done).toBe(false);
    expect(result.blockers).toEqual(["Tens prestações em atraso. Fala com o teu agente."]);
    expect(result.rings[3].missing).toContain(result.blockers[0]);
    expect(result.signals.find((signal) => signal.key === "credito")?.state).toBe("fraco");
  });

  it("enforces Xitique punctuality at the policy boundary without requiring participation", () => {
    expect(evaluateTrust({ ...readyFacts(), xitiqueDue: 10, xitiqueOnTime: 8 }, trustPolicy).ring).toBe(4);
    const result = evaluateTrust({ ...readyFacts(), xitiqueDue: 10, xitiqueOnTime: 7 }, trustPolicy);
    expect(result.ring).toBe(3);
    expect(result.rings[3].missing).toContain("Põe as contribuições do Xitique em dia.");
    expect(evaluateTrust(readyFacts(), trustPolicy).ring).toBe(4);
  });

  it("has no protected or app-usage attributes in its input contract", () => {
    expectTypeOf<TrustFacts>().not.toHaveProperty("age");
    expectTypeOf<TrustFacts>().not.toHaveProperty("sex");
    expectTypeOf<TrustFacts>().not.toHaveProperty("religion");
    expectTypeOf<TrustFacts>().not.toHaveProperty("language");
    expectTypeOf<TrustFacts>().not.toHaveProperty("appOpenCount");
    const facts = readyFacts();
    const withUntrustedAttributes = { ...facts, age: 90, sex: "female", religion: "private", language: "pt-MZ", appOpenCount: 99_999 };
    expect(evaluateTrust(withUntrustedAttributes, trustPolicy)).toEqual(evaluateTrust(facts, trustPolicy));
  });
});
