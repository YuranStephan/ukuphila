# CX2 — Sala de risco e portal do fornecedor

Data: 2026-11-03. Implementação pelo Codex, limitada aos caminhos autorizados na CX2.

## O que fiz

- Sala de risco em superfície nocturna, com navegação para visão geral, carteira, alertas, casos, governação e políticas; ligação à gestão condicionada ao papel.
- Visão geral com exposição contratada, PAR 1/7/30 em MT e percentagem, envelhecimento em `BarList`, concentração por mercado e fornecedor, gravidade dos alertas, pontualidade, liquidações e pedidos por estado. Os gráficos têm os mesmos dados disponíveis como tabela.
- Carteira com filtro por estado, saldo por liquidar, mercado, fornecedor e dias de atraso. A interface explica que a exposição inclui contratos ainda por entregar e que o PAR conta todo o saldo do contrato afectado.
- Alertas abertos/fechados, execução manual de regras, abertura de investigação e fecho com nota, através das acções existentes.
- Casos abertos/fechados, detalhe com histórico de notas, alertas associados e conclusão. IDs de caso inválidos dão ausência de resultado antes da consulta.
- Governação com prontidão por mercado/actividade, numeradores e denominadores, aviso sobre diferenças entre grupos, atributos excluídos e versão configurada das regras. Regras marcadas por validar não são apresentadas como aprovadas.
- Políticas em vigor, rascunhos e arquivadas, consulta de todos os parâmetros, proposta sem valores comerciais preenchidos de origem e aprovação por outra pessoa. As acções existentes voltam a verificar a autorização e a segregação de funções.
- Portal do fornecedor com encomendas filtradas por estado, itens e condições contratadas, confirmação de entrega pelo código fornecido pelo comerciante, catálogo só de leitura, prestações e pagamentos registados.
- Todas as páginas e ambos os layouts verificam a sessão e a capacidade no servidor. As listas e o detalhe de risco registam os comerciantes expostos em `ukuphila.access_log`, sem duplicar a mesma pessoa numa vista.
- Todas as consultas do fornecedor exigem o papel autorizado e filtram por `suppliers.ownerId = user.id`, incluindo catálogo, prestações e pagamentos. Não seleccionam o código de entrega, o historial de confiança nem credenciais.
- Reutilizei as classes existentes; não criei CSS nem alterei o layout raiz. Os textos esclarecem onde importa que o Ukuphila regista o negócio e não guarda dinheiro.

## Ficheiros

Só escrevi nestes caminhos autorizados:

- `src/app/risco/layout.tsx`
- `src/app/risco/page.tsx`
- `src/app/risco/carteira/page.tsx`
- `src/app/risco/alertas/page.tsx`
- `src/app/risco/casos/page.tsx`
- `src/app/risco/casos/[id]/page.tsx`
- `src/app/risco/governacao/page.tsx`
- `src/app/risco/politicas/page.tsx`
- `src/app/fornecedor/layout.tsx`
- `src/app/fornecedor/page.tsx`
- `src/app/fornecedor/catalogo/page.tsx`
- `src/app/fornecedor/liquidacoes/page.tsx`
- `src/server/risk/queries.ts`
- `src/server/supplier/queries.ts`
- `docs/codex/CX2.md`

Durante a execução surgiram em paralelo páginas de risco e consultas dentro da lista CX2. Completei esses caminhos a partir do conteúdo presente, preservando as consultas de casos e reutilizando `src/components/console/risk-alerts.tsx` e `src/lib/risk.ts`, que já estavam disponíveis. Não escrevi nesses componentes nem em `src/server/risk/cases.ts` ou `/risco/equidade`.

## Verificações reais

- Li `AGENTS.md`, `docs/STATUS.md`, `docs/CODEX_TASKS.md`, os trechos relevantes do documento mestre e os guias locais do Next para páginas, layouts e segurança de dados.
- `npx tsc --noEmit --incremental false`: duas execuções concluídas com código 0, sem erros, incluindo a execução posterior aos últimos ajustes de código.
- `npm test`: primeira execução com código 1; 134 testes passaram, 4 falharam e 1 foi ignorado. As falhas observadas eram a repetição do pagamento final de crédito e operações de Xitique com `FOR UPDATE` sobre relação qualificada pelo schema; houve também falha de preparação de uma suite de Xitique.
- `npm test -- --maxWorkers=1`: código 0; 10 ficheiros passaram, 136 testes passaram, 5 falhas esperadas e 1 pendente, num total de 142. Os testes da CX3 foram actualizados em paralelo entre as execuções; o resultado final não significa que os defeitos marcados como falhas esperadas estejam corrigidos.
- Verificação executável das consultas, por stdin de Node, com `typescript.transpileModule`, `node:assert/strict` e um executor `drizzle-orm/pg-proxy` sem ligação à base: passou. Verifiquei o filtro do proprietário para dois fornecedores diferentes em todas as cinco consultas produzidas, rejeição de outro papel antes de consultar, exclusão de campos privados, registo de acesso sem duplicação, ausência de escrita para uma vista vazia, recusa do fornecedor na sala de risco, ID de caso inválido e filtros de casos abertos/fechados.
- A primeira tentativa dessa verificação com `tsx` não arrancou: `os.userInfo()` devolveu `uv_os_get_passwd ENOMEM`. A alternativa com o compilador TypeScript correu sem esse carregador. Uma asserção inicial do verificador foi ajustada para aceitar a qualificação de schema e o parâmetro de `limit` emitidos pelo Drizzle; não foi uma alteração às consultas do produto.
- Pesquisa nos ficheiros de interface da CX2: sem os termos de apresentação proibidos, `ExampleTag` ou activação da faixa de dados de demonstração.

