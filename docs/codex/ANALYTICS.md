# Web Analytics — 2026-11-05

Integração pedida pelo proprietário após a primeira publicação de produção.

## Alteração

- Instalado `@vercel/analytics` 2.0.1.
- `SiteAnalytics` integrado no layout raiz, mantendo-o como Server Component. O componente de Analytics é um Client Component separado.
- Contagem apenas em produção e nas páginas públicas conhecidas, incluindo entrada e registo. As áreas do comerciante, agente, gestão, risco, fornecedor, APIs e passaportes individuais ficam excluídas.
- `beforeSend` retira query strings e fragmentos dos endereços dos eventos. Não são adicionados eventos personalizados ou dados dos formulários.
- Informação sobre a contagem adicionada à página de privacidade. Mantida a Content Security Policy existente; o script de produção usa o endereço da própria aplicação.
- `@vercel/functions` actualizado no lockfile de 3.10.4 para 3.10.6, dentro do intervalo já permitido, para resolver o alerta transitivo do Zod. As dependências `@vercel/oidc` e `@vercel/cli-config` passam a usar a versão corrigida já instalada do Zod.

## Ficheiros

`package.json`, `package-lock.json`, `src/app/layout.tsx`, `src/app/(site)/privacidade/page.tsx`, `src/components/site/site-analytics.tsx`, `src/lib/analytics.ts`, `tests/analytics.test.ts` e este relatório.

## Fontes

- [Integração oficial para Next.js](https://vercel.com/docs/analytics/quickstart).
- [Filtragem com beforeSend](https://vercel.com/docs/analytics/redacting-sensitive-data).
- [Alerta de segurança do Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

## Publicação

Verificações locais: `npx tsc --noEmit --incremental false` sem erros; `npm test` com **178 testes aprovados em 16 ficheiros**; build de produção em `.next-verify` aprovado após a actualização; `npm audit --omit=dev` com **zero vulnerabilidades de produção**. Não foram aplicadas actualizações forçadas às ferramentas de desenvolvimento.

O Analytics está activado no painel do projecto. A integração é publicada pelo deploy automático do ramo `main` em https://ukuphila.vercel.app. As visitas podem ser acompanhadas em https://vercel.com/stephan-yurans-projects/ukuphila/analytics.

O proprietário autorizou explicitamente commit e push para `main` com esta integração, a correcção compatível da dependência e a documentação, como excepção à regra de colaboração em `AGENTS.md`. A primeira publicação, anterior ao Analytics, está documentada em `docs/codex/DEPLOYMENT.md`. Captura inicial do painel em `.qa/analytics-aguarda-publicacao.png`.

Não foram incluídos valores de variáveis de ambiente, palavras-passe ou ficheiros de acesso. `.env.local` e `.qa/` continuam ignorados pelo Git.
