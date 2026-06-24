# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

SysGuarda gera, edita, balanceia e exporta a escala semanal de guardas de um Tiro de Guerra (T2). Monorepo com dois pacotes independentes: `server/` (API Express 5 + Prisma) e `client/` (SPA React 19 + Vite). A lógica de geração e balanceamento roda **no servidor**; efetivo, escalas e histórico são persistidos no banco.

A escala cobre **7 dias começando na terça** (`domain.ts`: `dayIndex` 0 = terça). As funções e nº de vagas são fixos em `server/src/domain.ts` (`FUNCOES`, `VAGAS`) — esse arquivo é a fonte da verdade compartilhada e o client espelha esses valores em `client/src/types.ts`.

## Comandos

### Backend (`cd server`)
```bash
npm run dev        # tsx watch src/index.ts → http://localhost:3333
npm run build      # tsc → dist/
npm start          # node dist/index.js (produção)
npm run db:push    # aplica o schema no banco (SQLite em dev)
npm run db:seed    # popula efetivo + instrutores padrão
npm run db:studio  # Prisma Studio
```

### Frontend (`cd client`)
```bash
npm run dev        # Vite → http://localhost:5173 (proxy /api → :3333)
npm run build      # tsc && vite build → client/dist
```

Não há suíte de testes nem linter configurado. "Verificar" = `npm run build` em cada pacote (typecheck) e rodar `dev` nos dois.

## Banco de dados e schema de produção (importante)

- **Dev local usa SQLite**; `server/prisma/schema.prisma` tem `datasource.provider = "sqlite"`. **Não troque para postgresql nesse arquivo.**
- **Produção usa PostgreSQL.** O schema de produção é *derivado automaticamente* do `schema.prisma` por `npm run prod:schema` (gera `schema.production.prisma` com `provider = "postgresql"`). Os comandos `prod:db` / `prod:seed` operam sobre o schema derivado. Veja `DEPLOY.md`.
- Ao mexer em modelos do Prisma, edite **só** `schema.prisma`; o de produção é regenerado.

Modelos-chave (`server/prisma/schema.prisma`):
- `Person` — efetivo. `isMonitor` (monitor só comanda), `active` (soft-delete do efetivo), `available` (false = doente/afastado, sai do sorteio). **A identidade é `(num, nome)`** porque um mesmo `num` pode existir em dois registros — daí `keyOf(p) = num + nome` ser usado em todo lugar.
- `Schedule` + `Assignment` — uma escala e suas vagas (`dayIndex`, `funcao`, `slot`). Assignment guarda *snapshot* `personNum`/`personNome` e um vínculo opcional a `Person` (`---`/`VAZIO` para vaga vazia).
- `ManualHistory` — histórico importado à mão, somado ao histórico calculado das escalas salvas para balancear o sorteio.
- `User` — login (senha com hash scrypt, `server/src/password.ts`). `Instructor` e `AditamentoConfig` (linha única `id="singleton"`) servem ao Aditamento.

## Algoritmo de geração (`server/src/generate.ts`)

Sorteio aleatório **ponderado por histórico**: quanto mais guardas alguém já fez (`historico` do banco + `contagem` da escala atual), menor o peso (`peso = 1/(1+hist+atual*2)`). Regras embutidas: monitor só preenche `Cmt Gd TG` (distribuído por fila ordenada por histórico) e nunca repete função; ninguém repete no mesmo dia (`usadosNoDia`). Sem candidato, a vaga vira `VAZIO`. O histórico de balanceamento vem das últimas N escalas salvas (`historicoDoBanco` em `routes/schedule.ts`), reconciliado por nome com o efetivo atual.

## Autenticação (`server/src/auth.ts`)

Sessão **stateless por cookie** (`sg_session`): token = payload com `exp` + HMAC-SHA256 assinado com `APP_SECRET` (ou `APP_PASSWORD`). Login fica ativo quando `NODE_ENV=production` **ou** `APP_PASSWORD` definido; em dev (sem essas vars) todas as rotas ficam abertas. Credenciais validadas contra a tabela `User`. `index.ts` deixa `/api/health`, `/api/me`, `/api/login`, `/api/logout` públicas e protege o resto com `requireAuth`.

## Arquitetura HTTP

- Rotas em `server/src/routes/`: `people`, `schedule`, `history`, `aditamento`, `users` — montadas sob `/api/*` em `server/src/index.ts`.
- Em produção o **mesmo processo Node** serve a API e o frontend buildado (`CLIENT_DIST`, fallback SPA para `index.html`). Em dev o Vite faz proxy de `/api`.
- Client: `client/src/api.ts` centraliza o fetch (`credentials: "include"`). `App.tsx` é a tela principal com abas (`escala`/`guardas`/`config`/`usuarios`); `AuthGate.tsx` + `Login.tsx` controlam o acesso. Exportação PDF (paisagem) e CSV (`;` + BOM para Excel PT-BR) em `client/src/export.ts`.

## Deploy

VPS Ubuntu com PostgreSQL local, PM2 (`server/ecosystem.config.cjs`) e Nginx + HTTPS (`deploy/nginx.conf.example`). Passo a passo completo em `DEPLOY.md`.
