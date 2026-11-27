-- MarsLogistics · Seguridad, notificaciones y automatizaciones.
--
-- Reglas de acceso:
--   * Personal interno activo (cualquier rol distinto de 'cliente') lee todo lo operativo.
--   * Escriben los roles operativos; 'consulta' solo lee.
--   * Costos y tarifas: solo admin, finanzas, operaciones y aduanas.
--   * Pagos: cualquiera que escriba puede SOLICITAR; aprobar, rechazar y marcar pagado
--     es solo de finanzas (decisión del 27/11/2026).
--   * Un usuario 'cliente' solo LEE sus expedientes, las referencias marcadas como visibles,
--     y los documentos validados y visibles. Nunca ve tareas, bitácora, costos, pagos,
--     proveedores ni incidencias.
--   * Sin sesión no se ve nada.

-- =====================================================================
-- Funciones auxiliares (security definer para leer perfil sin recursión de RLS)
-- =====================================================================
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

create or replace function puede_aprobar_pagos() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() = 'finanzas', false)
$$;

create or replace function es_finanzas() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(rol_actual() in ('admin', 'finanzas'), false)
$$;

create or replace function expediente_visible(p_expediente_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select es_interno()
      or exists (select 1 from expediente e
                 where e.id = p_expediente_id and e.cliente_id = cliente_actual())
$$;

create or replace function referencia_visible(p_referencia_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select es_interno()
      or exists (select 1 from referencia r join expediente e on e.id = r.expediente_id
                 where r.id = p_referencia_id and r.visible_cliente and e.cliente_id = cliente_actual())
$$;

revoke execute on function siguiente_codigo(text) from anon;

-- =====================================================================
-- Activar RLS en TODAS las tablas del esquema (las que falten quedan cerradas)
-- =====================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- =====================================================================
-- Tablas internas: lectura del personal interno, escritura de roles operativos
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'proveedor', 'producto', 'concepto', 'almacen', 'vehiculo', 'personal_transporte',
    'capacitacion', 'incidencia', 'duda_razonable', 'tarea'
  ] loop
    execute format('create policy %I on %I for select using (es_interno())', t || '_lectura', t);
    execute format('create policy %I on %I for all using (puede_escribir()) with check (puede_escribir())',
                   t || '_escritura', t);
  end loop;
end $$;

-- Catálogos de configuración: los lee cualquiera con sesión activa; los cambia el admin.
do $$
declare t text;
begin
  foreach t in array array['etapa', 'tipo_documento'] loop
    execute format('create policy %I on %I for select using (rol_actual() is not null)', t || '_lectura', t);
    execute format('create policy %I on %I for all using (es_admin()) with check (es_admin())', t || '_admin', t);
  end loop;
end $$;
create policy documento_requerido_lectura on documento_requerido for select using (es_interno());
create policy documento_requerido_admin on documento_requerido for all using (es_admin()) with check (es_admin());

-- correlativo: sin políticas; solo lo toca siguiente_codigo().

-- =====================================================================
-- Clientes, expedientes y referencias
-- =====================================================================
create policy cliente_lectura on cliente for select
  using (es_interno() or id = cliente_actual());
create policy cliente_escritura on cliente for all
  using (puede_escribir()) with check (puede_escribir());

create policy sede_cliente_lectura on sede_cliente for select
  using (es_interno() or cliente_id = cliente_actual());
create policy sede_cliente_escritura on sede_cliente for all
  using (puede_escribir()) with check (puede_escribir());

create policy expediente_lectura on expediente for select
  using (es_interno() or cliente_id = cliente_actual());
create policy expediente_escritura on expediente for all
  using (puede_escribir()) with check (puede_escribir());

create policy referencia_lectura on referencia for select
  using (es_interno() or (visible_cliente and expediente_visible(expediente_id)));
create policy referencia_escritura on referencia for all
  using (puede_escribir()) with check (puede_escribir());

-- El historial de etapas lo escribe el trigger; nadie lo edita a mano.
create policy referencia_etapa_lectura on referencia_etapa for select
  using (referencia_visible(referencia_id));

do $$
declare t text;
begin
  foreach t in array array['ref_carga', 'ref_aduana', 'ref_transporte', 'ref_almacenaje',
                           'transporte_unidad', 'movimiento_stock'] loop
    execute format('create policy %I on %I for select using (referencia_visible(referencia_id))', t || '_lectura', t);
    execute format('create policy %I on %I for all using (puede_escribir()) with check (puede_escribir())',
                   t || '_escritura', t);
  end loop;
end $$;

create policy contenedor_lectura on contenedor for select
  using (expediente_visible(expediente_id));
create policy contenedor_escritura on contenedor for all
  using (puede_escribir()) with check (puede_escribir());

-- =====================================================================
-- Documentos, bitácora y notificaciones
-- =====================================================================
create policy documento_lectura on documento for select
  using (es_interno() or (
    visible_cliente and estado = 'validado' and expediente_visible(expediente_id)
    and (referencia_id is null or referencia_visible(referencia_id))));
create policy documento_escritura on documento for all
  using (puede_escribir()) with check (puede_escribir());

create policy comentario_lectura on comentario for select using (es_interno());
create policy comentario_alta on comentario for insert
  with check (puede_escribir() and autor_id = auth.uid());
create policy comentario_propio on comentario for update
  using (autor_id = auth.uid()) with check (autor_id = auth.uid());
create policy comentario_borrado on comentario for delete
  using (autor_id = auth.uid() or es_admin());

create policy notificacion_propia on notificacion for select using (usuario_id = auth.uid());
create policy notificacion_marcar on notificacion for update
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy notificacion_borrar on notificacion for delete using (usuario_id = auth.uid());
create policy notificacion_alta on notificacion for insert with check (es_interno());

-- =====================================================================
-- Costos, pagos, tarifas, perfiles e historial
-- =====================================================================
create policy movimiento_economico_acceso on movimiento_economico for all
  using (puede_ver_costos()) with check (puede_ver_costos());

create policy solicitud_pago_lectura on solicitud_pago for select
  using (puede_ver_costos() or solicitado_por = auth.uid());
create policy solicitud_pago_alta on solicitud_pago for insert
  with check (puede_escribir());
create policy solicitud_pago_cambio on solicitud_pago for update
  using (puede_aprobar_pagos() or (solicitado_por = auth.uid() and estado = 'solicitada'))
  with check (puede_escribir());
create policy solicitud_pago_borrado on solicitud_pago for delete
  using (es_admin() or (solicitado_por = auth.uid() and estado = 'solicitada'));

create policy tarifa_lectura on tarifa for select using (puede_ver_costos());
create policy tarifa_escritura on tarifa for all
  using (es_finanzas()) with check (es_finanzas());

create policy perfil_lectura on perfil for select using (id = auth.uid() or es_interno());
create policy perfil_admin on perfil for all using (es_admin()) with check (es_admin());

create policy historial_lectura on historial_cambio for select using (es_admin());

-- Flujo de pagos: solo finanzas aprueba, rechaza y marca como pagado.
create or replace function solicitud_pago_controlar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.solicitado_por := coalesce(auth.uid(), new.solicitado_por);
    new.estado := 'solicitada';
    new.aprobado_por := null; new.aprobado_en := null; new.pagado_en := null;
    return new;
  end if;
  if new.estado is distinct from old.estado then
    if auth.uid() is not null and not puede_aprobar_pagos() then
      raise exception 'Solo finanzas puede aprobar, rechazar o pagar';
    end if;
    if new.estado in ('aprobada', 'rechazada') then
      new.aprobado_por := auth.uid(); new.aprobado_en := now();
    elsif new.estado = 'pagada' then
      if old.estado <> 'aprobada' then raise exception 'Solo se paga una solicitud aprobada'; end if;
      new.pagado_en := now();
    end if;
  end if;
  -- El monto no cambia después de aprobado.
  if old.estado <> 'solicitada' and (new.monto, new.moneda) is distinct from (old.monto, old.moneda) then
    raise exception 'No se puede cambiar el monto de una solicitud ya revisada';
  end if;
  return new;
end $$;

create trigger solicitud_pago_controlar before insert or update on solicitud_pago
  for each row execute function solicitud_pago_controlar();

-- =====================================================================
-- Auditoría
-- =====================================================================
create or replace function registrar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into historial_cambio (usuario_id, tabla, registro_id, accion, valor_anterior, valor_nuevo)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'referencia_id',
             to_jsonb(old) ->> 'referencia_id', ''),
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
    'cliente', 'perfil', 'proveedor', 'tarifa', 'expediente', 'referencia', 'ref_carga', 'ref_aduana',
    'ref_transporte', 'ref_almacenaje', 'contenedor', 'transporte_unidad', 'movimiento_stock',
    'documento', 'movimiento_economico', 'solicitud_pago', 'incidencia', 'etapa'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on %I for each row execute function registrar_cambio()',
      t || '_auditoria', t);
  end loop;
