import { and, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { createStaffAction, setUserStatusAction } from "@/actions/gestao";
import { changePasswordAction } from "@/actions/people";
import { TotpEnrol } from "@/components/console/totp-enrol";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, PageHead, SectionTitle } from "@/components/ui";
import { relativeTime } from "@/lib/dates";
import { ROLE_LABELS, can } from "@/server/auth/permissions";
import { requirePage } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

export const metadata: Metadata = { title: "Equipa" };

const ROLES = ["kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst", "admin", "auditor"] as const;

export default async function TeamPage() {
  const user = await requirePage(["admin", "auditor", "kyc_reviewer", "credit_analyst", "credit_approver", "risk_analyst"]);
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.kind, "staff"), ne(users.email, "sistema@ukuphila.demo")));
  const manage = can(user.role, "team.manage");
  const me = rows.find((row) => row.id === user.id);
  return (
    <>
      <PageHead eyebrow="Governação" title="Equipa" lead="Funções separadas por desenho: quem gere o programa não aprova KYC nem crédito." />
      <div className="grid-2">
        <section className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Função</th>
                  <th>Autenticação forte</th>
                  <th>Estado</th>
                  {manage ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.displayName}
                      <div className="tiny muted">{row.email}</div>
                    </td>
                    <td>{ROLE_LABELS[row.role]}</td>
                    <td>{row.totpEnabledAt ? <Badge tone="good">Activa desde {relativeTime(row.totpEnabledAt)}</Badge> : <Badge tone="warn">Por activar</Badge>}</td>
                    <td>
                      <Badge tone={row.status === "activo" ? "good" : "bad"}>{row.status}</Badge>
                    </td>
                    {manage ? (
                      <td>
                        {row.id !== user.id ? (
                          <form action={setUserStatusAction.bind(null, row.id, row.status === "activo" ? "suspenso" : "activo")}>
                            <button className="btn btn-ghost btn-s" type="submit">
                              {row.status === "activo" ? "Suspender" : "Reactivar"}
                            </button>
                          </form>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="stack">
          <section className="card">
            <SectionTitle title="Autenticação forte" />
            {me?.totpEnabledAt ? <p className="small muted">Já activa nesta conta.</p> : <TotpEnrol />}
          </section>
          <section className="card">
            <SectionTitle title="A minha palavra-passe" />
            <ActionForm action={changePasswordAction}>
              <div className="field">
                <label htmlFor="current">Palavra-passe actual</label>
                <input id="current" className="input" type="password" name="current" autoComplete="current-password" required />
              </div>
              <div className="field">
                <label htmlFor="next">Nova palavra-passe</label>
                <input id="next" className="input" type="password" name="next" autoComplete="new-password" minLength={12} required />
              </div>
              <div className="field">
                <label htmlFor="confirm">Repete a nova</label>
                <input id="confirm" className="input" type="password" name="confirm" autoComplete="new-password" minLength={12} required />
              </div>
              <SubmitButton>Mudar palavra-passe</SubmitButton>
            </ActionForm>
          </section>
          {manage ? (
            <section className="card">
              <SectionTitle title="Nova conta" />
              <ActionForm action={createStaffAction}>
                <div className="field">
                  <label htmlFor="name">Nome</label>
                  <input id="name" className="input" name="name" required />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" className="input" type="email" name="email" required />
                </div>
                <div className="field">
                  <label htmlFor="role">Função</label>
                  <select id="role" className="select" name="role">
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton>Criar conta</SubmitButton>
              </ActionForm>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
