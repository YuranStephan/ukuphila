UKUPHILA — KNOWLEDGE BASE MASTER
Documento central de produto, operação, dados, IA, KYC, crédito, tecnologia e evolução do projecto
Versão: 1.0 | Data: 30 de Agosto de 2026
Finalidade: servir como fonte estruturada de conhecimento para uma IA, para a equipa do projecto e para futuras especificações de produto.
Nota de escopo: a base abaixo separa claramente o que está descrito no conceito original do projecto daquilo que é uma proposta de desenho operacional/técnico criada para tornar o conceito implementável. Regras legais, regulatórias, preços, limites, SLAs e políticas de crédito devem ser validados antes de produção.

# 1. Identidade do Projecto

| Campo | Definição |
|---|---|
| Nome | Ukuphila |
| Tagline | Crescer. Conectar. Prosperar. |
| Categoria | Inclusão financeira + gestão de pequenos negócios + infraestrutura digital |
| Mercado inicial | Comércio informal em Maputo |
| Utilizador principal | Comerciante informal / vendedor de mercado |
| Canais | Aplicação/plataforma digital, agente/quiosque e WhatsApp |
| Princípio central | Ajudar primeiro, pedir depois. |
| Estratégia | Gestão do negócio → poupança → Xitique digital → crédito |
| Visão de longo prazo | Evolução para uma instituição de microfinança com licença própria, condicionada ao sucesso do caminho anterior e aos factores regulatórios. |


# 2. Resumo Executivo
O Ukuphila é concebido como um acompanhante de negócio para comerciantes informais de Maputo. Não começa pelo empréstimo. Começa por tornar o negócio visível, organizado e compreensível para o próprio comerciante.
O problema identificado não é falta de capacidade empresarial. Muitos comerciantes conhecem clientes pelo nome, concedem crédito informal baseado em confiança e constroem reputação ao longo de anos. O problema é acesso: acesso a ferramentas de gestão, serviços financeiros adequados, histórico financeiro e mecanismos formais de poupança e crédito.
A proposta combina um smartphone em regime de leasing, um agente humano de confiança no mercado e uma plataforma que funciona com conectividade limitada. A relação é gradual: primeiro registo e caixa; depois poupança; depois Xitique; e só posteriormente crédito.
A tese económica é que a receita inicial pode vir de transacções, leasing de dispositivos e parcerias com fornecedores, deixando o crédito como consequência de uma relação e de um historial comportamental já construídos.

# 3. Problema

## 3.1 Contexto do comerciante
Mercados como Zimpeto, Xipamanine, Fajardo e Xiquelene representam um ambiente de comércio de rua em que milhares de pessoas sustentam famílias através da actividade comercial. O comerciante possui conhecimento local e relações de confiança, mas frequentemente não dispõe de ferramentas formais.

## 3.2 Exclusão financeira
- Ausência ou insuficiência de documentação actualizada.
- Ausência de histórico de crédito formal.
- Produtos financeiros demasiado rígidos para negócios sazonais e imprevisíveis.
- Dificuldade de acesso a conta, crédito e ferramentas de gestão.
- Baixa visibilidade financeira do negócio.

## 3.3 Perdas silenciosas
- Dinheiro do negócio misturado com dinheiro da casa.
- Stock sem registo.
- Vendas esquecidas ou não registadas.
- Compras decididas sem saber o resultado do mês.
- Incapacidade de distinguir facturação, margem, lucro e dinheiro disponível.
Estas perdas podem não aparecer em estatísticas formais, mas acumulam-se ao longo do tempo.

# 4. Problema que o Ukuphila Resolve

| Problema | Resposta Ukuphila |
|---|---|
| Falta de organização financeira | Gestão de caixa simples |
| Mistura entre casa e negócio | Separação por bolsos |
| Falta de histórico | Registo transaccional contínuo |
| Dificuldade de poupar | Poupança digital |
| Xitique sem registo centralizado | Xitique digital |
| Barreira de alfabetização digital | Interacção por voz e WhatsApp |
| Conectividade instável | Modo offline + sincronização |
| KYC rígido | KYC progressivo por níveis |
| Falta de crédito adequado | Crédito fornecedor como primeiro produto de crédito |
| Desconfiança tecnológica | Agente humano no próprio mercado |


