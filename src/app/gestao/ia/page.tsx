import type { Metadata } from "next";
import { BarList } from "@/components/charts";
import { Badge, PageHead, SectionTitle, Stat } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { formatPct, pct } from "@/lib/money";
import { aiIntentStats, listAiTurns } from "@/server/admin/queries";
import { hasClaude } from "@/server/ai/claude";
import { programmeKpis } from "@/server/analytics/programme";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "IA e WhatsApp" };

const GUARDRAIL = {
  proposta_sem_execucao: "Propôs, não executou",
  dados_do_sistema_transaccional: "Número vindo do ledger",
  so_conhecimento_aprovado: "Só conhecimento aprovado",
  escalado_para_humano: "Passou para uma pessoa",
  confirmacao_explicita: "Confirmado pela pessoa",
} as Record<string, string>;

export default async function AiPage() {
  await requirePage("ops.read");
  const db = await getDb();
  const [turns, intents, kpis] = await Promise.all([listAiTurns(db), aiIntentStats(db), programmeKpis(db)]);
  const channel = [
    { label: "Número do WhatsApp Business", configured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID) },
    { label: "Autorização de envio", configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN) },
    { label: "Assinatura das mensagens", configured: Boolean(process.env.WHATSAPP_APP_SECRET) },
    { label: "Verificação do canal", configured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN) },
  ];
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
          <SectionTitle title="Canal WhatsApp" action={<Badge tone={channel.every((item) => item.configured) ? "good" : "warn"}>{channel.every((item) => item.configured) ? "Configurado" : "Ligar canal"}</Badge>} />
          <p className="small muted">As mensagens recebidas usam o mesmo assistente da aplicação. Consulta abaixo o estado da ligação.</p>
          <dl className="kv block">{channel.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.configured ? "Configurado" : "Por configurar"}</dd></div>)}</dl>
          <p className="small block">A ligação recebe mensagens em <code>/api/whatsapp</code>.</p>
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
