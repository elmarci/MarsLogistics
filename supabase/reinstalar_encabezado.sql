-- =====================================================================
-- MarsLogistics · INSTALACIÓN COMPLETA (archivo generado, no editar a mano)
-- Generado por scripts/armar-instalacion.sh a partir de supabase/migrations y seed.sql.
--
-- ATENCIÓN: borra TODO el esquema public (tablas y datos de prueba) y lo vuelve a crear.
-- Los usuarios de Authentication y los archivos de Storage se conservan.
-- Uso: pegar completo en Supabase → SQL Editor → Run. Luego, la última línea (comentada)
-- con tu correo para volver a ser administrador.
-- =====================================================================
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
