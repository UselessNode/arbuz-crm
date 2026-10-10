#!/usr/bin/env bash
# Резервная копия данных перед деплоем (защита от случайной потери).
#
# Делает:
#   1) дамп базы данных через pg_dump из контейнера `arbuz-postgres`;
#   2) архив каталогов uploads/ и logs/.
# Результат — в ./backups (не коммитится). Хранятся последние BACKUP_KEEP архивов.
#
# Запускается из корня проекта на сервере (см. .github/workflows/deploy.yml).
# Локально на Windows не предназначен (нужны bash и работающий Docker).
set -euo pipefail

KEEP="${BACKUP_KEEP:-7}"
DIR="${BACKUP_DIR:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DIR"

echo ">>> [backup] Дамп базы данных -> $DIR/db-$STAMP.sql.gz"
docker compose exec -T arbuz-postgres \
  sh -c 'pg_dump --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip > "$DIR/db-$STAMP.sql.gz"

echo ">>> [backup] Архив файлов -> $DIR/files-$STAMP.tar.gz"
tar_paths=()
if [ -d uploads ]; then tar_paths+=("uploads"); fi
if [ -d logs ]; then tar_paths+=("logs"); fi
if [ "${#tar_paths[@]}" -gt 0 ]; then
  tar czf "$DIR/files-$STAMP.tar.gz" "${tar_paths[@]}"
else
  echo ">>> [backup] Каталогов uploads/ и logs/ нет — архив файлов пропущен"
fi

echo ">>> [backup] Ротация (оставляем последние $KEEP)"
ls -1t "$DIR"/db-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f || true
ls -1t "$DIR"/files-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f || true

echo ">>> [backup] Готово: $DIR/db-$STAMP.sql.gz"
