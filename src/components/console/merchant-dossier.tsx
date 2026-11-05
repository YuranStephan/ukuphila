import { Rings } from "@/components/brand";
import { Badge, SectionTitle } from "@/components/ui";
import { formatDateTime, formatDay, relativeTime } from "@/lib/dates";
import { CONSENT_PURPOSES, CONTRACT_LABELS, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, ENTRY_LABELS, KYC_LEVEL_LABELS, POCKET_LABELS } from "@/lib/labels";
import { formatMT } from "@/lib/money";
import type { merchantDossier } from "@/server/admin/queries";
import { READINESS_LABELS } from "@/server/trust/engine";

type Dossier = NonNullable<Awaited<ReturnType<typeof merchantDossier>>>;

export function TrustPanel({ trust }: { trust: Dossier["trust"] }) {
  return (
    <section className="card">
      <SectionTitle title="Sinais de confiança"  />
      <div className="row" style={{ ["--gap" as string]: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <Rings ring={trust.ring} size={118} />
        <div className="grow" style={{ minWidth: 200 }}>
          <p className="small muted">Anel {trust.ring} de 4</p>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem" }}>{READINESS_LABELS[trust.readiness]}</p>
          <ul className="signal-list" style={{ marginTop: 10 }}>
            {trust.signals.map((signal) => (
              <li key={signal.key} className="signal" data-state={signal.state}>
                <i />
                <div>
                  <strong>{signal.label}</strong>
                  <span>{signal.evidence}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>
        Evidência para apoiar uma pessoa, não uma decisão automática. Idade, sexo, religião e uso da aplicação não entram aqui. Versão: {trust.policyVersion}.
      </p>
    </section>
  );
}

export function DossierBody({ dossier }: { dossier: Dossier }) {
  const pockets = ["negocio", "casa", "poupanca", "xitique"] as const;
  return (
    <>
      <div className="stat-grid">
        {pockets.map((pocket) => (
          <div key={pocket} className="stat">
            <span className="stat-label">{POCKET_LABELS[pocket]}</span>
            <span className="stat-value num">{formatMT(dossier.balance(pocket))}</span>
          </div>
        ))}
      </div>
      <div className="grid-2 block">
        <TrustPanel trust={dossier.trust} />
        <section className="card">
          <SectionTitle title="Identidade" />
          <dl className="kv">
            <div>
              <dt>Verificação</dt>
              <dd>{KYC_LEVEL_LABELS[dossier.kyc?.level ?? 0]}</dd>
            </div>
            <div>
              <dt>Mercado</dt>
              <dd>{dossier.market.name}</dd>
            </div>
            <div>
              <dt>Banca</dt>
              <dd>{dossier.business.stall ?? "—"}</dd>
            </div>
            <div>
              <dt>Actividade</dt>
              <dd>{dossier.business.activity}</dd>
            </div>
            <div>
              <dt>Agente</dt>
              <dd>{dossier.agent?.name ?? "—"}</dd>
            </div>
            <div>
              <dt>Desde</dt>
              <dd>{formatDay(dossier.user.createdAt)}</dd>
            </div>
          </dl>
          <h3 className="card-title" style={{ margin: "16px 0 8px" }}>
            Documentos
          </h3>
          {dossier.documents.length === 0 ? <p className="small muted">Sem documentos.</p> : null}
          {dossier.documents.map((document) => (
            <div key={document.id} className="row-between small" style={{ padding: "5px 0" }}>
              <span>
                {DOCUMENT_TYPES[document.type] ?? document.type} {document.numberMasked ? <span className="mono muted">{document.numberMasked}</span> : null}
              </span>
              <Badge tone={document.status === "aprovado" ? "good" : document.status === "rejeitado" ? "bad" : "warn"}>{DOCUMENT_STATUS_LABELS[document.status]}</Badge>
            </div>
          ))}
          <h3 className="card-title" style={{ margin: "16px 0 8px" }}>
            Consentimentos
          </h3>
          <div className="row wrap" style={{ ["--gap" as string]: "6px" }}>
            {dossier.consents.map((consent) => (
              <Badge key={consent.id} tone={consent.status === "concedido" ? "good" : "neutral"}>
                {CONSENT_PURPOSES[consent.purpose]?.label ?? consent.purpose}
              </Badge>
            ))}
          </div>
        </section>
      </div>
      <div className="grid-even block">
        <section className="card card-flush">
          <div style={{ padding: "18px 20px 6px" }}>
            <SectionTitle title="Últimos movimentos" />
          </div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {dossier.recent.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {ENTRY_LABELS[entry.kind]}
                      {entry.needsReview ? (
                        <>
                          {" "}
                          <Badge tone="warn">Por rever</Badge>
                        </>
                      ) : null}
                      <div className="tiny muted">
                        {formatDateTime(entry.occurredAt)} · {entry.channel}
                      </div>
                    </td>
                    <td className="right num">{formatMT(entry.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <SectionTitle title="Crédito fornecedor" />
          {dossier.contracts.length === 0 ? <p className="small muted">Sem contratos.</p> : null}
          {dossier.contracts.map(({ contract, supplierName }) => (
            <div key={contract.id} className="row-between small" style={{ padding: "6px 0" }}>
              <span>
                <span className="mono">{contract.code}</span> · {supplierName}
                <span className="muted"> · {formatMT(contract.principalCents)}</span>
              </span>
              <Badge tone={contract.status === "liquidado" ? "good" : contract.status === "activo" ? "info" : "bad"}>{CONTRACT_LABELS[contract.status]}</Badge>
            </div>
          ))}
          <h3 className="card-title" style={{ margin: "16px 0 8px" }}>
            Quem viu estes dados
          </h3>
          {dossier.viewers.length === 0 ? <p className="small muted">Sem acessos registados.</p> : null}
          {dossier.viewers.map(({ log, name }) => (
            <div key={log.id} className="row-between small" style={{ padding: "4px 0" }}>
              <span>
                {name} <span className="muted">· {log.purpose}</span>
              </span>
              <span className="muted tiny">{relativeTime(log.at)}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
