# Integração do MVP — 2026-11-03

Continuação do trabalho CX1/CX2/CX3 e da aplicação do comerciante, com alterações pedidas directamente pelo proprietário nesta conversa. O proprietário pediu a remoção da linguagem de apresentação e percursos operacionais completos; confirmou também a criação da conta de gestão `gestao`, sem email e sem guardar a palavra-passe num ficheiro.

## Alterações desta ronda

- Removido o aviso assinalado em `/seguranca`, as faixas e ligações de apresentação. Os botões principais levam a `/registar`; `/demo` encaminha para `/entrar`. O modo de dados de desenvolvimento fica desligado no modelo de configuração e não funciona em produção.
- A gestão pode atribuir um comerciante registado no site a um agente activo do mesmo mercado e gerar o código de entrada. Atribuição e transferência deixam auditoria; o agente anterior perde acesso à carteira transferida.
- A activação verifica a carteira no domínio, recusa contas suspensas, limita tentativas e consome o código atomicamente. A entrada aceita telefone/PIN ou email/utilizador. A primeira entrada da equipa em produção permite configurar MFA e só a activa depois de confirmar o código, com desafio cifrado ligado à conta, à palavra-passe e ao prazo.
- As acções de risco usam o serviço de casos: bloqueios transaccionais, ausência de investigações duplicadas, notas apenas em casos abertos, conclusões preservadas e fecho conjunto dos alertas associados. Os indicadores somam alertas abertos e em revisão.
- Políticas de crédito validadas no servidor. As condições aceites são mantidas na classificação dos atrasos mesmo depois de mudar a política. Uma referência repetida só é idempotente para o mesmo contrato e valor. Agentes só registam recebimentos da própria carteira. A pontualidade usa o mesmo corte temporal no numerador e denominador.
- O Xitique apresenta a autorização de confirmação calculada pelo domínio, incluindo a segunda pessoa quando o único tesoureiro é destinatário. A ordem combinada é editável antes de começar. O recebimento exige todas as contribuições confirmadas. O tesoureiro pode registar a entrega a um participante sem telefone, com nota no histórico; essa entrega não é lançada como recebimento na conta pessoal do tesoureiro.
- Criada `/api/whatsapp`: verificação do canal, assinatura HMAC, validação dos eventos e isolamento do número configurado. A resposta é guardada junto da operação antes do envio; uma repetição depois de falha de envio reutiliza a resposta guardada. A gestão mostra a configuração do canal em vez do simulador. O protocolo segue os [exemplos oficiais da Meta](https://github.com/fbsamples/whatsapp-api-examples/tree/main/signature-validation-with-webhooks-payloads).
- Criada `/api/cron/daily`, protegida por `CRON_SECRET`, para crédito vencido, Xitique e regras de risco; corresponde à rota já agendada em `vercel.json`.
- Criado `scripts/e2e.mts`, que verifica o servidor existente sem gerar comerciantes ou movimentos financeiros. Credenciais opcionais permitem navegar nas áreas autenticadas. O comando de criação de gestão recusa substituir credenciais de uma conta já existente.

## Verificações reais

- `npx tsc --noEmit --incremental false`: sem diagnósticos.
- `npm test`: **166 testes aprovados, 15 ficheiros, sem falhas esperadas ou pendentes**. As bases são PGlite em memória. O paralelismo foi limitado a dois workers depois de um timeout na preparação de uma base; a execução final passou integralmente.
- `npm run build`, com `UKUPHILA_BUILD_DIR=.next-verify`: **aprovado**, incluindo TypeScript e geração das rotas. O servidor da porta 3200 manteve-se disponível. A pasta de verificação está ignorada pelo Git.
- Navegador: **92 verificações sem sessão aprovadas**, incluindo páginas públicas, entrada, registo, remoção dos textos assinalados, redireccionamentos e recusa das APIs sem sessão.
- Navegador com a conta real `gestao`: **128 verificações aprovadas**, incluindo as anteriores e a navegação autenticada por gestão, agentes, comerciantes, fornecedores, IA e risco. Ecrãs de 390 e 1440 px, sem excesso de largura nas vistas verificadas.
- O formulário de registo devolve os quatro mercados configurados: Xipamanine, Zimpeto, Fajardo e Xiquelene.
- A conta `gestao` foi criada na base configurada com autorização explícita do proprietário. A palavra-passe foi usada em memória para verificar a entrada, sem ficheiro de credenciais e sem a colocar nos argumentos do processo de teste.

## Limites da evidência

- Os testes de WhatsApp substituem apenas o transporte externo. Não foi enviada uma mensagem real a terceiros. A activação do canal requer as credenciais do número da organização.
- Os cenários de comerciantes, agentes, fornecedor, KYC, crédito, Xitique e sincronização estão cobertos nos testes de domínio; as verificações autenticadas de navegador desta ronda usaram a conta de gestão. Não se afirma que todos os formulários de todos os papéis foram exercitados pelo navegador.
- Não houve publicação, commit, push, apagamento de dados ou revisão humana declarada. Mantido o trabalho concorrente existente.

## Interface — 2026-11-05

Alterações pedidas directamente pelo proprietário nesta conversa, posteriores às listas de ficheiros CX1/CX2/CX3:

- Nove cartões na área de voz da página inicial, com Motion, arrasto físico, transições em perspectiva, navegação por função e reprodução que pára ao interagir, sair do ecrã ou colocar a página em segundo plano. A preferência de movimento reduzido elimina o ciclo automático. As propostas públicas levam à entrada na conta.
- O proprietário pediu depois apenas um fundo verde mais subtil: alterada a superfície para um verde sálvia claro e uniforme, preservando cartões, botões e movimento.
- Contacto WhatsApp flutuante minimalista para o número fornecido pelo proprietário, `+258845000392`. O link público é `https://wa.me/258845000392` e acompanha a definição de contacto da organização. Posicionamento acima da navegação móvel do comerciante/agente e espaço no rodapé para evitar sobreposição.
- O círculo público de Xitique tem oito nomes, ligações desenhadas, passagem da vez e etiquetas com entrada e saída suaves. A animação pára fora do ecrã, em segundo plano e com movimento reduzido. O botão de pausa foi retirado a pedido explícito; seleccionar um nome mantém o ciclo automático. Corrigida a hidratação com movimento reduzido usando o mesmo estado inicial no servidor e no cliente.
- Crédito de Yuran Magodine com ícone LinkedIn azul, texto discreto e ligação original. Retirado o bloco azul forte após o pedido de menor contraste.
- O proprietário indicou a guarda de dinheiro como direcção do produto e pediu a remoção da frase contrária. Retiradas essas afirmações das interfaces pública, comerciante, agente, fornecedor, gestão, risco e apresentação. Preservadas explicações factuais de movimentos, saldos e condições; esta alteração de texto não acrescenta um serviço de custódia ou transporte financeiro ao código.
- Imagem editorial gerada e integrada na página dos agentes e na página inicial. Ficheiro e prompt exacto em `docs/codex/AGENT_IMAGE.md`.

Verificações desta continuação: `npx tsc --noEmit --incremental false` sem erros; `npm test` com 166 testes aprovados em 15 ficheiros; compilação de produção isolada aprovada. Navegador: nove cartões, gesto de arrasto, reprodução durante vários ciclos, pausa ao interagir, escrita e movimento reduzido; Xitique com nomes e vez automática a 360/390/1440 px, sem erros de hidratação; crédito do LinkedIn e remoção das frases em cinco páginas a 390/1440 px. A imagem integrada teve verificação adicional nas duas páginas e nas três larguras.

Servidor iniciado a pedido explícito na porta 3200 com `npm run dev:remote`; página inicial respondeu HTTP 200. Sem commit, push ou publicação.

A palavra-passe temporária da sessão anterior deixou de estar disponível em memória. O proprietário pediu expressamente que o novo acesso ficasse guardado num ficheiro. A conta `gestao` recebeu uma nova palavra-passe aleatória, com verificação do hash, registo de auditoria e revogação das sessões anteriores, apenas no schema `ukuphila`. Acesso guardado em `.qa/acesso-gestao-2026-11-05.txt`, excluído do Git, com herança de permissões desactivada e acesso limitado ao utilizador Windows actual. O valor não foi colocado nos argumentos dos processos, nos relatórios nem no terminal. A entrada usando o ficheiro foi aprovada no navegador a 390 px. O ficheiro foi entregue ao proprietário por ligação nesta conversa.
