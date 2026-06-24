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
- `Turma` — T1..T4 (`codigo`, `apelido`, `ordem` = rodízio). Cada semana de guarda é de **uma** turma; o rodízio segue `ordem`.
- `Person` — efetivo. `isMonitor` (monitor comanda o Cmt Gd TG), `turmaId` (**monitores e guardas pertencem a uma turma** — cada turma tem seu próprio grupo), `active` (soft-delete), `available` (false = doente/afastado, sai do sorteio). **A identidade é `(num, nome)`** porque um mesmo `num` pode existir em dois registros — daí `keyOf(p) = num + nome` ser usado em todo lugar. A geração (`efetivoAtivo(turmaId)`) filtra monitores **e** guardas pela turma.
- `Schedule` + `Assignment` — uma escala (de uma `turmaId`) e suas vagas (`dayIndex`, `funcao`, `slot`). Assignment guarda *snapshot* `personNum`/`personNome` e um vínculo opcional a `Person` (`---`/`VAZIO` para vaga vazia).
- `ManualHistory` — histórico importado à mão, somado ao histórico das escalas salvas para balancear o sorteio.
- `User` — login (senha com hash scrypt, `server/src/password.ts`). `role` = `superadmin` (Comandante) | `instrutor` (Sgt) | `monitor` (mesmo acesso do instrutor, escopo da turma — só muda o rótulo); `turmaId` vincula à turma. `normalizarPapel` (em `auth.ts`) é a fonte única de validação do papel. `Instructor` (sobreaviso) e `AditamentoConfig` (linha única `id="singleton"`) servem ao Aditamento.

## Algoritmo de geração (`server/src/generate.ts`)

Sorteio aleatório **ponderado por histórico**: quanto mais guardas alguém já fez (`historico` do banco + `contagem` da escala atual), menor o peso (`peso = 1/(1+hist+atual*2)`). Regras embutidas: monitor só preenche `Cmt Gd TG` (distribuído por fila ordenada por histórico) e nunca repete função; ninguém repete no mesmo dia (`usadosNoDia`). Sem candidato, a vaga vira `VAZIO`. O histórico de balanceamento vem das últimas N escalas salvas (`historicoDoBanco` em `routes/schedule.ts`), reconciliado por nome com o efetivo atual.

## Autenticação e autorização (`server/src/auth.ts`, `server/src/scope.ts`)

Sessão **stateless por cookie** (`sg_session`): token = payload `{ uid, exp }` + HMAC-SHA256 assinado com `APP_SECRET` (ou `APP_PASSWORD`). Login fica ativo quando `NODE_ENV=production` **ou** `APP_PASSWORD` definido; em dev (sem essas vars) tudo abre e `req.user` vira um **superadmin sintético** (`DEV_SUPER`). `requireAuth` resolve o usuário do banco e popula `req.user` (`role`, `turmaId`); `requireSuperadmin` barra não-comandantes.

**Escopo por papel/turma** (`scope.ts`): superadmin vê/edita tudo; instrutor é restrito à própria turma. Helpers: `filtroTurma` (where de consulta), `podeTurma` (checagem de acesso a um registro), `turmaAlvo` (força a turma do instrutor em escritas). Regras aplicadas: `users` e `history` (import) → só superadmin; `people`/`schedule` → guardas e escalas filtrados/escopados por turma; geração escolhe a turma (superadmin) ou usa a do instrutor, com **rodízio** (`proximaTurma`) quando o superadmin não especifica. Validação de entrada via `str`/`bool`/`intIn` em `scope.ts`.

## Arquitetura HTTP

- Rotas em `server/src/routes/`: `turmas`, `people`, `schedule`, `history`, `aditamento`, `users` — montadas sob `/api/*` em `server/src/index.ts`. `/api/users` é montada atrás de `requireSuperadmin`. `POST /api/people/atribuir-turma` (superadmin) move várias pessoas de turma de uma vez (atribuição em massa na aba EFETIVO).
- `/api/me` retorna `{ authenticated, user: { username, role, turma } }`; o client usa isso (via `AuthGate`) para decidir o que mostrar.
- Em produção o **mesmo processo Node** serve a API e o frontend buildado (`CLIENT_DIST`, fallback SPA para `index.html`). Em dev o Vite faz proxy de `/api`.
- Client: `client/src/api.ts` centraliza o fetch (`credentials: "include"`). `App.tsx` é a tela principal com abas (`escala`/`guardas`/`config`/`usuarios`); `AuthGate.tsx` + `Login.tsx` controlam o acesso. Exportação PDF (paisagem) e CSV (`;` + BOM para Excel PT-BR) em `client/src/export.ts`.
- O Aditamento (documento oficial em PDF/impressão) é montado 100% no client: `client/src/aditamento.ts` (`buildAditamentoHTML`) + `components/AditamentoModal.tsx`. Pode ser gerado a partir da escala em memória **ou** importando um CSV de escala via `client/src/parseEscalaCsv.ts` (parser tolerante que faz o round-trip do CSV exportado por `export.ts`: grade função×dia, célula `NUM NOME`, rótulo da função herdado nas linhas de vaga seguintes).
- **Mobile-first**: a UI usa breakpoints `sm:`/`md:` do Tailwind; o padrão (sem prefixo) é o layout de celular. A grade da escala (`EscalaTab`) rola horizontalmente no celular (`min-w-[720px]`).

## Deploy

VPS Ubuntu com PostgreSQL local, PM2 (`server/ecosystem.config.cjs`) e Nginx + HTTPS (`deploy/nginx.conf.example`). Passo a passo completo em `DEPLOY.md`.