# 5. Princípios de Produto
- Ajudar primeiro, pedir depois.
- Tecnologia não pode ser o gargalo.
- Começar pelo negócio, não pela dívida.
- Construir confiança antes de oferecer crédito.
- Preservar práticas locais em vez de as substituir.
- Usar linguagem e canais já familiares ao utilizador.
- Funcionar em condições de conectividade limitada.
- Profundidade antes de largura: validar um mercado antes de escalar.
- Subprometer e superar.
- Falhar pequeno e aprender rápido.

# 6. Persona Principal

## 6.1 Perfil conceptual
Comerciante informal que vende produtos num mercado de Maputo, gere caixa diariamente, tem clientes recorrentes e pode conceder crédito informal, mas possui pouco ou nenhum registo financeiro formal.

## 6.2 Necessidades
- Saber quanto vendeu.
- Saber quanto gastou.
- Saber quanto realmente ganhou.
- Separar dinheiro da casa e do negócio.
- Controlar stock.
- Poupar.
- Participar num Xitique com registo confiável.
- Construir histórico financeiro.
- Comprar stock sem necessidade de desembolso imediato.

## 6.3 Barreiras
- Documentação incompleta.
- Baixa confiança em instituições.
- Conectividade limitada.
- Dispositivos de entrada de gama.
- Baixa familiaridade com aplicações complexas.
- Preferência por interacção humana e canais conhecidos.

# 7. Jornada do Utilizador

| Fase | Objectivo | Resultado esperado |
|---|---|---|
| Descoberta | Conhecer Ukuphila | Confiança inicial |
| Registo | Criar identidade | Perfil criado |
| KYC inicial | Verificação mínima | Acesso básico |
| Gestão de caixa | Registar entradas/saídas | Visibilidade financeira |
| Separação | Criar bolso negócio/casa | Controlo financeiro |
| Poupança | Guardar dinheiro | Comportamento de poupança |
| Xitique | Participar digitalmente | Registo colectivo |
| Histórico | Acumular comportamento | Identidade financeira |
| Crédito fornecedor | Comprar stock e pagar depois | Primeiro crédito |
| Escala | Aumentar produtos/limites | Maior inclusão financeira |


# 8. Registo — Especificação Proposta
A seguinte estrutura é uma proposta de implementação derivada do conceito; não constitui uma regra já definida no documento original.

## 8.1 Dados mínimos
- Número de telemóvel.
- Nome pelo qual o utilizador é conhecido.
- Fotografia/rosto para verificação, quando aplicável.
- Mercado/local de actividade.
- Tipo de actividade.
- Categoria de produtos.
- Contacto alternativo, se necessário.
- Informação básica do negócio.

## 8.2 Fluxo
- Agente apresenta o serviço.
- Utilizador fornece número de telemóvel.
- Sistema cria registo preliminar.
- Utilizador/agente recolhe dados mínimos.
- Processo de verificação é executado.
- Perfil recebe um nível de acesso.
- Utilizador começa a registar actividade.
- Dados posteriores elevam progressivamente a confiança do perfil.

# 9. KYC — Know Your Customer
O conceito prevê KYC por níveis. A premissa é que a ausência de BI actualizado, morada formal ou histórico bancário não deve automaticamente tornar a pessoa invisível; deve existir uma progressão de verificação.

## 9.1 Nível conceptual

| Nível | Base | Capacidade conceptual |
|---|---|---|
| Inicial | Telemóvel + rosto | Entrada e funções básicas |
| Intermédio | Mais informação/documentos disponíveis | Maior confiança e funcionalidades |
| Avançado | Verificação mais completa + histórico | Acesso a capacidades superiores |


## 9.2 Papel do agente
O agente é uma camada humana do processo. O conceito atribui valor informacional ao conhecimento que o agente possui sobre a pessoa e o mercado. Isso não significa substituir requisitos legais por opinião do agente: qualquer implementação deve combinar informação humana com verificações e regras formais.

## 9.3 Princípios de KYC
- Minimização de dados.
- Consentimento e transparência.
- Registo de quem efectuou cada verificação.
- Separação entre dado observado e dado declarado.
- Rastreabilidade das alterações.
- Revisão manual para casos excepcionais.
- Conformidade com requisitos aplicáveis antes do lançamento.

# 10. Documentos e Submissão
Para tornar o projecto operacional, o sistema deve possuir um módulo de documentos. Os tipos exactos e requisitos devem ser definidos pela política KYC/regulatória aplicável.

## 10.1 Estrutura proposta

