# CX1 — App do agente

Concluída por Codex em 2026-11-03. Âmbito: apenas CX1. Não alterei ficheiros existentes de outras tarefas, não arranquei servidores, não executei scripts de base de dados nem toquei em `.env*`. Sem commit ou push.

## O que fiz

- `/agente`: `FieldShell` com nome do agente, mercado e as quatro entradas pedidas; ronda agrupada pelas três prioridades de `buildRonda`, com os motivos e ligação à ficha. O contador de visitas conta comerciantes distintos, mesmo quando têm vários motivos.
- Carteira com pesquisa por nome da pessoa ou negócio em `?q=`, insensível a acentos, cartões para telemóvel e estados vazios.
- Ficha com dados do negócio, KYC, metadados dos documentos e motivos de rejeição, submissão de fotografia/PDF, atestações e histórico, checklist de registo, venda/despesa assistida, visita, incidente, dispositivos e leasing.
- Registo de comerciante com as acções existentes e os consentimentos de `CONSENT_PURPOSES`: `consent_base` obrigatório; voz/IA, historial para crédito e estudos opcionais e inicialmente desmarcados.
- Código de entrada pela `issueActivationCodeAction` existente: apresentação grande, explicação para telefone + código + PIN e botão para ocultar. A pré-visualização usa `sealText`/`openText`, num cookie HttpOnly, SameSite strict, Secure em produção, ligado ao agente e ao comerciante. Expira no servidor ao fim de cinco minutos; essa duração é apenas a duração da pré-visualização, sem alterar a validade do código de autenticação. O código não vai para o URL. Esta solução mantém todos os componentes dentro dos ficheiros permitidos.
- Incidentes abertos da carteira com resolução e nota; ganhos agrupados pelo mês de Maputo e vinte visitas recentes. Valores assinalados pelo sistema como pendentes de validação são apresentados assim, sem os afirmar aprovados ou pagos.
- Cada página e o layout verificam `requirePage(["agent"])`. A ficha verifica a atribuição e regista `logAgentView` antes de carregar o detalhe. As listagens também registam os acessos aos comerciantes, sem duplicar a mesma pessoa dentro da mesma leitura.
- As novas funções de consulta filtram a carteira e seleccionam apenas os campos necessários. Não carregam hashes de PIN/senha, segredos TOTP, chaves públicas dos dispositivos, blobs cifrados ou metadados de armazenamento dos documentos.
- Os formulários de registo assistido, leasing e perda de telefone exigem confirmação no servidor. As funções locais da CX1 voltam a verificar o dispositivo ou incidente na carteira antes de chamar as acções partilhadas. O avanço da checklist só aceita o passo imediatamente seguinte ao estado actual.
- Usei os componentes e classes existentes, sem acrescentar CSS ou dependências. A interface inclui a explicação de que o Ukuphila regista o negócio e não guarda dinheiro.

## Ficheiros criados

1. `src/app/agente/layout.tsx`
2. `src/app/agente/page.tsx`
3. `src/app/agente/comerciantes/page.tsx`
4. `src/app/agente/comerciantes/[id]/page.tsx`
5. `src/app/agente/novo/page.tsx`
6. `src/app/agente/incidentes/page.tsx`
7. `src/app/agente/ganhos/page.tsx`
8. `src/server/agent/queries.ts`
9. `docs/codex/CX1.md` — este relatório.

## Verificações reais

