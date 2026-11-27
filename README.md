# MarsLogistics

Sistema de Control Logístico Integral. Cada servicio contratado por un cliente es un **expediente**
(EXP260001); de él cuelgan sus **referencias**, una por servicio, cada una con su flujo de etapas:

| Prefijo | Referencia | Sigue |
|---|---|---|
| SEA / AIR | Carga marítima / aérea | Booking, embarque, tránsito, arribo, liberación del BL |
| ADU | Aduana | Documentos, DAM, pago, canal, revisión, levante, retiro, liquidación |
| TRA | Transporte | Cualquier movimiento terrestre: solicitud, programación, ruta, entrega, conformidad |
| ALM | Almacenaje | Ingreso del lote, retiros parciales, agotado, liquidación |

Los códigos son prefijo + año + correlativo (SEA260001, ADU260001…). Cada referencia tiene responsable,
documentos con validación, tareas, bitácora con @menciones, solicitudes de pago (las aprueba Finanzas),
costeo proyectado contra real y alertas. Finanzas registra comprobantes emitidos y recibidos (facturas,
boletas, notas de crédito y débito, recibos por honorarios, DAM) con IGV, ISC, detracción, retención y
percepción, cobros y pagos, y el registro de compras y ventas exportable.

- **App:** Next.js 15 (React, TypeScript, Tailwind), instalable en el celular (PWA). Se despliega en Railway.
- **Datos:** Supabase: PostgreSQL, login, permisos por fila (RLS) y archivos.

## Estructura

| Carpeta | Contenido |
|---|---|
| `supabase/migrations/` | Esquema, seguridad (RLS, auditoría, avisos, automatizaciones), documentos y contabilidad |
| `supabase/seed.sql` | Etapas por tipo, documentos requeridos, proveedores, conceptos, series y detracciones |
| `supabase/instalacion_completa.sql` | Todo lo anterior en un solo archivo (lo genera `scripts/armar-instalacion.sh`) |
| `supabase/tests/` | Pruebas de permisos que corren sobre PostgreSQL puro |
| `src/app/(interno)/` | Pantallas del equipo de operaciones |
| `src/app/portal/` | Portal de clientes (solo lectura, solo su información) |

## Roles

| Rol | Puede |
|---|---|
| admin | Todo, incluida la gestión de usuarios |
| operaciones, aduanas, almacen, transporte | Leer y registrar la operación; operaciones y aduanas ven costos |
| finanzas | Leer, registrar, ver costos, mantener tarifas, **aprobar pagos**, emitir comprobantes y registrar cobros y pagos |
| consulta | Solo leer (sin costos) |
| cliente | Portal: solo sus expedientes, las referencias visibles, contenedores, stock y documentos validados y marcados como visibles |

Los permisos los aplica la base de datos (RLS), no solo la app. Ver `supabase/migrations/20261127000002_seguridad.sql`.

## Puesta en marcha

### 1. Supabase
1. Crear un proyecto en Supabase (región São Paulo, la más cercana a Lima).
2. En **SQL Editor**, pegar y ejecutar `supabase/instalacion_completa.sql`.
   **Ojo:** ese archivo borra y vuelve a crear todo el esquema `public` (sirve también para reinstalar;
   los usuarios de Authentication y los archivos se conservan, pero los datos de la app se pierden).
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
