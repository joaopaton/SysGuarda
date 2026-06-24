# Deploy do SysGuarda numa VPS (Ubuntu)

Guia para subir em produção: **PostgreSQL na própria VPS**, backend Express
servindo o frontend (mesma origem), **login básico**, PM2 e Nginx + HTTPS.

> Arquitetura em produção: um único serviço Node (porta 3333) serve a API **e**
> o frontend já compilado. O Nginx fica na frente (80/443) com SSL.

---

## 0. Pré-requisitos na VPS

```bash
# Node 20+ (via nvm ou nodesource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL + Nginx
sudo apt-get install -y postgresql nginx

# PM2 global
sudo npm install -g pm2
```

## 1. Banco de dados (PostgreSQL na VPS)

```bash
sudo -u postgres psql <<'SQL'
CREATE USER sysguarda WITH PASSWORD 'senha_forte_aqui';
CREATE DATABASE sysguarda OWNER sysguarda;
SQL
```

## 2. Código

```bash
cd /var/www
git clone <SEU_REPO> sysguarda
cd sysguarda
```

## 3. Backend

```bash
cd /var/www/sysguarda/server
cp .env.example .env
nano .env     # ver seção "Variáveis" abaixo
npm install

# Cria o schema Postgres e aplica no banco (gera schema.production.prisma)
npm run prod:db

# Popula efetivo + instrutores e atualiza o roster
npm run prod:seed

# Compila o TypeScript -> dist/
npm run build
```

### Variáveis (`server/.env`)

```dotenv
DATABASE_URL="postgresql://sysguarda:senha_forte_aqui@localhost:5432/sysguarda?schema=public"
PORT=3333
NODE_ENV=production
APP_USER=admin
APP_PASSWORD=uma_senha_bem_forte      # protege todo o app (Basic Auth)
CLIENT_DIST=/var/www/sysguarda/client/dist
```

## 4. Frontend

```bash
cd /var/www/sysguarda/client
npm install
npm run build      # gera client/dist (servido pelo backend)
```

## 5. Subir com PM2

```bash
cd /var/www/sysguarda/server
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # siga a instrução impressa p/ iniciar no boot
```

Teste local na VPS: `curl -u admin:senha http://127.0.0.1:3333/api/health`

## 6. Nginx + HTTPS

```bash
sudo cp /var/www/sysguarda/deploy/nginx.conf.example /etc/nginx/sites-available/sysguarda
sudo nano /etc/nginx/sites-available/sysguarda     # ajuste server_name
sudo ln -s /etc/nginx/sites-available/sysguarda /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS grátis (precisa de domínio apontando para a VPS)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO.com.br
```

Pronto: acesse `https://SEU_DOMINIO.com.br` — o navegador pedirá usuário/senha.

---

## Atualizações futuras

```bash
cd /var/www/sysguarda
git pull
cd server && npm install && npm run prod:db && npm run build
cd ../client && npm install && npm run build
pm2 restart sysguarda
```

## Notas

- **Login**: é HTTP Basic Auth (prompt do navegador). Simples e suficiente para
  uso interno. Para algo mais elaborado (tela de login, vários usuários), dá para
  evoluir depois.
- **Backup**: `pg_dump sysguarda > backup.sql` periodicamente.
- **Dev local** continua em SQLite (sem mudar nada): `npm run dev` em `server/`
  e `client/`. O schema de produção é derivado automaticamente do `schema.prisma`
  pelo `npm run prod:schema`.
