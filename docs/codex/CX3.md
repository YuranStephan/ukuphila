# CX3 — Testes de domínio

Data: 2026-11-03. Autor: Codex. Âmbito: apenas CX3.

## O que fiz

Criei sete suites de domínio e fixtures partilhadas. As bases são abertas exclusivamente por `testDb()` de `tests/helpers.ts`, que chama `openPglite()` sem directório: PGlite em memória, com as migrações e restrições reais. Cada suite com base de dados fecha a sua instância em `afterAll`.

Não alterei `src/`, `tests/helpers.ts`, configuração, migrações, `.env*` ou `docs/STATUS.md`. Não arranquei servidores, não executei scripts de base de dados nem fiz commit ou push. As alterações concorrentes dos outros intervenientes foram deixadas intactas.

## Ficheiros e cobertura

| Ficheiro novo | Cobertura |
| --- | --- |
| `tests/xitique.test.ts` | Criação, entrada por código sem duplicação, ordem combinada e calendário, sorteio verificável e compromisso SHA-256, declaração pela fila ECDSA e repetição, segregação na confirmação, restrição de duas pessoas na base, recebimento idempotente no ledger, conclusão na última ronda e atrasos/notificações. As operações bloqueadas estão marcadas abaixo. |
| `tests/credit.test.ts` | Consentimento ausente/revogado, anel insuficiente com o motivo real, limites por fase e respectivos limiares, análise/aprovação por pessoas diferentes, PIN, entrega por código e dono do fornecedor, stock/dívida/custo, soma e arredondamento das prestações, pagamentos parciais/repetidos, liquidação, valores inválidos, atraso/carência/incumprimento/alertas e políticas a quatro olhos com unicidade na base. |
| `tests/kyc.test.ts` | Tipo documental e assinaturas dos bytes JPG/PNG/WEBP/PDF, formatos/tamanhos recusados, conteúdo cifrado e leitura, segregação, motivo de rejeição, nova versão, níveis 0→1→2→3 com evidência, documento duplicado noutra conta, permissões e `access_log` só de acrescentar. |
| `tests/trust.test.ts` | Factos para os quatro anéis, cumulatividade, ausência de evidência, atraso a bloquear o anel 4, limiar de pontualidade do Xitique, contrato de tipos sem atributos protegidos/abertura da app e invariância perante esses atributos adicionais. |
| `tests/passport.test.ts` | Cada uma das sete secções isoladamente, exclusão de secções não escolhidas, volume por intervalo e poupança sem saldo exacto, revogação só pelo dono, expiração, assinatura/conteúdo adulterados e ausência de dados nas respostas inválidas. |
| `tests/conversation.test.ts` | Propostas na app e no WhatsApp, ledger intacto até SIM, NÃO, repetição de SIM, isolamento entre comerciantes e expiração, respostas financeiras a partir do ledger, pedido humano com incidente e registo da escalada, conhecimento em rascunho recusado e aprovado aceite com fonte. |
| `tests/permissions.test.ts` | Matriz explícita das 20 capacidades para os nove papéis; gestão sem aprovação KYC/crédito e auditor sem capacidades de escrita. |
| `tests/fixtures.ts` | Dados e políticas exclusivamente de teste, histórico financeiro, fluxos de crédito, telefone ECDSA e assinaturas de ficheiros. |
| `docs/codex/CX3.md` | Este relatório. |

## Verificações executadas

Comando dirigido à CX3:

```powershell
npx vitest run tests/xitique.test.ts tests/credit.test.ts tests/kyc.test.ts tests/trust.test.ts tests/passport.test.ts tests/conversation.test.ts tests/permissions.test.ts
```

Resultado real da execução dirigida após a marcação dos defeitos, Vitest 5.0.5, código de saída 0:

```text
Test Files  7 passed (7)
     Tests  84 passed | 5 expected fail | 1 todo (90)
  Duration  74.66s
```

| Suite | Aprovados | Falhas esperadas | Pendente |
| --- | ---: | ---: | ---: |
| Xitique | 6 | 4 | 1 |
| Crédito | 17 | 1 | 0 |
| KYC | 11 | 0 | 0 |
| Confiança | 9 | 0 | 0 |
| Passaporte | 12 | 0 | 0 |
| Conversa | 7 | 0 | 0 |
| Permissões | 22 | 0 | 0 |
| **Total** | **84** | **5** | **1** |

A primeira execução, sem `it.fails`, terminou com código 1: **2 ficheiros falhados, 5 aprovados; 4 testes falhados, 82 aprovados e 1 não executado** (87 testes, 94.89 s). Expôs o erro SQL do Xitique e a rejeição da repetição do pagamento final. Depois separei declaração, recusas de confirmação e confirmação válida em regressões independentes, e preparei o estado de entrada dos testes de recebimento e atraso directamente na fixture. Não corrigi os serviços.

`npx tsc --noEmit --incremental false`: **duas execuções terminadas com código 0, sem diagnósticos**, incluindo a verificação final. Não foram observados erros nos ficheiros CX3 nem nos restantes ficheiros durante essas execuções.

`npm test`: **código de saída 0**, na versão final dos testes:

```text
Test Files  10 passed (10)
     Tests  136 passed | 5 expected fail | 1 todo (142)
  Duration  39.14s
```

Os 52 testes preexistentes também passaram. As cinco falhas esperadas e o pendente pertencem à CX3. As execuções usam instâncias de PGlite em memória; não foi executado nenhum script `db:*`.

## Limites

