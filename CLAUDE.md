# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

SysGuarda gera, edita, balanceia e exporta a escala semanal de guardas de um Tiro de Guerra (TG 05-003), além de controlar efetivo, presença na instrução, horas de serviço, missões (horas complementares) e uma trilha de auditoria. Monorepo com dois pacotes independentes: `server/` (API Express 5 + Prisma) e `client/` (SPA React 19 + Vite). A lógica de geração e balanceamento roda **no servidor**; efetivo, escalas e histórico são persistidos no banco.

A escala cobre **7 dias começando na terça** (`domain.ts`: `dayIndex` 0 = terça). As funções e nº de vagas são fixos em `server/src/domain.ts` (`FUNCOES`, `VAGAS`) — esse arquivo é a fonte da verdade compartilhada e o client espelha esses valores em `client/src/lib/types.ts`.

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
- `Schedule` + `Assignment` — uma escala (de uma `turmaId`) e suas vagas (`dayIndex`, `funcao`, `slot`). `Schedule.status` = `ABERTA` | `FECHADA` (+ `closedAt`): ao fechar, as horas entram no relatório e a escala vira somente-leitura (PUT bloqueado com 409 até reabrir). Assignment guarda *snapshot* `personNum`/`personNome` e vínculo opcional a `Person` (`---`/`VAZIO` para vaga vazia). Cada vaga pode registrar `falta` (a pessoa faltou àquela guarda — **não conta horas**) e `obs` (observação livre), salvos na escala e editados pelo `VagaEditor` no client.
- `ManualHistory` — histórico (contagem de guardas) importado à mão p/ balancear o sorteio. `ManualHours` — saldo inicial de **horas** (FICHA) por pessoa e mês (1..12), somado às horas das escalas FECHADAS no relatório.
- **Horas de serviço** (`HORAS` em `domain.ts`): permanência manhã/tarde = 6h, `Cmt Gd TG` e `Guardas do TG` (noite) = 12h. O relatório (`routes/hours.ts`) agrega por pessoa→turma e por mês (derivado de `startDate + dayIndex`). Importar FICHA (`/importar-ficha`) é **escopado por turma**: Comandante substitui tudo; instrutor/monitor substituem só o saldo das pessoas da própria turma (rows de outras turmas são ignoradas).
- `Attendance` — **presença na instrução** (`routes/attendance.ts`). Um registro por `(date, personNum+personNome, turmaId)` com `status` ∈ `PRESENTE | FALTA | JUSTIFICADO`. `POST /api/attendance` faz *replace* dos registros daquele dia+turma; pessoa sem registro conta como `PRESENTE`. `GET /api/attendance/historico` consolida P/F/J por pessoa num período (`from`/`to`). Escopado por turma como o resto.
- `Mission` + `MissaoConfig` — **horas complementares** (missões), `routes/missions.ts`. `MissaoConfig` é singleton (`id="singleton"`, `metaHoras`, default 60); só o Comandante edita a meta. Cada `Mission` é um lançamento (`personNum`/`personNome`, `date?`, `descricao`, `horas`, `turmaId`). O relatório soma as horas por pessoa e marca quem está **abaixo** da meta. Importação em lote via CSV (`num;nome;data;descricao;horas`), escopada por turma.
- `User` — login (senha com hash scrypt, `server/src/password.ts`). `role` = `superadmin` (Comandante) | `instrutor` (Sgt) | `monitor` (mesmo acesso do instrutor, escopo da turma — só muda o rótulo); `turmaId` vincula à turma. `normalizarPapel` (em `auth.ts`) é a fonte única de validação do papel. `Instructor` (sobreaviso) e `AditamentoConfig` (linha única `id="singleton"`) servem ao Aditamento.
- `AuditLog` — **trilha de auditoria**. O middleware global `auditoriaMiddleware` (`server/src/audit.ts`, montado após `requireAuth`) registra **toda escrita bem-sucedida** (POST/PUT/PATCH/DELETE com status < 400) via hook em `res.on("finish")`, sem tocar nas rotas: snapshot do usuário (sem FK), rótulo amigável por rota e `detalhe` só com campos seguros do corpo (**nunca senha/CSV bruto**). `GET /api/audit` (paginado por `limit`/`offset`, devolve `{ logs, total, retencaoDias }`): Comandante vê tudo; instrutor/monitor só os registros da própria turma. **Retenção automática** (`AUDIT_RETENTION_DIAS`, padrão 90 dias; poda best-effort no máx. 1x/hora).

## Algoritmo de geração (`server/src/generate.ts`)

Sorteio aleatório **ponderado por histórico**: quanto mais guardas alguém já fez (`historico` do banco + `contagem` da escala atual), menor o peso (`peso = 1/(1+hist+atual*2)`). Regras embutidas: monitor só preenche `Cmt Gd TG` (distribuído por fila ordenada por histórico) e nunca repete função; ninguém repete no mesmo dia (`usadosNoDia`). Sem candidato, a vaga vira `VAZIO`. O histórico de balanceamento vem das últimas N escalas salvas (`historicoDoBanco` em `routes/schedule.ts`), reconciliado por nome com o efetivo atual.

## Autenticação e autorização (`server/src/auth.ts`, `server/src/scope.ts`)

