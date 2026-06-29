#!/usr/bin/env bash
#
# Backup do SysGuarda: dump do PostgreSQL (nativo da VPS) + cópia do .env.
# Salva em $BACKUP_DIR com timestamp e rotaciona arquivos > $RETENTION_DAYS dias.
#
# A conexão é lida da DATABASE_URL do server/.env (o "?schema=public" do Prisma
# é removido — pg_dump/libpq não aceita esse parâmetro).
#
# Uso (manual):
#   /var/www/sysguarda/server/scripts/backup-db.sh
#
# Uso (cron, recomendado — diariamente às 3h30, longe do backup do Holetire):
#   30 3 * * * /var/www/sysguarda/server/scripts/backup-db.sh >> /var/log/sysguarda-backup.log 2>&1
#
# Restaurar um dump:
#   pg_restore --clean --if-exists -d "postgresql://sysguarda:SENHA@localhost:5432/sysguarda" arquivo.dump
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sysguarda}"
RETENTION_DAYS="${RETENTION_DAYS:-15}"
ENV_FILE="${ENV_FILE:-/var/www/sysguarda/server/.env}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="$BACKUP_DIR/sysguarda-${TIMESTAMP}.dump"
ENV_BACKUP="$BACKUP_DIR/env-${TIMESTAMP}.bak"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"  # só root acessa — contém secrets

# ──────────────────────────────────────────────────────────────────────────────
# 0) DESCOBRE A CONEXÃO (DATABASE_URL, sem o ?schema=...)
# ──────────────────────────────────────────────────────────────────────────────
DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ] && [ -f "$ENV_FILE" ]; then
  DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"'"'")
fi
DB_URL="${DB_URL%%\?*}"  # remove "?schema=public" e afins

if [ -z "$DB_URL" ]; then
  echo "[$(date '+%F %T')] ERRO: DATABASE_URL não encontrada (env nem $ENV_FILE)" >&2
  exit 1
fi

# ──────────────────────────────────────────────────────────────────────────────
# 1) DUMP DO POSTGRES (formato custom -Fc, ideal p/ pg_restore seletivo)
# ──────────────────────────────────────────────────────────────────────────────
if ! pg_dump -Fc "$DB_URL" > "$DUMP_FILE"; then
  echo "[$(date '+%F %T')] ERRO: pg_dump falhou" >&2
  rm -f "$DUMP_FILE"
  exit 1
fi

if [ ! -s "$DUMP_FILE" ]; then
  echo "[$(date '+%F %T')] ERRO: dump ficou vazio, removendo" >&2
  rm -f "$DUMP_FILE"
  exit 1
fi

chmod 600 "$DUMP_FILE"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)

# ──────────────────────────────────────────────────────────────────────────────
# 2) CÓPIA DO .ENV
# ──────────────────────────────────────────────────────────────────────────────
ENV_STATUS="skip"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_BACKUP"
  chmod 600 "$ENV_BACKUP"
  ENV_STATUS="ok ($(du -h "$ENV_BACKUP" | cut -f1))"
else
  echo "[$(date '+%F %T')] AVISO: .env não encontrado em $ENV_FILE — pulando" >&2
fi

# ──────────────────────────────────────────────────────────────────────────────
# 3) ROTAÇÃO
# ──────────────────────────────────────────────────────────────────────────────
DUMP_DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name 'sysguarda-*.dump' -mtime "+${RETENTION_DAYS}" -delete -print | wc -l)
ENV_DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name 'env-*.bak' -mtime "+${RETENTION_DAYS}" -delete -print | wc -l)

echo "[$(date '+%F %T')] OK dump=$(basename "$DUMP_FILE") ($DUMP_SIZE) env=$ENV_STATUS — rotacionados: dump=$DUMP_DELETED env=$ENV_DELETED"