| Campo | Descrição |
|---|---|
| document_id | Identificador único |
| user_id | Utilizador a que pertence |
| document_type | Tipo do documento |
| document_number | Número, quando permitido |
| file_reference | Referência segura do ficheiro |
| status | Pendente / submetido / em revisão / aprovado / rejeitado / expirado |
| submitted_at | Data/hora de submissão |
| reviewed_at | Data/hora da revisão |
| reviewer_id | Agente/revisor responsável |
| rejection_reason | Motivo estruturado, se rejeitado |
| expiry_date | Validade, quando aplicável |


## 10.2 Fluxo de submissão
- Utilizador ou agente inicia pedido.
- Sistema indica documento necessário.
- Fotografia ou ficheiro é capturado.
- Sistema valida formato e qualidade básica.
- Documento é cifrado e armazenado de forma segura.
- Pedido entra em estado de revisão.
- Revisor decide ou solicita correcção.
- Resultado fica registado em auditoria.
- Utilizador recebe indicação do próximo passo.
Não devem ser assumidos formatos, documentos obrigatórios ou prazos específicos sem validação jurídica/regulatória.

# 11. Gestão de Caixa

## 11.1 Objectivo
Permitir que o comerciante veja de forma simples o que entrou, o que saiu e quanto dinheiro está associado ao negócio.

## 11.2 Operações
- Registar venda.
- Registar despesa.
- Registar compra de stock.
- Registar retirada para casa.
- Registar entrada de dinheiro.
- Consultar saldo.
- Consultar movimentos.
- Corrigir movimento com trilho de auditoria.

## 11.3 Voz
A voz é parte central do desenho. O utilizador pode falar em português ou línguas locais, e o sistema deve converter a intenção em uma operação estruturada. Exemplo conceptual: 'Vendi duas caixas por mil meticais' → proposta de registo → confirmação → lançamento.
A IA não deve executar transacções financeiras críticas apenas por inferência silenciosa. Operações sensíveis devem ter confirmação adequada.

# 12. Bolsos: Negócio vs Casa
A separação visual entre dinheiro do negócio e dinheiro da casa é uma das funcionalidades fundamentais. O objectivo é evitar que stock, lucro e despesas familiares sejam tratados como uma única massa.

| Bolso | Função | Exemplos |
|---|---|---|
| Negócio | Operação comercial | Vendas, stock, fornecedores |
| Casa | Despesas pessoais/familiares | Alimentação, escola, transporte |
| Poupança | Reserva | Meta ou fundo reservado |
| Xitique | Poupança comunitária | Contribuições e recebimentos |


# 13. Poupança
A poupança aparece depois da gestão de caixa e antes do crédito. O sistema pode apresentar metas, movimentos e progresso, mas os mecanismos financeiros concretos devem ser definidos com o parceiro/licenciado responsável.

## Dados conceptuais
- Meta de poupança
- Valor acumulado
- Contribuições
- Levantamentos
- Data
- Estado da meta
- Histórico

# 14. Xitique Digital
O Ukuphila não inventa o Xitique; digitaliza uma prática comunitária existente. O objectivo é reduzir problemas de registo, memória divergente e confiança.

## Funcionalidades propostas
- Criar grupo.
- Adicionar participantes.
- Definir contribuição.
- Definir calendário.
- Registar pagamentos.
- Registar quem recebeu.
- Consultar histórico.
- Notificar participantes.
- Gerar estado do grupo.
- Manter trilho de auditoria.

## Regra fundamental
O sistema deve ser uma infraestrutura de confiança. Alterações importantes devem ser rastreáveis e visíveis aos participantes autorizados.

# 15. Crédito
O crédito é consequência de uma relação estabelecida, não o produto de entrada.

## 15.1 Primeiro produto
O conceito propõe crédito de fornecedor: o comerciante recebe stock sem desembolso imediato e paga depois das vendas.

## 15.2 Benefícios conceptuais
- Utilidade imediata para o negócio.
- Ligação directa entre financiamento e actividade comercial.
- Menor dependência de dinheiro em mão.
- Possibilidade de construir historial.
- Cada pagamento pontual contribui para a identidade financeira.

## 15.3 O que NÃO deve ser assumido
O documento original não define taxas, limites, maturidades, garantias, score numérico, critérios de aprovação, parceiros fornecedores ou política de cobrança. Esses elementos devem ser desenhados e validados separadamente.

# 16. Dados para Histórico e Score
O histórico deve começar antes do crédito. A plataforma pode observar comportamento operacional, desde que exista base legal, consentimento quando necessário, segurança e políticas de uso apropriadas.

