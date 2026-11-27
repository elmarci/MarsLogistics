# MarsLogistics

Sistema de Control Logístico Integral: órdenes de importación, tránsito internacional, aduanas,
puerto y vacíos, almacén, transporte a destino, costos y portal de clientes.

- **App:** Next.js 15 (React, TypeScript, Tailwind), instalable en el celular (PWA). Se despliega en Railway.
- **Datos:** Supabase: PostgreSQL, login, permisos por fila (RLS) y archivos.

## Estructura

| Carpeta | Contenido |
|---|---|
| `supabase/migrations/` | Esquema, seguridad (RLS, auditoría) y bucket de documentos |
| `supabase/seed.sql` | Proveedores, producto y conceptos de costo iniciales |
| `supabase/tests/` | Pruebas de permisos que corren sobre PostgreSQL puro |
| `src/app/(interno)/` | Pantallas del equipo de operaciones |
| `src/app/portal/` | Portal de clientes (solo lectura, solo su información) |

## Roles

| Rol | Puede |
|---|---|
| admin | Todo, incluida la gestión de usuarios |
| operaciones, aduanas, almacen, transporte | Leer y registrar la operación; operaciones y aduanas ven costos |
| finanzas | Leer, registrar, ver costos y mantener tarifas |
| consulta | Solo leer (sin costos) |
| cliente | Portal: solo las órdenes, contenedores, stock, despachos y documentos marcados como visibles de su empresa |

Los permisos los aplica la base de datos (RLS), no solo la app. Ver `supabase/migrations/20261127000002_seguridad.sql`.

## Puesta en marcha

### 1. Supabase
1. Crear un proyecto en Supabase (región São Paulo, la más cercana a Lima).
2. En **SQL Editor**, ejecutar en orden los archivos de `supabase/migrations/` y luego `supabase/seed.sql`.
   (O con la CLI: `supabase link` y `supabase db push`.)
3. **Authentication → Sign In / Providers:** desactivar *Allow new users to sign up*. Solo se entra por invitación.
4. **Authentication → URL Configuration:** *Site URL* = la URL pública de Railway.
5. **Authentication → Email Templates**, cambiar el enlace de estas plantillas:
   - *Invite user*: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite`
   - *Reset password*: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery`
6. Primer administrador: crearlo en **Authentication → Users → Add user** y luego en SQL Editor:
   ```sql
   update perfil set rol = 'admin', activo = true where email = 'tu-correo@empresa.com';
   ```
   Desde ahí, el resto de usuarios se invitan desde la pantalla **Usuarios** de la app.

### 2. Railway
1. Nuevo servicio desde este repositorio de GitHub (Railway detecta Next.js y usa `npm run build` / `npm start`).
2. Variables de entorno (ver `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SITE_URL`.
3. Generar el dominio público y ponerlo también como *Site URL* en Supabase.

### Desarrollo local
```bash
cp .env.example .env.local   # completar con las claves del proyecto Supabase
npm install
npm run dev
```

Pruebas de permisos de la base (necesitan un PostgreSQL vacío):
```bash
DATABASE_URL=postgres://usuario:clave@localhost/base_vacia supabase/tests/run.sh
```