Não arranquei servidores, não executei scripts de base de dados, não abri `.data/pglite`, não consultei a base alojada, não toquei em `.env*`, não fiz commit nem push. Os testes da suite usam bases em memória. Não executei build nem capturas nesta ronda de trabalho partilhado; não há validação visual ou de ponta a ponta declarada.

## Limites

- Os resultados de TypeScript e testes correspondem à árvore partilhada no momento de cada execução. Não houve revisão humana declarada.
- A verificação adicional das consultas prova o SQL e os parâmetros produzidos; não substitui um teste de integração com dois fornecedores reais.
- A carteira usa o conjunto de contratos devolvido por `creditPortfolio`: aguarda entrega, activo, em atraso e incumprimento. Liquidados/cancelados continuam disponíveis no portal do respectivo fornecedor.
- Alertas mostram os 80 mais recentes por fila e casos os 100 mais recentes, conforme as consultas existentes. Não acrescentei paginação.
- O PAR e os dias de atraso dependem da classificação de prestações como `em_atraso` pelo domínio existente. PAR 7 e PAR 30 usam, respectivamente, atraso superior a 7 e 30 dias, como calcula o serviço; os rótulos explicam estes limites.
- Catálogo sem edição e liquidações sem registo de pagamentos pelo fornecedor, conforme a ronda. Os recebimentos são registos de pagamentos externos, não confirmação de transferência nem custódia de dinheiro.

## Pedidos ao Claude

Estes pontos estão fora dos ficheiros autorizados à CX2 e não foram alterados. Os primeiros quatro resultam de leitura do código, sem reprodução contra uma base de dados.

1. **Validar propostas de política no servidor.** `src/actions/credit.ts:56` converte campos com `Number` e chama `proposePolicy`, que actualmente só verifica a capacidade antes de inserir. Uma chamada directa pode contornar os `required`, `min`, `step` e `pattern` do formulário. Validar versão, limites em centavos inteiros seguros, prazos inteiros positivos, custos finitos, tolerância e percentagem de concentração. Rever também `isExample: true` fixo na acção e a sua semântica depois de aprovação. A UI da CX2 não usa rótulos de demonstração.
2. **Ligar as acções de risco às regras de domínio mais fortes.** `src/actions/risk.ts` ainda implementa as mutações directamente. `addCaseNoteAction` não verifica se o caso está fechado; `openCaseAction` não recusa um alerta fechado nem bloqueia a linha contra aberturas concorrentes; `closeAlertAction` permite fechar isoladamente um alerta associado a um caso. O novo `src/server/risk/cases.ts` já contém verificações e bloqueios para esses cenários. Integrar esse serviço nas acções e cobrir as chamadas directas, pois esconder os formulários não assegura estas condições.
3. **Alinhar a população de `repaymentStats`.** Em `src/server/analytics/programme.ts:212`, `due` conta apenas prestações vencidas até `current_date`, mas `on_time` também pode contar prestações futuras já pagas antecipadamente. Com uma prestação vencida paga a tempo e outra futura já paga, a taxa pode exceder 100%. Aplicar o mesmo corte temporal ao numerador e denominador, com o dia de Maputo. A CX2 usa os valores devolvidos pelo serviço, sem inventar nem limitar artificialmente a taxa.
4. **Preservar os termos na classificação de atraso.** `markOverdue` em `src/server/credit/service.ts:339` usa a tolerância e o limiar de incumprimento da política activa para todos os contratos. Aprovar outra política pode mudar a classificação de um contrato anterior. Usar os termos aceites/versão do contrato; a tolerância já é guardada em `termsSnapshot`. A interface diz apenas que o registo dos termos aceites é mantido.
5. **Integrar os ficheiros que surgiram em paralelo.** Manter `src/components/console/risk-alerts.tsx` e `src/lib/risk.ts`, dos quais as páginas de alertas/casos dependem. A navegação CX2 aponta para `/risco/governacao`. A rota paralela `/risco/equidade`, fora da minha lista, ainda continha `ExampleTag` e texto proibido na última leitura; reconciliar ou redireccionar essa rota na integração.
6. **Ajustar alvos de toque dos componentes partilhados.** As novas entradas e botões seguem as dimensões existentes e os filtros/abas locais têm pelo menos 44 px. Contudo, `src/styles/console.css` define ligações da navegação da consola com 39 px e 40 px em ecrã estreito; `details.table-view summary` também não tem mínimo de 44 px. Ajustar estes estilos globais e validar as vistas em telemóvel. O `BarList` partilhado desenha ainda uma largura mínima para valores zero; considerar largura zero nesses casos.
7. **Acompanhar os defeitos já registados na CX3.** A repetição do pagamento final e as operações de Xitique continuam representadas por falhas esperadas/pending na suite final. Ver `docs/codex/CX3.md`; não tratei essas falhas como problemas da UI nem alterei os serviços respectivos.