| Família de dados | Exemplos |
|---|---|
| Actividade | Frequência de vendas, volume de movimentos |
| Caixa | Entradas, saídas, estabilidade |
| Poupança | Regularidade de contribuições |
| Xitique | Pontualidade de contribuições |
| Crédito | Pagamentos e incumprimentos |
| Fornecedor | Compras e liquidações |
| Uso do produto | Frequência de utilização, sem transformar isso automaticamente em mérito financeiro |

Qualquer score deve ser explicável, testado contra vieses e sujeito a governação.

# 17. WhatsApp como Canal
O WhatsApp é escolhido porque muitos utilizadores já conhecem o canal. O bot deve funcionar como uma interface simples para consultas e comandos.

## Exemplos de intenções
- Consultar saldo.
- Registar venda.
- Registar despesa.
- Consultar vendas do dia.
- Consultar progresso da poupança.
- Consultar estado do Xitique.
- Perguntar o que falta para concluir um processo.
- Receber notificações.

## Guardrails da IA
- Confirmar operações críticas.
- Não inventar saldos.
- Não inventar estados KYC.
- Não prometer aprovação de crédito.
- Escalar para agente quando a intenção for ambígua.
- Registar decisões automatizadas relevantes.
- Manter separação entre informação e execução.

# 18. Arquitectura Conceptual

| Camada | Responsabilidade |
|---|---|
| Canais | App, WhatsApp, agente/quiosque |
| Identity | Utilizador, autenticação, KYC |
| Core financeiro | Carteira, movimentos, saldos |
| Business management | Caixa, bolsos, stock e relatórios |
| Xitique | Grupos, contribuições, ciclos |
| Credit | Pedidos, decisões, contratos, pagamentos |
| Document management | Upload, revisão, estados, auditoria |
| AI layer | Conversação, voz, classificação, assistência |
| Integration | Pagamentos, fornecedores, parceiros, notificações |
| Data platform | Eventos, histórico, analytics |
| Security | IAM, cifragem, auditoria, monitorização |
| Offline sync | Fila local, sincronização, resolução de conflitos |


# 19. Offline-First
O modo offline é uma necessidade básica do produto. O sistema deve permitir operação limitada sem conectividade e sincronizar quando a ligação regressar.

## Modelo proposto
- Operação é criada localmente.
- Recebe identificador único.
- Entra numa fila de sincronização.
- Sistema tenta sincronizar.
- Servidor valida.
- Resposta é recebida.
- Estado local é actualizado.
- Conflitos são encaminhados segundo regras predefinidas.

## Riscos
- Duplicação de transacções.
- Conflitos de saldo.
- Dispositivo perdido.
- Manipulação local.
- Falha durante sincronização.
Operações financeiras de alto risco podem exigir conectividade ou confirmação adicional, dependendo da arquitectura e dos parceiros.

# 20. Smartphone em Leasing
O dispositivo acessível em regime de leasing é parte do modelo. O equipamento reduz a barreira tecnológica e pode ser distribuído através do ecossistema de agentes.

## Requisitos conceptuais
- Baixo custo.
- Boa autonomia.
- Câmara suficiente para documentos.
- Microfone adequado para voz.
- Capacidade para aplicação leve.
- Protecção contra perda/roubo conforme política.
- Gestão remota quando legal e tecnicamente apropriada.

# 21. Agentes e Quiosques
O agente é simultaneamente ponto de confiança, assistência e operação. A presença física é deliberada: o projecto não pretende simplesmente digitalizar uma comunidade, mas criar uma ponte entre a tecnologia e a realidade do mercado.

## Funções
- Onboarding.
- Apoio ao KYC.
- Ajuda no registo.
- Suporte tecnológico.
- Educação financeira.
- Resolução de dúvidas.
- Escalação de incidentes.
- Apoio a documentos.

## Controlo
- Cada agente deve possuir identidade própria.
- Acções críticas devem ser auditáveis.
- Permissões devem seguir o princípio do menor privilégio.
- Não deve existir capacidade de alterar dados financeiros sem rastreabilidade.

# 22. Modelo de Negócio
Na fase inicial, a receita prevista no conceito não depende principalmente do crédito.

| Fonte | Papel |
|---|---|
| Transacções | Receita operacional associada ao uso |
| Leasing de dispositivos | Monetização do acesso ao hardware |
| Parcerias com fornecedores | Economia/receita ligada ao ecossistema comercial |
| Crédito | Produto posterior e consequência do relacionamento |