- `it.fails` indica comportamento desejado que continua a falhar; não significa que o defeito esteja resolvido. Quando o Claude corrigir os serviços, essas regressões devem passar a `it` e a suite deve voltar a correr.
- O caminho integral declaração → confirmação → recebimento do Xitique está bloqueado por CX3-01. Os testes de recebimento/conclusão e do job de atrasos usam contribuições previamente guardadas na fixture; comprovam essas operações isoladamente, sem afirmar que o ciclo integral já funciona.
- O possível bloqueio da ronda do tesoureiro (CX3-03) foi identificado por leitura das regras. Continua em `it.todo`, sem alegação de reprodução da recusa de domínio, porque o SQL falha antes desse ponto.
- Em crédito, a prontidão é calculada pelo `trustFor` real sobre movimentos financeiros de teste. O nível KYC e contratos antigos liquidados são estado prévio de fixture; a suite KYC e os testes de liquidação cobrem os respectivos fluxos separadamente.
- Limites, preços e critérios das fixtures são arbitrários e exclusivos dos testes. Não constituem política comercial nem dados de mercado.
- Os serviços de domínio, a sincronização, o ledger, a pesquisa de conhecimento e as restrições da base não foram substituídos por mocks. Apenas o adaptador opcional de IA externa foi desactivado na suite de conversa, sem chamadas de rede ou chaves reais.
- Os ficheiros KYC verificam assinaturas dos bytes, cifragem e regras do serviço; não verificam descodificação completa de imagens, OCR, antivírus ou armazenamento externo.
- Não executei `npm run build`: a alteração é exclusivamente de testes e relatório; não houve alteração de código de aplicação por mim. Não foram feitos testes de interface, de servidor HTTP ou contra Supabase.

## Pedidos ao Claude

### CX3-01 — SQL inválido bloqueia declaração e confirmação do Xitique (reproduzido)

Local: `src/server/xitique/service.ts`, `declareContribution` e `confirmContribution`, nas duas chamadas `.for("update", { of: xitiqueContributions })` (linhas 145 e 191 na leitura efectuada).

O Drizzle emite:

```sql
... from "ukuphila"."xitique_contributions" ...
for update of "ukuphila"."xitique_contributions"
```

O PGlite/PostgreSQL recusa a cláusula de bloqueio com SQLSTATE **42601**, mensagem **`FOR UPDATE must specify unqualified relation names`**. O `FROM` deve continuar no schema `ukuphila`; o alvo de `OF` precisa de um nome de relação/alias aceite pelo PostgreSQL. Não retirar o isolamento por schema para resolver isto.

Reprodução:

1. Criar um grupo com três comerciantes, entrar por código e iniciar com `startGroup`.
2. Assinar `xitique.declare` com a chave ECDSA do telefone e enviar por `applyBatch`: lança o erro SQL antes de declarar.
3. Para verificar a confirmação independentemente, guardar uma contribuição `declarada` com `declaredBy` na fixture e chamar `confirmContribution` pelo tesoureiro: o mesmo erro surge antes das verificações de permissão e segregação.

Regressões em `tests/xitique.test.ts`, grupo `contribution lock regressions (CX3-01)`: **quatro `it.fails`**, para declaração/repetição, recusa de auto-confirmação com o motivo de domínio, recusa de membro não autorizado e confirmação válida por outra pessoa. A restrição `xitique_two_people_ck` foi testada directamente e passa.

### CX3-02 — Repetição do último pagamento é recusada depois da liquidação (reproduzido)

Local: `src/server/credit/service.ts`, `recordRepayment`, validação de estado antes da pesquisa por referência (linhas 287–289 na leitura efectuada).

Reprodução:

1. Submeter, analisar, aprovar, aceitar com PIN e entregar um crédito pelo dono do fornecedor com o código correcto.
2. Registar um pagamento igual ao total em falta com uma referência única. O contrato fica `liquidado`.
3. Repetir exactamente `recordRepayment` com o mesmo contrato, valor e referência.

Esperado: reconhecer a referência existente e terminar sem novo movimento. Obtido: `DomainError` com código **`contrato_estado`** e mensagem **`Este contrato não aceita pagamentos.`** A guarda de estado acontece antes de detectar a repetição.

Regressão: `final repayment replay regression` em `tests/credit.test.ts`, **um `it.fails`**. O teste adjacente confirma que existe apenas um pagamento e um lançamento financeiro; não foi observada dupla cobrança. A repetição de um pagamento parcial enquanto o contrato ainda está activo também foi testada e passa.

### CX3-03 — Confirmar a contribuição do único tesoureiro na sua ronda (pendente, identificado por leitura)

Local: `src/server/xitique/service.ts`, `confirmContribution`, permissões de tesoureiro/destinatário e regra de duas pessoas (linhas 193–197 na leitura efectuada).

Depois de resolver CX3-01, reproduzir com três membros e a ordem a começar pelo tesoureiro criado em `createGroup`:

1. Declarar a contribuição do tesoureiro para a ronda em que ele próprio recebe.
2. Tentar confirmar com o próprio: a regra de duas pessoas deve recusar.
3. Tentar confirmar com qualquer dos outros dois membros: actualmente só tesoureiro ou destinatário têm autorização; ambos são a mesma pessoa nessa ronda.

Pela implementação lida, não há uma segunda pessoa elegível. Definir e implementar a regra de confirmação desta contribuição preservando a segregação. Existe um `it.todo` identificado como CX3-03; a primeira tentativa de executar este cenário ficou bloqueada pelo SQL de CX3-01, pelo que o bloqueio de autorização ainda não foi confirmado em execução.
