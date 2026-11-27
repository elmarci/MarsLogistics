-- MarsLogistics · Seguridad: roles, Row Level Security, auditoría y almacenamiento.
--
-- Reglas:
--   * Personal interno activo (cualquier rol distinto de 'cliente') puede leer todo.
--   * Escriben los roles operativos; 'consulta' solo lee.
--   * Costos, tarifas y perfiles tienen reglas más estrictas.
--   * Un usuario 'cliente' solo LEE datos de su propio cliente y nunca ve
--     proveedores, tarifas, costos, incidencias ni documentos no marcados como visibles.
--   * Sin sesión no se ve nada.

-- ---------------------------------------------------------------------
-- Funciones auxiliares (security definer para poder leer perfil sin recursión de RLS)
-- ---------------------------------------------------------------------
create or replace function rol_actual() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfil where id = auth.uid() and activo
$$;

create or replace function cliente_actual() returns bigint
language sql stable security definer set search_path = public as $$
  select cliente_id from perfil where id = auth.uid() and activo and rol = 'cliente'
$$;

create or replace function es_interno() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() <> 'cliente', false)
$$;

create or replace function puede_escribir() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() not in ('cliente', 'consulta'), false)
$$;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() = 'admin', false)
$$;

create or replace function puede_ver_costos() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() in ('admin', 'finanzas', 'operaciones', 'aduanas'), false)
$$;

-- Órdenes que el usuario cliente puede ver.
create or replace function orden_visible(p_orden_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select es_interno()
      or exists (select 1 from orden o where o.id = p_orden_id and o.cliente_id = cliente_actual())
$$;

-- ---------------------------------------------------------------------
-- Activar RLS en todas las tablas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'cliente', 'perfil', 'historial_cambio', 'sede_cliente', 'proveedor', 'producto', 'concepto',
    'tarifa', 'orden', 'embarque', 'contenedor', 'despacho_aduanero', 'duda_razonable', 'almacen',
    'lote', 'vehiculo', 'personal_transporte', 'capacitacion', 'despacho', 'movimiento_stock',
    'movimiento_economico', 'incidencia', 'documento'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Tablas internas: lectura para personal interno, escritura para roles operativos
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'proveedor', 'producto', 'concepto', 'almacen', 'vehiculo', 'personal_transporte',
    'capacitacion', 'incidencia', 'duda_razonable'
  ] loop
    execute format('create policy %I on %I for select using (es_interno())', t || '_lectura', t);
    execute format('create policy %I on %I for all using (puede_escribir()) with check (puede_escribir())',
                   t || '_escritura', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Tablas visibles para el cliente (solo lo suyo, solo lectura)
-- ---------------------------------------------------------------------
create policy cliente_lectura on cliente for select
  using (es_interno() or id = cliente_actual());
create policy cliente_escritura on cliente for all
  using (puede_escribir()) with check (puede_escribir());

create policy sede_cliente_lectura on sede_cliente for select
  using (es_interno() or cliente_id = cliente_actual());
create policy sede_cliente_escritura on sede_cliente for all
  using (puede_escribir()) with check (puede_escribir());

create policy orden_lectura on orden for select
  using (es_interno() or cliente_id = cliente_actual());
create policy orden_escritura on orden for all
  using (puede_escribir()) with check (puede_escribir());

do $$
declare t text;
begin
  foreach t in array array['embarque', 'despacho_aduanero', 'lote', 'despacho'] loop
    execute format('create policy %I on %I for select using (orden_visible(orden_id))', t || '_lectura', t);
    execute format('create policy %I on %I for all using (puede_escribir()) with check (puede_escribir())',
                   t || '_escritura', t);
  end loop;
end $$;

create policy contenedor_lectura on contenedor for select
  using (es_interno() or exists (
    select 1 from embarque e where e.id = contenedor.embarque_id and orden_visible(e.orden_id)));
create policy contenedor_escritura on contenedor for all
  using (puede_escribir()) with check (puede_escribir());

create policy movimiento_stock_lectura on movimiento_stock for select
  using (es_interno() or exists (
    select 1 from lote l where l.id = movimiento_stock.lote_id and orden_visible(l.orden_id)));
create policy movimiento_stock_escritura on movimiento_stock for all
  using (puede_escribir()) with check (puede_escribir());

create policy documento_lectura on documento for select
  using (es_interno() or (visible_cliente and orden_id is not null and orden_visible(orden_id)));
create policy documento_escritura on documento for all
  using (puede_escribir()) with check (puede_escribir());

-- ---------------------------------------------------------------------
-- Costos, tarifas, perfiles e historial
-- ---------------------------------------------------------------------
create policy movimiento_economico_acceso on movimiento_economico for all
  using (puede_ver_costos()) with check (puede_ver_costos());

create policy tarifa_lectura on tarifa for select using (puede_ver_costos());
create policy tarifa_escritura on tarifa for all
  using (rol_actual() in ('admin', 'finanzas')) with check (rol_actual() in ('admin', 'finanzas'));

create policy perfil_lectura on perfil for select using (id = auth.uid() or es_interno());
create policy perfil_admin on perfil for all using (es_admin()) with check (es_admin());

create policy historial_lectura on historial_cambio for select using (es_admin());

-- ---------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------
create or replace function registrar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into historial_cambio (usuario_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
  values (
    auth.uid(),
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'cliente', 'perfil', 'proveedor', 'tarifa', 'orden', 'embarque', 'contenedor', 'despacho_aduanero',
    'lote', 'despacho', 'movimiento_stock', 'movimiento_economico', 'incidencia'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on %I for each row execute function registrar_cambio()',
      t || '_auditoria', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Alta automática de perfil al crear un usuario en Auth.
-- Nunca se confía en raw_user_meta_data para el rol (el propio usuario puede escribirlo):
-- el perfil nace como 'consulta' e inactivo, y la invitación hecha por un admin
-- (servidor, service role) fija rol, cliente y lo activa.
-- ---------------------------------------------------------------------
create or replace function crear_perfil_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfil (id, nombre, email, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    new.email,
    'consulta',
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_usuario();