Os preços e percentagens não são definidos no documento de origem.

# 23. Diferenciação
- Começar por gestão de negócio.
- Crédito como consequência.
- Integração de agente + dispositivo + plataforma.
- Voz como interface.
- WhatsApp como canal.
- Xitique digital.
- KYC progressivo.
- Offline-first.
- Construção de historial comportamental.

# 24. Concorrência e Hipótese de Mercado
O conceito reconhece que o espaço de inclusão financeira não está vazio. Existem operadores de mobile money, MFI e iniciativas de crédito digital. A hipótese de diferenciação é que existe espaço para uma solução integrada que comece pela gestão do negócio e use o crédito como consequência.
Esta afirmação é uma hipótese estratégica do projecto, não uma conclusão independente de pesquisa de mercado. Deve ser validada com pesquisa competitiva e entrevistas.

# 25. MVP
O MVP para o piloto deve ser deliberadamente focado.

| Prioridade | Componente |
|---|---|
| P0 | Registo e identidade |
| P0 | KYC básico |
| P0 | Gestão de caixa |
| P0 | Bolsos negócio/casa |
| P0 | Carteira digital |
| P0 | WhatsApp |
| P0 | Modo offline |
| P1 | Poupança |
| P1 | Xitique |
| P1 | Documentos |
| P1 | Painel de agente |
| P2 | Crédito fornecedor |
| P2 | Score avançado |
| P3 | Marketplace |
| P3 | Seguros |

A ordenação P0–P3 é uma proposta de implementação para organizar o conceito.

# 26. Painéis

## 26.1 Painel do comerciante
- Saldo
- Vendas
- Despesas
- Lucro estimado
- Poupança
- Xitique
- Crédito
- Alertas
- Documentos

## 26.2 Painel do agente
- Utilizadores
- KYC pendente
- Documentos
- Transacções pendentes
- Sincronização
- Incidentes
- Suporte

## 26.3 Painel administrativo
- Utilizadores
- Agentes
- Transacções
- KYC
- Crédito
- Risco
- Auditoria
- KPIs
- Configuração

## 26.4 Painel de risco
- Exposição
- Pagamentos
- Atrasos
- Alertas
- Concentração
- Fraude
- Casos para revisão

# 27. Modelo de Dados Conceptual

| Entidade | Descrição |
|---|---|
| User | Pessoa/utilizador |
| Business | Negócio do utilizador |
| Agent | Agente do ecossistema |
| KYCProfile | Estado e nível de verificação |
| Document | Documento submetido |
| Wallet | Carteira |
| Pocket | Subdivisão de fundos |
| Transaction | Movimento financeiro |
| SavingsGoal | Meta de poupança |
| XitiqueGroup | Grupo |
| XitiqueMember | Participante |
| XitiqueContribution | Contribuição |
| Supplier | Fornecedor |
| SupplierCredit | Crédito fornecedor |
| Repayment | Pagamento |
| Notification | Notificação |
| AuditEvent | Evento de auditoria |
| Device | Dispositivo |
| SyncEvent | Evento de sincronização |


# 28. Regras de Negócio Fundamentais
- Um utilizador deve ter identidade única.
- Cada transacção deve possuir identificador único.
- Movimentos financeiros não devem ser apagados silenciosamente.
- Correcções devem gerar eventos de auditoria.
- Uma alteração de KYC deve possuir responsável e timestamp.
- Documentos rejeitados devem ter motivo.
- Acções de agente devem ser auditáveis.
- Operações offline devem ser sincronizáveis e idempotentes.
- Crédito não deve ser tratado como direito automático.
- A IA não deve fabricar informação financeira.

# 29. Segurança
- Cifrar dados em trânsito e em repouso.
- Gestão de identidade e acessos por função.
- Autenticação forte para funções administrativas.
- Segregação de funções.
- Auditoria de operações críticas.
- Gestão segura de documentos.
- Backups e recuperação.
- Monitorização de actividade anómala.
- Políticas de retenção e eliminação.
- Protecção contra fraude e tomada de conta.

# 30. Privacidade e Governação de Dados
O sistema trata informação potencialmente sensível, incluindo identidade, documentos e comportamento financeiro. A implementação deve adoptar privacy-by-design.
- Recolher apenas o necessário.
- Definir finalidade de cada dado.
- Controlar acesso.
- Registar utilização relevante.
- Definir retenção.
- Permitir correcção conforme regras aplicáveis.
- Evitar reutilização incompatível.
- Separar dados operacionais de dados analíticos quando apropriado.