- Li `AGENTS.md`, `docs/STATUS.md`, `docs/CODEX_TASKS.md`, o SOP §36 do documento mestre e os padrões existentes. Consultei a documentação instalada do Next.js para páginas, layouts, formulários/Server Actions e cookies assíncronos.
- `npx tsc --noEmit --incremental false`: terminou com código 0, sem erros.
- `npm test`: terminou com código 1. Resultado dessa execução sobre a árvore partilhada: **110 passados, 3 falhados e 1 ignorado, em 8 ficheiros**; sete ficheiros passaram e `tests/xitique.test.ts` falhou. A suite de regressão de um único tesoureiro também teve erro de preparação. A causa reportada foi `FOR UPDATE must specify unqualified relation names`, na consulta de `declareContribution`, `src/server/xitique/service.ts:139`. Não alterei o Xitique nem os testes de CX3.
- **19 verificações isoladas passaram**: executei o código das funções da ficha/incidentes em Node, com TypeScript transpilado em memória, dependências substituídas e cifra real. Cobri confirmação e sessão no registo assistido; confirmação, número inteiro de prestações e modelo disponível no leasing; pertença/estado activo do dispositivo; passos repetidos e saltados; incidente de outra carteira; pré-visualização cifrada, apresentação grande, isolamento entre agentes/comerciantes, expiração, adulteração, ocultação e ficha inválida ou não atribuída.
- **8 verificações isoladas das consultas passaram**: usei os objectos reais do schema e o dialecto Drizzle, com execução de consultas substituída. Verifiquei recusa antes da consulta para comerciantes não atribuídos, predicados de isolamento, projecções sem credenciais/metadados sensíveis, incidente atribuído/não atribuído, centavos e agrupamento mensal de Maputo, visitas limitadas à carteira e deduplicação dos registos de acesso.
- Os oito ficheiros de implementação passaram a verificação de espaços no fim de linha, newline final, autorização nas páginas e ausência do vocabulário de apresentação proibido.
- As 27 verificações isoladas correram pela entrada padrão do Node: não criaram ficheiros de teste nem abriram base de dados ou servidor. São verificações com dependências substituídas, não testes E2E.

## Limites

- Não executei `npm run build`, navegador, capturas ou testes E2E. Falta validar a compilação Next.js e o comportamento visual/real dos formulários durante a integração, incluindo upload e actualização do código após a Server Action.
- A pré-visualização cifrada usa a `DOCUMENT_KEY` já exigida pelo serviço de cifra existente; não criei configuração nova.
- `buildRonda` devolve no máximo quarenta motivos. Os contadores da ronda reflectem esse resultado, e não uma contagem ilimitada de todas as necessidades da carteira.
- As condições e comissões vêm do sistema ou são introduzidas pelo agente a partir das condições da gestão; não acrescentei taxas, preços, prazos ou limites comerciais. A ligação do leasing a uma aprovação formal continua a depender do serviço partilhado.
- A árvore tinha trabalho concorrente noutros caminhos. Os resultados globais acima correspondem à execução efectivamente observada e não são uma revisão desses trabalhos.

## Pedidos ao Claude

1. **Autorizar dentro das acções/serviços partilhados:** `resolveIncidentAction`/`resolveIncident` aceitam agentes sem conferir a carteira; `reportLostAction`/`reportDeviceLost` também não verificam a atribuição do dispositivo. Na CX1 coloquei essas verificações nas funções locais dos formulários, mas a protecção deve existir também no ponto partilhado de escrita. Reproduzir chamando as acções originais com sessão do agente A e um incidente/dispositivo da carteira do agente B; a recusa deve acontecer no servidor. Rever igualmente `resolveConflictAction`, que tem a mesma ausência de filtro.
2. **Aprovação e validação de leasing:** `createLeaseAction`/`createLease` não ligam os termos a uma política aprovada e não validam no domínio o número de prestações antes de `Array.from`. A CX1 exige confirmação, modelo activo e inteiro positivo, mas isso não prova aprovação pela gestão nem substitui validação de valores e limites no serviço. Manter os valores das condições aprovadas como fonte e preencher coerentemente o estado de validação dos termos/comissões.
3. **Checklist inicial:** `onboardMerchant` grava `onboardingStep: 5` logo ao criar a conta, sem recolher atestações/documentos nessa chamada. A interface reflecte esse estado do sistema. Confirmar se os cinco primeiros passos do SOP devem estar concluídos nessa altura e alinhar o serviço com a verificação realmente efectuada.
4. **Alvo do botão de saída:** o `FieldShell` partilhado fixa o botão de terminar sessão em 36 × 36 px. Aumentar para pelo menos 44 × 44 px em `src/components/console/shell.tsx`, que não pertence à CX1.
5. **Integração e regressões:** executar build e validar em telemóvel ronda/carteira, formulários, fotografia/PDF e geração/ocultação do código; portar as verificações de autorização e confirmação para testes persistentes no âmbito autorizado. Encaminhar a falha global de Xitique descrita acima para a integração/CX3.
