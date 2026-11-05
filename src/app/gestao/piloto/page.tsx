import type { Metadata } from "next";
import { updateReadinessAction } from "@/actions/gestao";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DataNote, PageHead, SectionTitle, Stat } from "@/components/ui";
import { formatPct, pct } from "@/lib/money";
import { programmeKpis, repaymentStats } from "@/server/analytics/programme";
import { can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { readinessItems } from "@/server/db/schema";

export const metadata: Metadata = { title: "Piloto e prontidão" };

const STATUS = { por_iniciar: "Por iniciar", em_curso: "Em curso", validado: "Validado", bloqueado: "Bloqueado" };

export default async function PilotPage() {
  const user = await requirePage("ops.read");
  const db = await getDb();
  const [kpis, items, repayments] = await Promise.all([programmeKpis(db), db.select().from(readinessItems).orderBy(readinessItems.position), repaymentStats(db)]);
  const validated = items.filter((item) => item.status === "validado").length;
  const editable = can(user.role, "ops.manage");
  const questions: { question: string; metric: string; value: string }[] = [
    { question: "Os comerciantes registam vendas regularmente?", metric: "Activos na semana sobre activos no mês", value: formatPct(pct(kpis.wau, kpis.mau)) },
    { question: "A separação negócio e casa é compreendida?", metric: "Passaram dinheiro para casa em 30 dias", value: formatPct(pct(kpis.separating, kpis.mau)) },
    { question: "A voz funciona em condições reais?", metric: "Registos feitos por voz", value: String(kpis.channels30.voz) },
    { question: "O WhatsApp é realmente usado?", metric: "Registos feitos no WhatsApp", value: String(kpis.channels30.whatsapp) },
    { question: "O agente reduz abandono?", metric: "Activação com agente", value: formatPct(pct(kpis.activated, kpis.merchants)) },
    { question: "O modo offline é suficiente?", metric: "Operações recusadas", value: formatPct(pct(kpis.syncRejected, kpis.syncTotal), 1) },
    { question: "O Xitique digital resolve problemas reais?", metric: "Contribuições a tempo", value: formatPct(pct(kpis.xitiqueOnTime, kpis.xitiqueDue)) },
    { question: "Existe procura por crédito fornecedor?", metric: "Contratos liquidados", value: String(repayments.settled) },
    { question: "O historial é útil para gestão e risco?", metric: "Prestações pagas a tempo", value: formatPct(pct(repayments.onTime, repayments.due)) },
    { question: "A economia do modelo é sustentável?", metric: "Por medir com receitas reais", value: "—" },
  ];
  return (
    <>
      <PageHead eyebrow="Governação" title="Piloto e prontidão" lead="O objectivo do piloto é aprender, não parecer grande. Um mercado, um número controlado de pessoas e critérios claros para continuar ou parar." />
      <div className="stat-grid">
        <Stat tone="night" icon="flag" label="Critérios validados" value={`${validated} de ${items.length}`} hint="Antes de qualquer operação real" />
        <Stat icon="users" label="Comerciantes" value={kpis.merchants} />
        <Stat icon="activity" label="Registos por activo" value={kpis.mau ? Math.round(kpis.entries30 / kpis.mau) : 0} hint="Últimos 30 dias" />
      </div>
      <div className="grid-even block">
        <section className="card">
          <SectionTitle title="Dez perguntas que o piloto responde" />
          <ol className="stack" style={{ ["--gap" as string]: "10px", margin: 0, paddingLeft: 18 }}>
            {questions.map((row) => (
              <li key={row.question}>
                <div className="row-between">
                  <span className="small">{row.question}</span>
                  <strong className="num small">{row.value}</strong>
                </div>
                <span className="tiny muted">{row.metric}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="card">
          <SectionTitle title="Critério de prontidão" />
          <ul className="checklist">
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <span className="small">{item.title}</span>
                  <div className="tiny muted">
                    {item.area}
                    {item.owner ? ` · ${item.owner}` : ""}
                  </div>
                </div>
                {editable ? (
                  <ActionForm action={updateReadinessAction.bind(null, item.id)} className="inline-form">
                    <input type="hidden" name="owner" value={item.owner ?? ""} />
                    <select className="select" name="status" defaultValue={item.status} aria-label={`Estado: ${item.title}`}>
                      {Object.entries(STATUS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn btn-ghost btn-s">Guardar</SubmitButton>
                  </ActionForm>
                ) : (
                  <span className="small muted">{STATUS[item.status]}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <DataNote>Validado só depois de existir evidência externa ou revisão real. Construir uma função não valida o critério.</DataNote>
    </>
  );
}