# 31. IA — Papel no Ukuphila

## 31.1 Casos de uso
- Assistente de negócio.
- Reconhecimento de intenção em voz.
- Conversão de linguagem natural em registo proposto.
- Perguntas sobre histórico do próprio utilizador.
- Explicação de indicadores.
- Suporte a agentes.
- Classificação de pedidos.
- Detecção de inconsistências para revisão.
- Educação financeira contextual.

## 31.2 Princípio de autoridade
A IA deve ser tratada como camada de interpretação e assistência, não como fonte autónoma da verdade. A fonte de verdade para saldo, KYC, documentos e contratos deve ser o sistema transaccional correspondente.

# 32. Knowledge Base para a IA
A IA deve receber informação organizada por domínios. Recomenda-se armazenar esta documentação como base de conhecimento versionada.

| Domínio | Conteúdo |
|---|---|
| PRODUCT | Funcionalidades e jornada |
| KYC | Níveis, requisitos e estados |
| DOCUMENTS | Tipos, submissão e revisão |
| FINANCE | Carteiras, bolsos, transacções |
| XITIQUE | Regras e operações |
| CREDIT | Produtos, estados e políticas |
| AGENTS | Procedimentos do agente |
| SUPPORT | FAQs e resolução de problemas |
| SECURITY | Regras de segurança |
| PRIVACY | Dados e permissões |
| AI_POLICY | Limites da IA |
| TECH | Arquitectura e offline |
| OPERATIONS | SOPs |
| COMPLIANCE | Requisitos validados |
| GLOSSARY | Vocabulário |


# 33. Regras de Resposta da IA
- Responder apenas com informação disponível e autorizada.
- Se não souber, dizer que não possui informação suficiente.
- Não inventar taxas, limites, prazos ou aprovações.
- Distinguir saldo disponível de saldo contabilístico quando aplicável.
- Confirmar identidade/autorização antes de revelar dados.
- Não revelar documentos ou dados de terceiros.
- Encaminhar casos regulatórios, fraude ou disputas para humanos.
- Pedir confirmação antes de executar operações críticas.
- Usar linguagem simples.
- Quando houver conflito entre fontes, usar a versão mais recente aprovada e sinalizar o conflito.

# 34. Intents da IA

| Intent | Exemplo | Acção |
|---|---|---|
| CHECK_BALANCE | Quanto tenho? | Consultar fonte transaccional |
| RECORD_SALE | Vendi 500. | Criar proposta de movimento |
| RECORD_EXPENSE | Gastei 100. | Criar proposta de movimento |
| DAILY_SUMMARY | Como foi hoje? | Gerar resumo |
| DOCUMENT_STATUS | Meu documento foi aprovado? | Consultar estado |
| KYC_HELP | O que falta? | Explicar requisitos autorizados |
| XITIQUE_STATUS | Quanto falta para o Xitique? | Consultar grupo |
| SAVINGS_STATUS | Quanto já poupei? | Consultar poupança |
| CREDIT_INFO | Como funciona o crédito? | Explicar produto |
| HUMAN_SUPPORT | Quero falar com alguém. | Escalar |


# 35. Base de FAQs

## O que é o Ukuphila?
É um acompanhante de negócio criado para ajudar comerciantes informais a organizar o negócio e construir uma relação financeira gradual.

## Preciso de crédito para começar?
Não. A proposta é começar pela gestão do negócio, poupança e construção de historial.

## O que é o Xitique digital?
É a digitalização do registo e funcionamento de um grupo de poupança comunitária.

## Por que existe um agente?
Porque a confiança e a assistência humana são parte intencional do modelo.

## Funciona sem internet?
O conceito prevê funcionamento offline com sincronização posterior, embora algumas operações possam exigir conectividade dependendo da implementação.

## A IA pode aprovar o meu crédito?
A IA não deve prometer ou assumir aprovação. Critérios e autoridade de crédito dependem da política formal do produto.

# 36. SOP — Onboarding do Comerciante
- Apresentar proposta de valor.
- Confirmar consentimento e iniciar registo.
- Criar perfil.
- Executar KYC aplicável.
- Registar negócio.
- Configurar bolsos.
- Ensinar primeira transacção.
- Confirmar que utilizador sabe consultar saldo/histórico.
- Explicar suporte.
- Concluir onboarding.

