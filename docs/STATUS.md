# Ukuphila — estado vivo (Claude ↔ Codex)

Última actualização: 2026-11-03, Claude.

## O que existe

- **Núcleo financeiro**: ledger de dupla entrada imposto pela base (trigger diferido), tabelas só de acrescentar, cadeia de hashes por comerciante e na auditoria, estornos em vez de edições (`src/server/ledger`, `src/server/audit.ts`).
- **Offline**: operações numeradas, encadeadas e assinadas por uma chave ECDSA do telefone; aplicação idempotente com conflitos guardados para revisão (`src/server/sync`).
- **Domínios**: caixa, stock, fiado, poupança, Xitique (duas pessoas por contribuição, sorteio verificável), KYC progressivo com documentos cifrados (AES-256-GCM), crédito fornecedor (análise e aprovação por pessoas diferentes, aceite com PIN, entrega por código), sinais de confiança explicados (anéis), passaporte do negócio assinado, risco (regras, alertas, casos), agentes, leasing, IA com guardrails (intérprete determinístico + Claude opcional), WhatsApp (webhook + mesmo motor).
- **Interfaces prontas**: site público e apresentação (`/pitch`), entrada (`/entrar`, `/registar`), gestão (`/gestao/**`), passaporte público (`/h/[código]`).
- **Em construção nesta ronda**: app do comerciante `/app` (Claude), agente `/agente` (Codex CX1), risco `/risco` e fornecedor `/fornecedor` (Codex CX2), testes de domínio (Codex CX3).

## Base de dados

Supabase partilhado com o Kuvona. O Ukuphila vive só no schema `ukuphila` (tabelas, funções, triggers e registo de migrações). Ver AGENTS.md.

## Verificações reais

- 2026-11-03: `npm test` 52/52 (ledger, sincronização, intérprete) com o schema isolado.

## Limites conhecidos

- Sem fornecedor de SMS/WhatsApp configurado, os códigos de entrada chegam pelo agente (código de activação) e o comerciante entra com PIN.
- Sem `ANTHROPIC_API_KEY`, a IA usa só o intérprete determinístico e a pesquisa na base de conhecimento.
- Política de crédito, comissões e limites são definidos pela gestão; não há valores comerciais aprovados de origem.
