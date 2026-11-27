#!/usr/bin/env bash
# Arma supabase/instalacion_completa.sql: reinstalación + migraciones + datos iniciales.
set -euo pipefail
cd "$(dirname "$0")/../supabase"
{
  cat reinstalar_encabezado.sql
  for f in migrations/*.sql; do
    printf -- '\n-- ===================== %s =====================\n' "$f"
    cat "$f"
  done
  printf -- '\n-- ===================== seed.sql =====================\n'
  cat seed.sql
  printf -- '\n-- Vuelve a ser administrador (cambia el correo y ejecuta solo esta línea):\n'
  printf -- "-- update perfil set rol = 'admin', activo = true where email = 'tu-correo@ejemplo.com';\n"
} > instalacion_completa.sql
