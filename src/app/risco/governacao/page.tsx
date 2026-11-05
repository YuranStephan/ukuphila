import type { Metadata } from "next";
import { BarList, TableView } from "@/components/charts";
import { Badge, DataNote, EmptyState, PageHead, SectionTitle } from "@/components/ui";
import { formatPct } from "@/lib/money";
import { fairnessView } from "@/server/admin/queries";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Governação dos sinais" };

export default async function GovernancePage() {
  await requirePage("risk.read", "/risco/governacao");
  const db = await getDb();
  const [groups, policy] = await Promise.all([fairnessView(db), getSetting(db, "trustPolicy")]);
  return <>
    <PageHead eyebrow="Explicação e responsabilidade" title="Governação dos sinais" lead="Os anéis descrevem evidência do negócio. Estar pronto para revisão permite uma análise humana; não garante crédito." />
    <div className="callout"><strong>Uma diferença não é prova de enviesamento.</strong><p>Compara os tamanhos dos grupos, a qualidade dos registos e o contexto antes de tirar conclusões. Estes números incluem apenas comerciantes com uma avaliação guardada e usam a avaliação mais recente de cada pessoa.</p></div>
    <div className="grid-even block">{["Mercado", "Actividade"].map((dimension) => {
      const rows = groups.filter((row) => row.dimension === dimension);
      return <section className="card" key={dimension}><SectionTitle title={`Pronto para revisão · ${dimension.toLowerCase()}`} />
        {rows.length ? <><BarList rows={rows.map((row) => ({ label: row.group, value: row.rate, hint: `${row.ready} de ${row.total} avaliados` }))} max={1} formatValue={(value) => formatPct(value, 1)} /><TableView head={[dimension, "Avaliados", "Prontos para revisão", "Taxa"]} rows={rows.map((row) => [row.group, row.total, row.ready, formatPct(row.rate, 1)])} /></> : <EmptyState icon="users" title="Ainda sem avaliações guardadas">As taxas aparecem quando houver avaliações de comerciantes neste grupo.</EmptyState>}
      </section>;
    })}</div>
    <div className="grid-2 block"><section className="card"><SectionTitle title="O que não entra nos sinais" /><ul className="stack">{["Idade", "Sexo", "Religião", "Língua", "Frequência de uso da aplicação"].map((label) => <li key={label}>{label}</li>)}</ul><DataNote>A regularidade dos registos de negócio é diferente da frequência com que alguém abre a aplicação. A IA interpreta e propõe; não decide crédito.</DataNote></section>
      <section className="card"><SectionTitle title="Regras dos anéis" action={<Badge tone={policy.isExample ? "warn" : "info"}>{policy.isExample ? "Por validar" : "Configuradas"}</Badge>} /><dl className="kv"><div><dt>Versão em avaliação</dt><dd className="mono">{policy.isExample ? "Sem versão aprovada" : policy.version}</dd></div><div><dt>Sequência</dt><dd>Caixa → Poupança → Xitique → Crédito</dd></div><div><dt>Decisão de crédito</dt><dd>Análise e aprovação por pessoas diferentes</dd></div></dl><p className="small muted block">{policy.isExample ? "A gestão precisa de validar as regras antes de as adoptar como política do programa." : "A versão acompanha cada avaliação guardada para permitir a revisão das decisões."}</p></section>
    </div>
  </>;
}
