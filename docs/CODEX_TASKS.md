# Tarefas para o Codex (em paralelo com o Claude)

Criado pelo Claude em 2026-11-03 a pedido do proprietário, para acelerar o MVP. Lê primeiro **AGENTS.md** e **docs/STATUS.md**.

## Regras desta ronda

- Cada tarefa tem ficheiros **exclusivos**. Só crias ou editas os ficheiros da tua lista. Tudo o resto é só leitura.
- O Claude está a trabalhar ao mesmo tempo em: `src/app/app/**`, `src/components/merchant/**`, `src/lib/offline/**`, `src/app/api/app/**`, `public/**`, `src/server/**` existente, `src/actions/**` existente, `src/styles/**`, `src/app/gestao/**`, `src/app/(site)/**`, docs e configuração.
- Precisas de uma função de servidor nova? Cria-a no ficheiro novo da tua tarefa indicado abaixo. Precisas de mudar um ficheiro de outro? Escreve o pedido em `docs/codex/<TAREFA>.md` na secção "Pedidos ao Claude".
- Estilos: usa as classes existentes (`src/styles/base.css`, `src/styles/console.css`). Se precisares de CSS novo, cria só o ficheiro CSS indicado na tua tarefa; o Claude importa-o no layout raiz.
- Não arranques `next dev`, não corras scripts de base de dados, não toques em `.env*`, não faças commit.
- Verificação: `npx tsc --noEmit --incremental false` sem erros **nos teus ficheiros** (erros noutros ficheiros podem ser trabalho em curso do Claude: ignora-os e menciona-os no relatório). Para CX3, também `npx vitest run tests/<os teus ficheiros>`.
- No fim, escreve `docs/codex/<TAREFA>.md` com: o que fizeste, ficheiros, verificações que correste de facto e o seu resultado, limites e pedidos ao Claude.

Padrões a seguir (já existem, copia o estilo):
- Página de consola: `src/app/gestao/kyc/page.tsx`, `src/app/gestao/credito/[id]/page.tsx`, `src/app/gestao/operacoes/page.tsx`.
- Server Actions com `ActionForm` + `run()`: `src/actions/agent.ts`, `src/actions/risk.ts`, `src/actions/credit.ts`; componente `src/components/forms.tsx`.
- Gráficos: `src/components/charts.tsx` (`ColumnChart`, `BarList`, `StackedLine`, `Funnel`, `TableView`, `Legend`). Cores: `var(--serie-1..4)`; texto nunca na cor da série.
- Cada página chama `requirePage(...)` no topo, mesmo que o layout já o faça.

---

## CX1 · App do agente (`/agente`)

Telemóvel primeiro, com `FieldShell` de `src/components/console/shell.tsx` (barra inferior). Funções prontas em `src/server/agent/service.ts` (`agentProfile`, `buildRonda`, `agentPortfolio`, `assertAssigned`, `logAgentView`, `ONBOARDING_STEPS`, `agentIncidents`) e acções em `src/actions/agent.ts` (`onboardAction`, `onboardingStepAction`, `attestAction`, `assistedRecordAction`, `logVisitAction`, `openIncidentAction`, `reportLostAction`, `createLeaseAction`, `agentDocumentAction`) e `src/actions/gestao.ts` (`resolveIncidentAction`, `resolveConflictAction`).

Ficheiros exclusivos (todos novos):
- `src/app/agente/layout.tsx` — `requirePage(["agent"], "/agente")`; `FieldShell` com 4 itens: Ronda (`/agente`, exact), Comerciantes, Novo (`/agente/novo`), Incidentes. Título: nome do agente e mercado.
- `src/app/agente/page.tsx` — **Ronda do dia**: `buildRonda` agrupado por prioridade (classes `ronda-item`, `data-priority`), cada item liga a `/agente/comerciantes/[id]`; topo com 3 `Stat` (na carteira, a visitar hoje, incidentes abertos). Estado vazio bonito.
- `src/app/agente/comerciantes/page.tsx` — carteira (`agentPortfolio`), pesquisa por nome com `?q=`, lista em cartões no telemóvel.
- `src/app/agente/comerciantes/[id]/page.tsx` — ficha do comerciante: `assertAssigned` + `logAgentView`; dados do negócio, KYC (nível e documentos), checklist de onboarding (`ONBOARDING_STEPS`, botões para avançar com `onboardingStepAction`), formulários: atestar (rosto confirmado, banca visitada, conhece a pessoa, actividade confirmada), registo assistido (venda/despesa), visita, abrir incidente, submeter documento (`<input type="file" accept="image/*,application/pdf" capture="environment">`, tipos de `DOCUMENT_TYPES`), código de activação da conta (ver nota abaixo), telefone/leasing (`createLeaseAction`, modelos de `deviceModels`; e `reportLostAction` para o dispositivo activo).
- `src/app/agente/novo/page.tsx` — registo de um comerciante (SOP §36 do documento mestre) com `onboardAction`: telefone, nome, negócio, actividade, banca; consentimentos com texto claro (`CONSENT_PURPOSES` de `src/lib/labels.ts`; `consent_base` obrigatório; opcionais `voz_ia`, `historial_credito`, `estudos`).
- `src/app/agente/incidentes/page.tsx` — `agentIncidents` + resolver com `resolveIncidentAction`.
- `src/app/agente/ganhos/page.tsx` — comissões do agente (`agentEarnings` do schema), por mês, e visitas recentes.
- `src/server/agent/queries.ts` — consultas novas que precisares (ganhos, detalhe do comerciante para o agente, dispositivos do comerciante).