# 37. SOP — Documento Rejeitado
- Sistema marca documento como rejeitado.
- Motivo é registado.
- Utilizador é notificado.
- Agente explica a correcção.
- Novo documento é submetido.
- Nova revisão é criada.
- Histórico anterior permanece auditável.

# 38. SOP — Operação Offline
- Detectar indisponibilidade.
- Permitir apenas operações autorizadas offline.
- Guardar operação localmente.
- Mostrar estado pendente.
- Sincronizar automaticamente quando possível.
- Validar no servidor.
- Resolver conflito se existir.
- Actualizar estado ao utilizador.

# 39. Métricas do Piloto

| Categoria | KPIs sugeridos |
|---|---|
| Aquisição | Novos utilizadores, custo por aquisição |
| Activação | % que registam primeira transacção |
| Uso | Transacções/utilizador, frequência |
| Retenção | Utilizadores activos semana/mês |
| Gestão | % que separam bolsos |
| Poupança | Taxa de utilização |
| Xitique | Grupos activos e contribuições |
| Crédito | Aplicações, aprovação, pagamento |
| Risco | Atrasos, fraude, perdas |
| Operação | Tempo de KYC, incidentes |
| Tecnologia | Falhas de sync, disponibilidade |
| Satisfação | NPS/feedback/entrevistas |


# 40. Plano de Piloto
O piloto deve começar num único mercado de Maputo, com número controlado de utilizadores. O objectivo é aprendizagem, não aparência de escala.

## Perguntas que o piloto deve responder
- Os comerciantes registam vendas regularmente?
- A separação negócio/casa é compreendida?
- A voz funciona em condições reais?
- O WhatsApp é realmente usado?
- O agente reduz abandono?
- O modo offline é suficiente?
- O Xitique digital resolve problemas reais?
- Existe procura por crédito fornecedor?
- O historial produzido é útil para gestão e risco?
- A economia do modelo é sustentável?

# 41. Roadmap

| Fase | Direcção |
|---|---|
| Piloto | Validar utilizador, produto e operação |
| Expansão Maputo | Replicar após evidência |
| Outros mercados | Expandir quando houver confiança no modelo |
| Ano 3 — orientação | Possível transição para microbanco, dependente de factores regulatórios |
| Longo prazo | Instituição de microfinança com licença própria, se o caminho for bem-sucedido |

A transição para uma instituição licenciada é uma visão estratégica, não uma garantia.

# 42. Riscos

| Risco | Mitigação conceptual |
|---|---|
| Baixa adopção | Agente + onboarding + produto simples |
| Fraude | KYC, auditoria, monitorização |
| Má qualidade de dados | Validação e confirmação |
| Falhas offline | Idempotência + sync robusto |
| Desconfiança | Presença física + transparência |
| Incumprimento | Crédito progressivo + historial |
| Dependência de parceiros | Arquitectura de integração |
| Risco regulatório | Validação antes de cada produto |
| Complexidade | MVP focado |
| Escala prematura | Piloto controlado |


# 43. Glossário

| Termo | Definição |
|---|---|
| Ukuphila | Nome do projecto; tagline: Crescer. Conectar. Prosperar. |
| KYC | Know Your Customer; processo de identificação/verificação. |
| Xitique | Prática comunitária de poupança rotativa/colectiva. |
| MFI | Microfinance Institution / instituição de microfinança. |
| MVP | Minimum Viable Product. |
| Offline-first | Arquitectura desenhada para funcionar com conectividade intermitente. |
| Agente | Pessoa que representa/apoia o serviço no mercado. |
| Bolso | Subdivisão conceptual de fundos, como negócio ou casa. |
| Crédito fornecedor | Financiamento ligado à compra de stock com pagamento posterior. |
| Historial | Registo acumulado do comportamento financeiro/operacional. |
| Score | Métrica de avaliação de risco; não definida numericamente no conceito original. |


# 44. Perguntas em Aberto
- Qual entidade jurídica operará o serviço?
- Qual parceiro/licença financeira será utilizado no piloto?
- Quais documentos KYC serão obrigatórios por nível?
- Quais são os limites transaccionais?
- Qual será o fornecedor de pagamentos?
- Como será o modelo exacto de leasing?
- Qual será o preço ao comerciante?
- Quais fornecedores participarão no crédito fornecedor?
- Quais serão as taxas e prazos de crédito?
- Qual será o mecanismo de cobrança?
- Quais dados podem ser usados para scoring?
- Quais línguas locais serão suportadas primeiro?
- Qual stack tecnológica será usada?
- Qual infraestrutura cloud?
- Qual política de retenção de documentos?
- Qual política de recuperação de desastre?
- Quais são os requisitos regulatórios aplicáveis?

