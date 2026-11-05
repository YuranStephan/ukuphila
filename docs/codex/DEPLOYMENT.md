# Publicação de produção — 2026-11-05

Publicação realizada na interface da Vercel a pedido explícito do proprietário.

- Site: https://ukuphila.vercel.app
- Gestão: https://ukuphila.vercel.app/entrar — separador «Equipa».
- Projecto Vercel: `stephan-yurans-projects/ukuphila`.
- Repositório ligado: `YuranStephan/ukuphila`, ramo de produção `main`.
- Commit publicado: `ffea4cc5086d5fb1980c4a0f861e03e3f89bb900` — «Gestão: mudar a própria palavra-passe em Equipa».
- Deploy: https://vercel.com/stephan-yurans-projects/ukuphila/9MzQhQqsVk2DHxb6ECHjeBiBLwyD
- Estado observado: **Ready / Production**, compilação em 58 segundos.

## Configuração aplicada

Já existia um projecto `ukuphila`, sem publicações e sem ligação Git. Foi reutilizado, ligado ao repositório actual e ajustado do preset «Other» para **Next.js**, mantendo os comandos de compilação, instalação e saída por defeito e a pasta raiz do repositório.

Adicionadas `DATABASE_URL`, `AUTH_SECRET`, `DOCUMENT_KEY`, `CRON_SECRET` e `APP_URL` apenas em **Production**, como variáveis Secret. Os primeiros quatro valores foram copiados de `.env.local`, sem alterações; `APP_URL=https://ukuphila.vercel.app`, igual ao domínio final. Não foi guardada uma cópia adicional das variáveis nem foram mostrados os valores nos registos. Mantidas as variáveis pré-existentes da integração Supabase.

Funções observadas em **ARN1**, conforme `vercel.json`. A Vercel seleccionou **Node.js 26.x** devido ao intervalo `engines.node >=22`; o build terminou com sucesso. Os cinco avisos do build referem a escolha automática da versão Node, uma opção npm da plataforma e duas dependências de ferramentas descontinuadas; não houve erro de compilação.

A tarefa `/api/cron/daily` está **Enabled**, com `0 3 * * *`. A interface da Vercel informa que o horário é UTC e que o plano Hobby tem uma janela flexível de uma hora. A tarefa não foi executada manualmente durante a verificação.

## Verificações reais após a publicação

- Página inicial HTTPS com o título, os cartões, o Xitique e o contacto WhatsApp esperado.
- Página dos agentes e fotografia optimizada visíveis no endereço público.
- Formulário de registo carregou os quatro mercados da base configurada: Fajardo, Xipamanine, Xiquelene e Zimpeto.
- Sem sessão, `/gestao`, `/agente`, `/risco`, `/fornecedor` e `/app` encaminharam para a entrada.
- Entrada com o separador «Equipa» e os campos «Email ou utilizador» e «Palavra-passe» disponíveis.
- Não foram submetidos registos comerciais, pedidos de crédito, pagamentos ou mensagens externas. Não foi activado MFA em nome do proprietário nem afirmada uma entrada autenticada em produção.
- Não foram executadas migrações, seeds ou operações directas na base de dados nesta publicação.

O ficheiro privado de acesso já entregue ao proprietário, `.qa/acesso-gestao-2026-11-05.txt`, foi actualizado com o endereço de produção, preservando a palavra-passe e as permissões Windows. Continua ignorado pelo Git. Captura do site publicado em `.qa/producao-ukuphila.png`.

Nenhuma alteração de código, commit ou push foi necessária para publicar este commit.