Nota sobre activação: o Claude está a acrescentar `issueActivationCode` em `src/server/auth/activation.ts` e `issueActivationCodeAction(merchantId)` em `src/actions/activation.ts` (assinatura `(merchantId: string, state: ActionState & { code?: string }) => Promise<ActionState & { code?: string }>`). Na ficha, mostra um botão "Gerar código de entrada" que chama essa acção e mostra o código grande, com a explicação "O comerciante entra com o número de telefone e este código, e cria o seu PIN". Se o ficheiro ainda não existir quando chegares lá, escreve o componente na mesma e importa desse caminho.

## CX2 · Sala de risco (`/risco`) e portal do fornecedor (`/fornecedor`)

Sala de risco com superfície nocturna: `ConsoleShell` com `night` (`data-surface="noite"`). Funções: `creditPortfolio`, `repaymentStats`, `riskOverview`, `creditPipeline` (`src/server/analytics/programme.ts`), `listAlerts`, `fairnessView` (`src/server/admin/queries.ts`), `activePolicy` (`src/server/credit/service.ts`). Acções: `src/actions/risk.ts` (`closeAlertAction`, `openCaseAction`, `addCaseNoteAction`, `closeCaseAction`, `runRulesAction`) e `src/actions/credit.ts` (`proposePolicyAction`, `approvePolicyAction`, `confirmDeliveryAction`).

Ficheiros exclusivos (todos novos):
- `src/app/risco/layout.tsx` — `requirePage("risk.read", "/risco")`; navegação: Visão geral, Carteira, Alertas, Casos, Governação, Políticas; link de volta para `/gestao` quando o papel o permitir.
- `src/app/risco/page.tsx` — exposição, PAR 1/7/30 (valor e %), envelhecimento (`ageing`) em `BarList`, concentração por mercado e fornecedor, alertas abertos por gravidade, pagamentos a tempo.
- `src/app/risco/carteira/page.tsx` — contratos (`creditPortfolio().contracts`) com dias de atraso, filtro por estado.
- `src/app/risco/alertas/page.tsx` — alertas abertos e fechados (`?estado=`), fechar com nota, abrir caso, botão "Correr regras".
- `src/app/risco/casos/page.tsx` e `src/app/risco/casos/[id]/page.tsx` — lista e detalhe (notas, fechar com conclusão). Consultas novas em `src/server/risk/queries.ts`.
- `src/app/risco/governacao/page.tsx` — governação dos sinais: `fairnessView` (taxa de "pronto para revisão" por mercado e por actividade, com aviso de que diferença não é prova de enviesamento), lista do que **não** entra nos sinais (idade, sexo, religião, língua, frequência de uso), versão das regras dos anéis.
- `src/app/risco/politicas/page.tsx` — políticas de crédito (tabela `creditPolicies`): em vigor, rascunhos, propor (`proposePolicyAction`) e aprovar (`approvePolicyAction`, quatro olhos), arquivadas.
- `src/app/fornecedor/layout.tsx`, `src/app/fornecedor/page.tsx` (encomendas: contratos do fornecedor por estado; para `aguarda_entrega`, formulário com o código do comerciante → `confirmDeliveryAction`), `src/app/fornecedor/catalogo/page.tsx` (produtos e preços; lista só de leitura nesta ronda), `src/app/fornecedor/liquidacoes/page.tsx` (prestações e pagamentos recebidos dos seus contratos). `requirePage("supplier.portal")`; o fornecedor só vê os contratos onde `suppliers.ownerId = user.id`. Consultas em `src/server/supplier/queries.ts`.

## CX3 · Testes de domínio

Ficheiros exclusivos: `tests/xitique.test.ts`, `tests/credit.test.ts`, `tests/kyc.test.ts`, `tests/trust.test.ts`, `tests/passport.test.ts`, `tests/conversation.test.ts`, `tests/permissions.test.ts`, e `tests/fixtures.ts` se precisares de ajudas novas (podes usar `tests/helpers.ts`, só leitura). Bases em memória (`testDb()`).

Cobrir, no mínimo:
- Xitique: criar, entrar por código, começar com ordem combinada e com sorteio (o sorteio confere com `drawOrder(seed, ids)` e o compromisso `sha256(seed)`), declarar pela sincronização, confirmar só por outra pessoa (e a base recusa a mesma pessoa), recebimento cria `xitique_recebimento`, grupo conclui na última ronda, `markLateContributions`.
- Crédito: sem consentimento recusa; anel < 4 recusa com o motivo; limite por fase; análise e aprovação por pessoas diferentes (mesma pessoa recusada); aceitar exige PIN; entrega só com o código certo e só pelo dono do fornecedor; plano de prestações soma o total; pagamento repetido com a mesma referência não conta duas vezes; liquidação; `markOverdue` e alerta; política: quatro olhos e só uma aprovada.
- KYC: tipo e formato verificados pelos bytes; quem submete não aprova; rejeição sem motivo recusada; níveis 0→1→2→3 pela evidência; ficheiro repetido noutra conta levanta alerta; abrir documento regista `access_log`.
- Confiança: `evaluateTrust` com factos sintéticos para cada anel; não há entrada para atributos protegidos; atraso bloqueia o anel 4.
- Passaporte: só as secções escolhidas; revogado e expirado não mostram dados; assinatura adulterada detectada.
- Conversa: proposta não mexe no saldo até "sim"; "não" cancela; perguntas respondem do ledger; "quero falar com alguém" abre incidente; sem conhecimento aprovado responde que não sabe.
- Permissões: `can()` respeita a segregação (admin não aprova KYC nem crédito; auditor não escreve).

Se um teste revelar um defeito no código de servidor, **não corrijas o ficheiro**: deixa o teste com `it.fails(...)` ou `it.todo` e descreve o defeito em `docs/codex/CX3.md` → "Pedidos ao Claude", com o passo para o reproduzir.
