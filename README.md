# SysGuarda — Gerador de Escala de Guardas (T2)

Aplicação full-stack para gerar, editar, balancear e exportar a escala semanal de serviço de um Tiro de Guerra.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express 5 + TypeScript
- **Banco:** PostgreSQL + Prisma ORM

A lógica de geração e balanceamento roda no **servidor**; o efetivo, as escalas e o
histórico de balanceamento são **persistidos no PostgreSQL**.

## Estrutura

```
SysGuarda/
├─ server/        API Express 5 + Prisma
│  ├─ prisma/     schema + seed (efetivo padrão)
│  └─ src/        rotas, algoritmo de geração
└─ client/        SPA React 19 (Vite)
```

## Como rodar

### 1. Banco de dados

Tenha um PostgreSQL rodando e crie o banco `sysguarda`.

### 2. Backend

```bash
cd server
cp .env.example .env          # ajuste DATABASE_URL
npm install
npm run db:push               # cria as tabelas
npm run db:seed               # popula monitores + guardas padrão
npm run dev                   # http://localhost:3333
```

### 3. Frontend

```bash
cd client
npm install
npm run dev                   # http://localhost:5173
```

O Vite faz proxy de `/api` para o backend (ver `client/vite.config.ts`).

## Funcionalidades

- Geração aleatória ponderada da escala (terça → segunda, 7 dias).
- Regras: monitor só comanda; ninguém repete no mesmo dia; monitor não repete no período.
- Balanceamento por histórico (quem fez mais guardas entra menos).
- Edição manual célula a célula (dropdown pesquisável).
- Gestão de efetivo (monitores e guardas) persistida no banco.
- Exportação em **PDF** (paisagem) e **CSV** (`;` + BOM para Excel PT-BR).
- Histórico calculado a partir das escalas salvas no banco.