# 45. Estrutura Recomendada para a Base de Conhecimento da IA
Para implementação de RAG/knowledge retrieval, este documento deve ser dividido em documentos menores e versionados.

| ID | Documento |
|---|---|
| UKP-001 | Visão Geral |
| UKP-002 | Problema e Contexto |
| UKP-003 | Produto |
| UKP-004 | Registo e Onboarding |
| UKP-005 | KYC |
| UKP-006 | Documentos |
| UKP-007 | Gestão de Caixa |
| UKP-008 | Carteira e Bolsos |
| UKP-009 | Poupança |
| UKP-010 | Xitique |
| UKP-011 | Crédito |
| UKP-012 | Agentes |
| UKP-013 | WhatsApp |
| UKP-014 | Offline |
| UKP-015 | Arquitectura |
| UKP-016 | Segurança |
| UKP-017 | Privacidade |
| UKP-018 | IA e Guardrails |
| UKP-019 | SOPs |
| UKP-020 | FAQs |
| UKP-021 | Métricas |
| UKP-022 | Roadmap |
| UKP-023 | Riscos |
| UKP-024 | Glossário |
| UKP-025 | Políticas e Compliance — a preencher após validação |


# 46. Metadados Recomendados para Cada Chunk RAG

| Campo | Exemplo |
|---|---|
| document_id | UKP-006 |
| title | Documentos |
| section | Submissão |
| version | 1.0 |
| status | approved/draft |
| source | Project Knowledge Base |
| authority | Product/Compliance/Operations |
| effective_date | YYYY-MM-DD |
| review_date | YYYY-MM-DD |
| language | pt-MZ |
| sensitivity | internal/confidential |
| entities | KYC, Document, User |
| keywords | BI, documento, submissão, revisão |


# 47. Hierarquia de Verdade
- Sistema transaccional — fonte de verdade para saldos e movimentos.
- Sistema KYC/documental — fonte de verdade para estados de verificação.
- Contratos/políticas aprovadas — fonte de verdade para produtos financeiros.
- Knowledge Base aprovada — fonte de verdade para comportamento e explicação da IA.
- Modelos de IA — camada de interpretação, nunca substituto automático das fontes acima.

# 48. Critério de Prontidão
- Produto definido.
- Fluxos de utilizador testados.
- KYC validado.
- Gestão documental validada.
- Modelo financeiro validado.
- Segurança revista.
- Privacidade revista.
- Operações documentadas.
- Agentes treinados.
- Modo offline testado.
- IA com guardrails.
- Métricas definidas.
- Piloto com critérios de sucesso e falha.
- Plano de incidentes.
- Plano de suporte.

# 49. Declaração Final do Projecto
O Ukuphila pretende construir uma ponte entre a capacidade empresarial que já existe no comércio informal e o sistema financeiro formal que muitas vezes não foi desenhado para a realidade desses comerciantes. A estratégia é começar por aquilo que o comerciante precisa hoje: ver o negócio com clareza, organizar o dinheiro, poupar e construir confiança. O crédito vem depois.
O projecto assume conscientemente que ainda existem hipóteses por validar. Por isso, o piloto deve ser pequeno, controlado e orientado por evidência. O objectivo não é provar que a tecnologia funciona; é provar que o modelo funciona para pessoas reais, num mercado real, sob condições reais.
Ukuphila — Crescer. Conectar. Prosperar.

# 50. Fonte e Limites deste Documento
A base conceptual original fornecida para este trabalho descreve o contexto de Maputo, o problema de inclusão financeira, a solução Ukuphila, funcionalidades, KYC, crédito, modelo de negócio, roadmap, tecnologia e hipótese de mercado.
Este documento amplia essa base com uma estrutura de knowledge base e propostas de especificação para registo, documentos, dados, IA, operações, arquitectura e governação. Essas ampliações são propostas de desenho e não devem ser tratadas como factos já aprovados do projecto.
Documento preparado como base de trabalho. Antes de produção, deve ser complementado por documentação jurídica/regulatória, contratos, políticas de privacidade, requisitos de segurança, especificações técnicas, política de crédito, modelo económico e procedimentos operacionais aprovados.
