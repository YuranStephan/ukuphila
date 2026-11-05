import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { riskOverview } from "@/server/analytics/programme";
import type { SessionUser } from "@/server/auth/session";
import type { Db } from "@/server/db/client";
import { riskAlerts, riskCases } from "@/server/db/schema";
import { addCaseNote, closeAlert, closeCase, openCase } from "@/server/risk/cases";
import { caseDetail } from "@/server/risk/queries";
import { makeStaff, testDb } from "./helpers";

let db: Db;
let close: () => Promise<void>;
let manager: SessionUser;
beforeAll(async () => {
  ({ db, close } = await testDb());
  manager = await makeStaff(db, "risk_analyst");
});
afterAll(() => close());

async function alert() {
  const [row] = await db.insert(riskAlerts).values({ rule: "credito_teste", severity: "alta", title: "Situação a confirmar", detail: "Verificar com o comerciante.", dedupeKey: randomUUID() }).returning();
  return row;
}

describe("investigações de risco", () => {
  it("soma alertas abertos e em revisão de cada gravidade, ignorando os fechados", async () => {
    await db.insert(riskAlerts).values([
      { rule: "teste", severity: "critica", title: "Um", detail: "Teste", dedupeKey: randomUUID(), status: "aberto" },
      { rule: "teste", severity: "critica", title: "Dois", detail: "Teste", dedupeKey: randomUUID(), status: "em_revisao" },
      { rule: "teste", severity: "critica", title: "Três", detail: "Teste", dedupeKey: randomUUID(), status: "fechado" },
    ]);
    expect((await riskOverview(db)).critical).toBe(2);
  });

  it("abrir duas vezes o mesmo alerta mantém um único caso", async () => {
    const row = await alert();
    const id = await openCase(db, manager, row.id);
    expect(await openCase(db, manager, row.id)).toBe(id);
    const [stored] = await db.select().from(riskAlerts).where(eq(riskAlerts.id, row.id));
    expect(stored).toMatchObject({ status: "em_revisao", caseId: id });
  });

  it("guarda notas e fecha o caso com os alertas, preservando a primeira conclusão", async () => {
    const row = await alert();
    const id = await openCase(db, manager, row.id);
    await addCaseNote(db, manager, id, "Agente contactado; documentação conferida.");
    await expect(closeAlert(db, manager, row.id, "Tentar fechar isoladamente")).rejects.toThrow(/pertence a um caso/);
    await closeCase(db, manager, id, "Registos conferidos e situação esclarecida.");
    await closeCase(db, manager, id, "Submissão repetida com outra conclusão.");
    const data = await caseDetail(db, id);
    expect(data?.item).toMatchObject({ status: "fechado", conclusion: "Registos conferidos e situação esclarecida." });
    expect(data?.notes).toHaveLength(1);
    expect(data?.alerts[0]).toMatchObject({ status: "fechado", closedBy: manager.id });
    await expect(addCaseNote(db, manager, id, "Nota depois do fecho")).rejects.toThrow(/não está aberto/);
  });

  it("fechar um alerta é repetível e um alerta fechado não abre investigação", async () => {
    const row = await alert();
    await closeAlert(db, manager, row.id, "Erro de digitação confirmado.");
    await closeAlert(db, manager, row.id, "Outra submissão");
    await expect(openCase(db, manager, row.id)).rejects.toThrow(/já foi fechado/);
    const [stored] = await db.select().from(riskAlerts).where(eq(riskAlerts.id, row.id));
    expect(stored.closureNote).toBe("Erro de digitação confirmado.");
  });

  it("auditoria e gestão não alteram investigações, mesmo chamando o serviço directamente", async () => {
    const row = await alert();
    const id = await openCase(db, manager, row.id);
    for (const role of ["auditor", "admin"] as const) {
      const user = await makeStaff(db, role);
      await expect(openCase(db, user, row.id)).rejects.toThrow(/permissão/);
      await expect(closeAlert(db, user, row.id, "Conclusão não autorizada")).rejects.toThrow(/permissão/);
      await expect(addCaseNote(db, user, id, "Nota não autorizada")).rejects.toThrow(/permissão/);
      await expect(closeCase(db, user, id, "Conclusão não autorizada")).rejects.toThrow(/permissão/);
    }
    expect((await caseDetail(db, id))?.item.status).toBe("em_investigacao");
  });

  it("valida identificadores, motivos e casos inexistentes", async () => {
    expect(await caseDetail(db, "invalido")).toBeNull();
    await expect(closeCase(db, manager, randomUUID(), "Uma conclusão válida")).rejects.toThrow(/não encontrado/);
    const row = await alert();
    await expect(closeAlert(db, manager, row.id, " ")).rejects.toThrow(/Explica/);
    const cases = await db.select().from(riskCases).where(eq(riskCases.id, randomUUID()));
    expect(cases).toHaveLength(0);
  });
});