end $$;

-- =====================================================================
-- Notificaciones automáticas (dentro de la app; el correo llegará con SMTP)
-- =====================================================================
create or replace function notificar(p_usuario uuid, p_titulo text, p_cuerpo text, p_enlace text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_usuario is null or p_usuario is not distinct from auth.uid() then return; end if;
  insert into notificacion (usuario_id, titulo, cuerpo, enlace) values (p_usuario, p_titulo, p_cuerpo, p_enlace);
end $$;
revoke execute on function notificar(uuid, text, text, text) from public, anon, authenticated;

create or replace function enlace_de(p_expediente_id bigint, p_referencia_id bigint) returns text
language sql immutable as $$
  select case when p_referencia_id is not null then '/referencias/' || p_referencia_id
              else '/expedientes/' || p_expediente_id end
$$;

-- Tarea asignada o reasignada.
create or replace function tarea_notificar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.asignado_a is not null and (tg_op = 'INSERT' or new.asignado_a is distinct from old.asignado_a) then
    perform notificar(new.asignado_a, 'Nueva tarea: ' || new.titulo,
      case when new.vence_en is not null then 'Vence ' || to_char(new.vence_en at time zone 'America/Lima', 'DD/MM HH24:MI') end,
      enlace_de(new.expediente_id, new.referencia_id));
  end if;
  if tg_op = 'UPDATE' and new.estado = 'hecha' and old.estado <> 'hecha' then
    new.completada_en := now();
    perform notificar(new.creado_por, 'Tarea completada: ' || new.titulo, null,
      enlace_de(new.expediente_id, new.referencia_id));
  end if;
  return new;
end $$;
create trigger tarea_notificar before insert or update on tarea
  for each row execute function tarea_notificar();

-- Comentario en la bitácora: avisa a los @mencionados (por la parte del correo antes de @)
-- y al responsable de la referencia.
create or replace function comentario_notificar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_codigo text;
  v_resp uuid;
  v_autor text;
  p record;
begin
  select coalesce(r.codigo, e.codigo), coalesce(r.responsable_id, e.responsable_id)
    into v_codigo, v_resp
    from expediente e left join referencia r on r.id = new.referencia_id
   where e.id = new.expediente_id;
  select nombre into v_autor from perfil where id = new.autor_id;
  for p in
    select distinct pf.id from perfil pf
     where pf.activo and pf.rol <> 'cliente'
       and lower(new.texto) ~ ('@' || lower(regexp_replace(split_part(pf.email, '@', 1), '([.+])', '\\\1', 'g')) || '(\W|$)')
  loop
    perform notificar(p.id, v_autor || ' te mencionó en ' || v_codigo, left(new.texto, 200),
                      enlace_de(new.expediente_id, new.referencia_id));
  end loop;
  perform notificar(v_resp, 'Nuevo comentario en ' || v_codigo, left(new.texto, 200),
                    enlace_de(new.expediente_id, new.referencia_id));
  return new;
end $$;
create trigger comentario_notificar after insert on comentario
  for each row execute function comentario_notificar();

-- Referencia asignada a un responsable.
create or replace function referencia_notificar_responsable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.responsable_id is not null and (tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id) then
    perform notificar(new.responsable_id, 'Te asignaron ' || new.codigo, new.descripcion, '/referencias/' || new.id);
  end if;
  return new;
end $$;
create trigger referencia_notificar_responsable after insert or update of responsable_id on referencia
  for each row execute function referencia_notificar_responsable();

-- Documento observado o rechazado: avisa a quien lo subió.
create or replace function documento_notificar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado then
    if new.estado in ('validado', 'observado', 'rechazado') then
      new.validado_por := auth.uid();
      new.validado_en := now();
    end if;
    if new.estado in ('observado', 'rechazado') then
      perform notificar(new.subido_por, 'Documento ' || new.estado || ': ' || new.nombre_archivo,
                        new.observacion, enlace_de(new.expediente_id, new.referencia_id));
    end if;
  end if;
  return new;
end $$;
create trigger documento_notificar before update on documento
  for each row execute function documento_notificar();

-- Pagos: nueva solicitud avisa a finanzas; el cambio de estado avisa a quien solicitó.
create or replace function solicitud_pago_notificar() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if tg_op = 'INSERT' then
    for p in select id from perfil where activo and rol = 'finanzas' loop
      perform notificar(p.id, 'Pago por aprobar: ' || new.moneda || ' ' || new.monto, new.concepto, '/pagos');
    end loop;
  elsif new.estado is distinct from old.estado then
    perform notificar(new.solicitado_por, 'Pago ' || new.estado || ': ' || new.concepto,
                      new.moneda || ' ' || new.monto, '/pagos');
  end if;
  return new;
end $$;
create trigger solicitud_pago_notificar after insert or update of estado on solicitud_pago
  for each row execute function solicitud_pago_notificar();

-- =====================================================================
-- Automatizaciones de flujo
-- =====================================================================

-- Aduana llega a LEVANTE: avisa al responsable del expediente para programar el retiro
-- (TRA) y el ingreso a almacén (ALM). La app ofrece crearlas con un clic.
create or replace function aduana_levante_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_codigo_etapa text;
  v_resp uuid;
begin
  if new.tipo <> 'ADUANA' or new.etapa_id is not distinct from old.etapa_id then return new; end if;
  select codigo into v_codigo_etapa from etapa where id = new.etapa_id;
  if v_codigo_etapa = 'LEVANTE' then
    select responsable_id into v_resp from expediente where id = new.expediente_id;
    perform notificar(new.responsable_id, new.codigo || ' con levante',
      'Programa el retiro de puerto y el ingreso a almacén.', '/referencias/' || new.id);
    if v_resp is distinct from new.responsable_id then
      perform notificar(v_resp, new.codigo || ' con levante',
        'Programa el retiro de puerto y el ingreso a almacén.', '/referencias/' || new.id);
    end if;
  end if;
  return new;
end $$;
create trigger aduana_levante_avisar after update of etapa_id on referencia
  for each row execute function aduana_levante_avisar();

-- Stock de almacenaje: no permite salir más de lo que hay; la primera salida pasa la ALM a
-- "Retiros parciales" y, al llegar a cero, a "Agotado".
create or replace function stock_controlar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stock integer;
  v_tipo tipo_referencia;
  v_orden_actual integer;
  v_destino text;
begin
  select r.tipo, et.orden into v_tipo, v_orden_actual
    from referencia r left join etapa et on et.id = r.etapa_id where r.id = new.referencia_id;
  if v_tipo <> 'ALMACENAJE' then
    raise exception 'Los movimientos de stock solo aplican a referencias de almacenaje';
  end if;
  select a.bultos_inicial + coalesce((select sum(m.bultos) from movimiento_stock m
                                       where m.referencia_id = a.referencia_id and m.id <> new.id), 0) + new.bultos
    into v_stock from ref_almacenaje a where a.referencia_id = new.referencia_id;
  if v_stock is null then raise exception 'La referencia de almacenaje no tiene ingreso registrado'; end if;
  if v_stock < 0 then raise exception 'Stock insuficiente: quedarían % bultos', v_stock; end if;

  v_destino := case when v_stock = 0 then 'AGOTADO' when new.tipo = 'SALIDA' then 'RETIROS_PARCIALES' end;
  if v_destino is not null then
    update referencia r set etapa_id = et.id
      from etapa et
     where r.id = new.referencia_id and et.tipo = 'ALMACENAJE' and et.codigo = v_destino
       and et.orden > coalesce(v_orden_actual, 0);
  end if;
  return new;
end $$;
create trigger stock_controlar after insert on movimiento_stock
  for each row execute function stock_controlar();

-- =====================================================================
-- Alta automática de perfil al crear un usuario en Auth.
-- Nunca se confía en raw_user_meta_data para el rol (el propio usuario puede escribirlo):
-- el perfil nace como 'consulta' e inactivo, y un admin lo habilita.
-- =====================================================================
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

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_usuario();

-- Usuarios que ya existían en Auth (por ejemplo, al reinstalar la base).
insert into perfil (id, nombre, email, rol, activo)
select u.id, coalesce(u.raw_user_meta_data ->> 'nombre', split_part(u.email, '@', 1)), u.email, 'consulta', false
from auth.users u
on conflict (id) do nothing;
