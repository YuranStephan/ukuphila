<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ukuphila — regras partilhadas de Claude e Codex

Antes de alterar código, lê este ficheiro, **docs/STATUS.md** (estado vivo e passagem de responsabilidade) e, se fores o Codex, a tua tarefa em **docs/CODEX_TASKS.md**. A fonte de produto é **docs/source/knowledge-base.md** (documento mestre). O draft antigo está em `legacy/` só como referência: não o uses nem o importes.

## Produto

O Ukuphila é um produto real, não uma demonstração: acompanhante de negócio para comerciantes informais de Maputo, com o caminho **Caixa → Poupança → Xitique → Crédito**, agente humano no mercado, telefone em leasing, voz, WhatsApp e funcionamento offline. Interfaces: site público, app do comerciante (PWA offline em `/app`), agente (`/agente`), gestão (`/gestao`), sala de risco (`/risco`), fornecedor (`/fornecedor`) e passaporte público (`/h/[código]`).

- Interface em português de Moçambique, com "tu", ortografia do documento mestre (actividade, projecto, transacção). Código e comentários em inglês.
- **Nada na interface diz "demonstração", "simulado", "sintético" ou "exemplo".** Valores comerciais (limites, prazos, custos, comissões) são definidos pela gestão nas Definições e por política aprovada a quatro olhos. Nunca inventes números de mercado; os que existem estão em `src/lib/market-facts.ts` com fonte.
- O Ukuphila regista o negócio; não guarda dinheiro. Diz isso onde importa.
- A IA interpreta e propõe. Saldos, KYC e contratos vêm sempre do sistema; dinheiro só se mexe depois de confirmação.

## Base de dados (partilhada com outro projecto)

- O PostgreSQL do Supabase é **partilhado com o projecto Kuvona**. Tudo do Ukuphila vive no schema **`ukuphila`**, incluindo o registo de migrações (`ukuphila.__migrations`). **Nunca** cries, alteres, leias ou apagues nada fora deste schema.
- Tabelas em Drizzle: `ukuphila.table(...)` em `src/server/db/schema.ts`. **SQL em bruto tem de qualificar o schema** (`from ukuphila.journal_entries`). Prefere o query builder; dentro de `sql\`\`` podes interpolar tabelas Drizzle (`${journalEntries}`).
- Migrações: `npm run db:generate` depois de mudar o schema; o integrity SQL está em `drizzle/0001_integrity.sql`. Nunca corras `db:reset` nem seeds de teste contra a base alojada.
- Dinheiro em centavos inteiros. `journal_entries`, `postings`, `audit_events`, `access_log` e outras são só de acrescentar (trigger na base). Correcções são estornos.

## Engenharia

- Next.js 16.4, React 19, TypeScript strict, Drizzle, PGlite local, Supabase em produção, Vercel (`arn1`).
- Regras de negócio em `src/server/**` (recebem `db` explicitamente). Mutações do staff em `src/actions/**` (Server Actions); escritas do comerciante passam pela fila de sincronização (`src/server/sync`, `/api/app/sync`).
- **Cada página e cada acção volta a verificar sessão e permissão no servidor** (`requirePage`, `requireApi`, `can` em `src/server/auth/permissions.ts`). Esconder botões não é segurança.
- Segregação de funções: quem submete um documento não o aprova; quem recomenda crédito não o aprova; contribuição do Xitique declarada por uma pessoa e confirmada por outra.
- Acesso de staff ou agente aos dados de um comerciante regista-se em `access_log` (`logAccess`, `logAgentView`).
- UI: componentes em `src/components/` (`ui.tsx`, `charts.tsx`, `forms.tsx`, `icon.tsx`, `brand.tsx`, `console/shell.tsx`); estilos em `src/styles/` (classes `card`, `stat-grid`, `table`, `badge`, `btn`…). Mobile primeiro: sem scroll horizontal, alvos ≥ 44 px, tabelas dentro de `.table-wrap`.

## Executar e verificar

- Porta **3200** (3000 e 3100 são de outros projectos). `npm run dev` usa PGlite local em `.data/pglite`; `npm run dev:remote` usa o `DATABASE_URL` de `.env.local`.
- Nunca abras a mesma `.data/pglite` em dois processos. Os testes usam bases em memória.
- Antes de terminar: `npx tsc --noEmit --incremental false`, `npm test` e, quando aplicável, `npm run build`. Dinheiro, acesso, KYC, crédito e sincronização precisam de testes.
- Capturas: `MSYS_NO_PATHCONV=1 node scripts/shot.mjs <rota> [--mobile]` com o servidor ligado.

## Colaboração Claude ↔ Codex

- Cada tarefa tem ficheiros exclusivos (ver docs/CODEX_TASKS.md). Não edites ficheiros de outra tarefa nem ficheiros existentes fora da tua lista. Se precisares de mudar um, escreve o pedido no teu ficheiro em `docs/codex/`.
- Não arranques servidores, não corras scripts de base de dados, não toques em `.env*`, não faças commits nem push: o Claude integra e faz commit.
- Não afirmes que alguém reviu código sem essa revisão ter acontecido. Regista verificações reais e limites em docs/STATUS.md (Claude) ou no teu ficheiro em docs/codex/ (Codex).
