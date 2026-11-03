import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { BarList } from "@/components/charts";
import { WhatsappSimulator } from "@/components/console/whatsapp-sim";
import { Badge, PageHead, SectionTitle, Stat } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { formatPct, pct } from "@/lib/money";
import { aiIntentStats, listAiTurns } from "@/server/admin/queries";
import { hasClaude } from "@/server/ai/claude";
import { programmeKpis } from "@/server/analytics/programme";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { isDemo } from "@/server/env";

export const metadata: Metadata = { title: "IA e WhatsApp" };

const GUARDRAIL = {
  proposta_sem_execucao: "Propôs, não executou",
  dados_do_sistema_transaccional: "Número vindo do ledger",
  so_conhecimento_aprovado: "Só conhecimento aprovado",
  escalado_para_humano: "Passou para uma pessoa",
  confirmacao_explicita: "Confirmado pela pessoa",
} as Record<string, string>;

export default async function AiPage() {
  const user = await requirePage("ops.read");
  const db = await getDb();
  const [turns, intents, kpis, people] = await Promise.all([listAiTurns(db), aiIntentStats(db), programmeKpis(db), db.select({ phone: users.phone, name: users.displayName }).from(users).where(eq(users.role, "merchant")).limit(30)]);
  const showSimulator = isDemo() && (can(user.role, "ops.manage") || user.role === "auditor");
  return (
    <>
      <PageHead eyebrow="Operação" title="IA e WhatsApp" lead="A IA interpreta e assiste. A verdade sobre saldos, KYC e contratos fica nos sistemas de origem, e cada decisão relevante fica aqui registada." actions={<Badge tone={hasClaude() ? "good" : "neutral"}>{hasClaude() ? "Claude ligado" : "Intérprete de regras"}</Badge>} />
      <div className="stat-grid">
        <Stat icon="chat" label="Conversas (30 dias)" value={kpis.aiTurns} />
        <Stat icon="hand" label="Passaram para uma pessoa" value={formatPct(pct(kpis.aiEscalated, kpis.aiTurns), 1)} hint={`${kpis.aiEscalated} casos`} />
        <Stat icon="alert" label="Não percebidas" value={formatPct(pct(kpis.aiUnknown, kpis.aiTurns), 1)} />
      </div>
      <div className="grid-even block">
        <section className="card">
          <SectionTitle title="Simulador de WhatsApp" />
          {showSimulator ? <WhatsappSimulator people={people.filter((person): person is { phone: string; name: string } => Boolean(person.phone))} /> : <p className="small muted">Disponível para a gestão no modo de demonstração.</p>}
        </section>
        <div className="stack">
          <section className="card">
            <SectionTitle title="O que as pessoas pedem" />
            <BarList formatValue={(value) => String(value)} rows={intents.map((row) => ({ label: row.intent, value: row.total }))} />
          </section>
          <section className="card card-flush">
            <div style={{ padding: "18px 20px 6px" }}>
              <SectionTitle title="Últimas conversas" />
            </div>
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
              <table className="table">
                <tbody>
                  {turns.map(({ turn, name }) => (
                    <tr key={turn.id}>
                      <td>
                        <strong className="small">{turn.input}</strong>
                        <div className="small muted">{turn.response}</div>
                        <div className="row wrap" style={{ ["--gap" as string]: "5px", marginTop: 4 }}>
                          <Badge>{turn.intent}</Badge>
                          {(turn.guardrails ?? []).map((guardrail) => (
                            <Badge key={guardrail} tone="good">
                              {GUARDRAIL[guardrail] ?? guardrail}
                            </Badge>
                          ))}
                        </div>
                        <div className="tiny muted" style={{ marginTop: 3 }}>
                          {name} · {turn.channel} · {relativeTime(turn.createdAt)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
