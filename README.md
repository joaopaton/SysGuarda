# SysGuarda — Gestão de Guardas do TG 05-003

Aplicação full-stack para gerar, editar, balancear e exportar a escala semanal de
serviço de um Tiro de Guerra, além de controlar efetivo por turma, presença,
horas de serviço, missões e auditoria.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express 5 + TypeScript
- **Banco:** Prisma ORM — **SQLite em dev**, **PostgreSQL em produção** (schema
  de produção derivado automaticamente; ver `DEPLOY.md`).

A lógica de geração e balanceamento roda no **servidor**; efetivo, escalas,
presença, horas e auditoria são **persistidos no banco**.

## Estrutura

```
SysGuarda/
├─ server/        API Express 5 + Prisma
│  ├─ prisma/     schema + seed (efetivo padrão)
│  └─ src/        rotas, algoritmo de geração
└─ client/        SPA React 19 (Vite)
```

## Como rodar (dev)

Não precisa de PostgreSQL local — em dev o banco é **SQLite** (arquivo
`server/prisma/dev.db`), criado pelo `db:push`.

### 1. Backend

```bash
cd server
cp .env.example .env          # já vem com DATABASE_URL="file:./dev.db"
npm install
npm run db:push               # cria as tabelas (SQLite)
npm run db:seed               # turmas + efetivo + contas padrão
npm run dev                   # http://localhost:3333
```

Em dev (sem `APP_PASSWORD`/`NODE_ENV=production`) o login fica desligado e o
usuário vira um **superadmin sintético** — tudo aberto.

### 2. Frontend

```bash
cd client
npm install
npm run dev                   # http://localhost:5173
```

O Vite faz proxy de `/api` para o backend (ver `client/vite.config.ts`).

## Funcionalidades

- **Turmas e papéis**: T1–T4 em rodízio; Comandante (vê tudo), instrutor e
  monitor (restritos à própria turma).
- **Escala**: geração aleatória ponderada por histórico (terça → segunda, 7
  dias); monitor só comanda; ninguém repete no dia; edição célula a célula;
  **falta** e **observação** por vaga; fechar/reabrir guarda.
- **Painel do Comando**: resumo por turma (efetivo, ausentes, escalas) e gráficos.
- **Presença** na instrução (P/F/J) + **histórico** consolidado por militar.
- **Horas de serviço** (guardas fechadas + FICHA importada) e **Missões** (horas
  complementares com meta) — relatórios por turma/mês.
- **Aditamento** oficial em PDF (a partir da escala ou de um CSV importado).
- **Auditoria**: trilha de todas as ações de escrita.
- **Exportação** em PDF e CSV (`;` + BOM para Excel PT-BR) em várias telas.

## Produção / deploy

VPS Ubuntu com PostgreSQL, PM2 e Nginx + HTTPS. Passo a passo em `DEPLOY.md`.
Guia de arquitetura para contribuir: `CLAUDE.md`.