Sessão **stateless por cookie** (`sg_session`): token = payload `{ uid, exp }` + HMAC-SHA256 assinado com `APP_SECRET` (ou `APP_PASSWORD`). Login fica ativo quando `NODE_ENV=production` **ou** `APP_PASSWORD` definido; em dev (sem essas vars) tudo abre e `req.user` vira um **superadmin sintético** (`DEV_SUPER`). `requireAuth` resolve o usuário do banco e popula `req.user` (`role`, `turmaId`); `requireSuperadmin` barra não-comandantes.

**Escopo por papel/turma** (`scope.ts`): superadmin vê/edita tudo; instrutor é restrito à própria turma. Helpers: `filtroTurma` (where de consulta), `podeTurma` (checagem de acesso a um registro), `turmaAlvo` (força a turma do instrutor em escritas). Regras aplicadas: `users` e `history` (import) → só superadmin; `people`/`schedule`/`attendance`/`missions`/`hours`/`audit` → filtrados/escopados por turma (superadmin vê tudo); geração escolhe a turma (superadmin) ou usa a do instrutor, com **rodízio** (`proximaTurma`) quando o superadmin não especifica. Validação de entrada via `str`/`bool`/`intIn` em `scope.ts`.

## Arquitetura HTTP

- Rotas em `server/src/routes/`: `turmas`, `dashboard`, `hours`, `people`, `schedule`, `history`, `aditamento`, `users`, `attendance` (presença), `missions` (horas complementares) — montadas sob `/api/*` em `server/src/index.ts`. A trilha de auditoria fica em `server/src/audit.ts` (`auditoriaMiddleware` global + `auditRouter` em `/api/audit`). `/api/users` é montada atrás de `requireSuperadmin`. `GET /api/dashboard` (superadmin) devolve o resumo por turma (efetivo/ausentes/monitores/escalas/última + próxima turma do rodízio) para o **Painel do Comando**. `POST /api/people/atribuir-turma` (superadmin) move várias pessoas de turma de uma vez (seleção em massa na aba EFETIVO); `POST /api/people/importar-turmas` (superadmin) atribui turmas por CSV (`num;nome;turma`; turma por código `T1`, apelido `Caveira` ou número `1`; casa por `num+nome` ou só nome).
- `/api/me` retorna `{ authenticated, user: { username, role, turma } }`; o client usa isso (via `AuthGate`) para decidir o que mostrar.
- Em produção o **mesmo processo Node** serve a API e o frontend buildado (`CLIENT_DIST`, fallback SPA para `index.html`). Em dev o Vite faz proxy de `/api`.
- **Estrutura do client** (modular, redesenhada com sidebar): `lib/` = infra compartilhada (`api.ts` centraliza o fetch com `credentials:"include"`; `types.ts` espelha `domain.ts` e expõe `COR_FUNC`/`CORES_TURMA`/`corTurma`; `export.ts`, `dates.ts`, `constants.ts`). `state/` = contextos (`NavContext` controla a seção atual + `turmaFoco`; `AppDataContext` carrega efetivo/turmas; `EscalaContext` é a escala em edição; `ThemeContext` dia/noite). `features/<área>/` = uma pasta por tela (`painel`, `escala`, `salvas`, `calendario`, `presenca`, `horas`, `efetivo`, `usuarios`, `comando`). `components/ui/` = design system (`Card`, `Button`, `Badge`, `Stat`, `SectionHeader`, `BarChart`, …); `components/layout/` = `AppShell`/`Sidebar`/`Topbar`/`FiltroTurma`. `AuthGate.tsx` + `Login.tsx` controlam o acesso.
- O Aditamento (documento oficial em PDF/impressão) é montado 100% no client: `client/src/aditamento.ts` (`buildAditamentoHTML`) + `components/AditamentoModal.tsx`. Pode ser gerado a partir da escala em memória **ou** importando um CSV de escala via `client/src/parseEscalaCsv.ts` (parser tolerante que faz o round-trip do CSV exportado por `export.ts`: grade função×dia, célula `NUM NOME`, rótulo da função herdado nas linhas de vaga seguintes).
- **Mobile-first**: a UI usa breakpoints `sm:`/`md:` do Tailwind; o padrão (sem prefixo) é o layout de celular. A grade da escala (`EscalaTab`) e o calendário rolam horizontalmente no celular (`min-w-[…]`).
- **Navegação/visão por papel** (`Sidebar.tsx` + `App.tsx`): a barra lateral agrupa as seções em VISÃO / OPERAÇÃO / CADASTRO; itens com `super:true` (`painel`, `usuarios`) só aparecem para o Comandante. **Horas de serviço** (guarda) e **Missões** (complementares) são itens **separados** no menu — dados distintos, sem soma entre si. **Auditoria** (em CADASTRO) aparece para todos, mas o servidor escopa por turma (Comandante vê tudo). O superadmin vê o **Painel do Comando** (`PainelTab`: cards por turma + gráficos de efetivo e horas por turma via `BarChart`) e uma barra de **filtro global de turma** (`FiltroTurma`, estado `turmaFoco`, "TODAS"/T1..T4) que filtra EFETIVO e SALVAS no client e define a turma padrão da geração. Instrutor/monitor não veem o filtro (já presos à sua turma). O **Calendário** (`CalendarioTab`) plota as escalas salvas num grid mensal — cada semana de guarda (terça→segunda) vira uma faixa colorida por turma (`corTurma`), clicável para abrir a escala.

## Deploy

VPS Ubuntu com PostgreSQL local, PM2 (`server/ecosystem.config.cjs`) e Nginx + HTTPS (`deploy/nginx.conf.example`). Passo a passo completo em `DEPLOY.md`.
