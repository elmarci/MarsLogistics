#!/usr/bin/env bash
# Aplica las migraciones sobre una base PostgreSQL vacía y corre las pruebas de permisos.
# Uso: DATABASE_URL=postgres://... supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${DATABASE_URL:?Falta DATABASE_URL}"
psql "$DB" -v ON_ERROR_STOP=1 -q -f tests/stub_supabase.sql
for f in migrations/*.sql; do
  [[ "$f" == *almacenamiento* ]] && continue   # requiere el esquema storage de Supabase
  psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$DB" -v ON_ERROR_STOP=1 -q -f seed.sql
psql "$DB" -v ON_ERROR_STOP=1 -q -t -f tests/rls_test.sql 2>&1 | grep -E "OK:|FALL|ERROR"
