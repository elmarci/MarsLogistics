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

-- ===================== migrations/20261127000001_esquema_base.sql =====================
-- MarsLogistics · Esquema base
-- Un EXPEDIENTE agrupa la operación completa de un cliente. De él cuelgan REFERENCIAS
-- hijas (carga SEA/AIR, aduana ADU, transporte TRA, almacenaje ALM), cada una con su
-- flujo de etapas, responsable, documentos, tareas, bitácora, costos y pagos.

create extension if not exists pgcrypto;

-- =====================================================================
-- PERFILES
-- =====================================================================
create type rol_usuario as enum (
  'admin', 'operaciones', 'aduanas', 'almacen', 'transporte', 'finanzas', 'consulta', 'cliente'
);

create table cliente (
  id               bigint generated always as identity primary key,
  ruc              text unique,
  razon_social     text not null,
  nombre_comercial text,
  grupo            text,
  contacto         text,
  email            text,
  telefono         text,
  direccion        text,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);

create table perfil (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  email       text not null,
  rol         rol_usuario not null default 'consulta',
  cliente_id  bigint references cliente (id),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  constraint perfil_cliente_coherente check ((rol = 'cliente') = (cliente_id is not null))
);

create table historial_cambio (
  id              bigint generated always as identity primary key,
  fecha           timestamptz not null default now(),
  usuario_id      uuid,
  tabla           text not null,
  registro_id     text not null,
  accion          text not null,
  valor_anterior  jsonb,
  valor_nuevo     jsonb
);

-- =====================================================================
-- MAESTROS
-- =====================================================================
create table sede_cliente (
  id                     bigint generated always as identity primary key,
  cliente_id             bigint not null references cliente (id),
  nombre                 text not null,
  direccion              text,
  region                 text,
  tiempo_estandar_horas  numeric(6,2),
  activo                 boolean not null default true,
  unique (cliente_id, nombre)
);

create type tipo_proveedor as enum (
  'naviera', 'aerolinea', 'agente_carga', 'agente_aduanas', 'almacen', 'terminal', 'deposito_vacios',
  'transporte_local', 'transporte_destino', 'otro'
);
create type estado_homologacion as enum ('pendiente', 'homologado', 'observado', 'suspendido');

create table proveedor (
  id                   bigint generated always as identity primary key,
  ruc                  text unique,
  razon_social         text not null,
  nombre_corto         text,
  pais                 text not null default 'PE',
  tipo                 tipo_proveedor not null,
  contacto             text,
  email                text,
  telefono             text,
  condiciones_pago     text,
  estado_homologacion  estado_homologacion not null default 'pendiente',
  activo               boolean not null default true,
  creado_en            timestamptz not null default now()
);

create table producto (
  id                   bigint generated always as identity primary key,
  codigo               text unique,
  descripcion          text not null,
  partida_arancelaria  text,
  es_matpel            boolean not null default false,
  clase_onu            text,
  numero_onu           text,
  unidad_medida        text not null default 'TM',
  unidad_bulto         text not null default 'CAJA',
  peso_bulto_kg        numeric(12,3),
  activo               boolean not null default true
);

create type tipo_movimiento_economico as enum ('COSTO', 'VENTA', 'VENTA_EXTRA', 'SOBRECOSTO', 'REEMBOLSO');
create type moneda as enum ('USD', 'PEN');

create table concepto (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  tipo    tipo_movimiento_economico not null,
  etapa   text,
  activo  boolean not null default true
);

create table tarifa (
  id             bigint generated always as identity primary key,
  concepto_id    bigint not null references concepto (id),
  proveedor_id   bigint references proveedor (id),
  cliente_id     bigint references cliente (id),
  sede_id        bigint references sede_cliente (id),
  unidad         text not null,
  moneda         moneda not null,
  precio         numeric(14,4) not null,
  minimo         numeric(14,4),
  vigente_desde  date not null,
  vigente_hasta  date,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create table almacen (
  id              bigint generated always as identity primary key,
  proveedor_id    bigint references proveedor (id),
  nombre          text not null unique,
  m2_contratados  numeric(10,2),
  activo          boolean not null default true
);

create table vehiculo (
  id                    bigint generated always as identity primary key,
  proveedor_id          bigint not null references proveedor (id),
  placa                 text not null unique,
  tipo                  text not null check (tipo in ('TRACTO', 'CARRETA', 'CAMIONETA', 'ESCOLTA')),
  vencimiento_soat      date,
  vencimiento_revision  date,
  activo                boolean not null default true
);

create table personal_transporte (
  id                    bigint generated always as identity primary key,
  proveedor_id          bigint not null references proveedor (id),
  nombre                text not null,
  dni                   text,
  licencia              text,
  vencimiento_licencia  date,
  rol                   text not null check (rol in ('CONDUCTOR', 'ESCOLTA')),
  activo                boolean not null default true
);

create table capacitacion (
  id                bigint generated always as identity primary key,
  personal_id       bigint not null references personal_transporte (id) on delete cascade,
  curso             text not null,
  fecha_expedicion  date,
  fecha_expiracion  date
);

-- =====================================================================
-- CORRELATIVOS: PREFIJO + AÑO (2 dígitos) + 4 dígitos, p. ej. SEA260050
-- =====================================================================
create table correlativo (
  prefijo  text not null,
  anio     integer not null,
  ultimo   integer not null default 0,
  primary key (prefijo, anio)
);

-- security definer: nadie escribe en `correlativo` directamente; solo a través de esta función.
create or replace function siguiente_codigo(p_prefijo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_anio integer := extract(year from now() at time zone 'America/Lima')::integer % 100;
  v_num  integer;
begin
  insert into correlativo (prefijo, anio, ultimo) values (p_prefijo, v_anio, 1)
  on conflict (prefijo, anio) do update set ultimo = correlativo.ultimo + 1
  returning ultimo into v_num;
  return p_prefijo || lpad(v_anio::text, 2, '0') || lpad(v_num::text, 4, '0');
end $$;

-- =====================================================================
-- EXPEDIENTES
-- =====================================================================
create type estado_expediente as enum ('abierto', 'en_curso', 'cerrado', 'anulado');

create table expediente (
  id                bigint generated always as identity primary key,
  codigo            text not null unique,
  cliente_id        bigint not null references cliente (id),
  sede_destino_id   bigint references sede_cliente (id),
  ref_cliente       text,
  regimen           text not null default 'IMPORTACION' check (regimen in ('IMPORTACION', 'EXPORTACION')),
  producto_id       bigint references producto (id),
  descripcion       text,
  cantidad          numeric(14,3),
  unidad_medida     text not null default 'TM',
  bultos            integer,
  incoterm          text,
  pais_origen       text,
  responsable_id    uuid references perfil (id),
  estado            estado_expediente not null default 'abierto',
  fecha_apertura    date not null default current_date,
  fecha_cierre      date,
  observaciones     text,
  creado_por        uuid default auth.uid(),
  creado_en         timestamptz not null default now()
);
create index expediente_cliente_idx on expediente (cliente_id);
create index expediente_estado_idx on expediente (estado);

-- =====================================================================
-- REFERENCIAS Y ETAPAS
-- =====================================================================
create type tipo_referencia as enum ('CARGA_MARITIMA', 'CARGA_AEREA', 'ADUANA', 'TRANSPORTE', 'ALMACENAJE');

create or replace function prefijo_referencia(t tipo_referencia) returns text
language sql immutable as $$
  select case t
    when 'CARGA_MARITIMA' then 'SEA'
    when 'CARGA_AEREA' then 'AIR'
    when 'ADUANA' then 'ADU'
    when 'TRANSPORTE' then 'TRA'
    when 'ALMACENAJE' then 'ALM'
  end
$$;

-- Catálogo de etapas por tipo. Editable: el orden define el flujo.
create table etapa (
  id               bigint generated always as identity primary key,
  tipo             tipo_referencia not null,
  orden            integer not null,
  codigo           text not null,
  nombre           text not null,
  horas_estandar   numeric(8,2),
  es_final         boolean not null default false,
  visible_cliente  boolean not null default true,
  unique (tipo, orden),
  unique (tipo, codigo)
);

create type estado_referencia as enum ('activa', 'cerrada', 'anulada');

create table referencia (
  id                    bigint generated always as identity primary key,
  expediente_id         bigint not null references expediente (id) on delete cascade,
  tipo                  tipo_referencia not null,
  codigo                text not null unique,
  etapa_id              bigint references etapa (id),
  estado                estado_referencia not null default 'activa',
  descripcion           text,
  responsable_id        uuid references perfil (id),
  proveedor_id          bigint references proveedor (id),   -- naviera, agente, transportista o almacén principal
  referencia_origen_id  bigint references referencia (id),  -- p. ej. TRA generada desde ADU
  visible_cliente       boolean not null default true,
  fecha_inicio          timestamptz not null default now(),
  fecha_cierre          timestamptz,
  creado_por            uuid default auth.uid(),
  creado_en             timestamptz not null default now()
);
create index referencia_expediente_idx on referencia (expediente_id);
create index referencia_tipo_etapa_idx on referencia (tipo, etapa_id);
create index referencia_responsable_idx on referencia (responsable_id);

create table referencia_etapa (
  id             bigint generated always as identity primary key,
  referencia_id  bigint not null references referencia (id) on delete cascade,
  etapa_id       bigint not null references etapa (id),
  inicio         timestamptz not null default now(),
  fin            timestamptz,
  usuario_id     uuid default auth.uid(),
  comentario     text
);
create index referencia_etapa_ref_idx on referencia_etapa (referencia_id);

-- ---------- Detalle de CARGA (SEA / AIR) ----------
create table ref_carga (
  referencia_id     bigint primary key references referencia (id) on delete cascade,
  booking           text,
  mbl               text,   -- MBL / MAWB
  hbl               text,   -- HBL / HAWB
  nave_viaje        text,
  manifiesto        text,
  condicion         text not null default 'FCL' check (condicion in ('FCL', 'LCL', 'AEREO')),
  puerto_origen     text,
  puerto_destino    text not null default 'CALLAO',
  terminal_id       bigint references proveedor (id),
  etd               date,
  eta               date,
  fecha_zarpe       date,
  fecha_llegada     date,
  dias_libres       integer,
  vencimiento_memo  date
);

-- Contenedores: pertenecen al expediente porque pasan por varias referencias.
create type estado_contenedor as enum ('en_transito', 'en_puerto', 'retirado', 'en_almacen', 'vaciado', 'devuelto');

create table contenedor (
  id                      bigint generated always as identity primary key,
  expediente_id           bigint not null references expediente (id) on delete cascade,
  numero                  text not null,
  tamano                  text not null default '20',
  tipo                    text not null default 'DRY',
  precinto                text,
  peso_bruto_kg           numeric(14,3),
  bultos                  integer,
  hora_descarga           timestamptz,
  hora_cita               timestamptz,
  hora_retiro             timestamptz,
  perdida_cita_puerto     boolean not null default false,
  uso_area_puerto         boolean not null default false,
  fecha_ingreso_almacen   timestamptz,
  deposito_vacio_id       bigint references proveedor (id),
  cita_vacio              timestamptz,
  fecha_devolucion_vacio  timestamptz,
  perdida_cita_vacio      boolean not null default false,
  estado                  estado_contenedor not null default 'en_transito',
  unique (expediente_id, numero)
);

-- ---------- Detalle de ADUANA (ADU) ----------
create type canal_aduanero as enum ('VERDE', 'NARANJA', 'ROJO');

create table ref_aduana (
  referencia_id        bigint primary key references referencia (id) on delete cascade,
  regimen_aduanero     text default 'IMPORTACION PARA EL CONSUMO',
  dam                  text,
  ref_agente           text,
  fecha_numeracion     timestamptz,
  fecha_pago_derechos  date,
  canal                canal_aduanero,
  fecha_levante        timestamptz,
  invoice              text,
  valor_fob            numeric(14,2),
  valor_cif            numeric(14,2),
  derechos_usd         numeric(14,2)
);

create table duda_razonable (
  id                   bigint generated always as identity primary key,
  referencia_id        bigint not null references referencia (id) on delete cascade,
  numero_notificacion  text,
  descripcion          text,
  fecha_emision        date,
  fecha_recepcion      date,
  plazo_respuesta      date,
  garantia             text,
  estado               text not null default 'abierta' check (estado in ('abierta', 'respondida', 'cerrada'))
);

-- ---------- Detalle de TRANSPORTE (TRA) ----------
create table ref_transporte (
  referencia_id       bigint primary key references referencia (id) on delete cascade,
  tipo_servicio       text not null default 'DISTRIBUCION'
                        check (tipo_servicio in ('RETIRO_PUERTO', 'TRASLADO_ALMACEN', 'DISTRIBUCION', 'DEVOLUCION_VACIO', 'OTRO')),
  origen              text,
  destino             text,
  sede_destino_id     bigint references sede_cliente (id),
  fecha_programada    date,
  bultos              integer,
  servicio_especial   boolean not null default false,
  observaciones       text
);

-- Una referencia de transporte puede movilizar varias unidades (p. ej. 3 tractos a mina).
create table transporte_unidad (
  id                   bigint generated always as identity primary key,
  referencia_id        bigint not null references referencia (id) on delete cascade,
  contenedor_id        bigint references contenedor (id),
  tracto_id            bigint references vehiculo (id),
  carreta_id           bigint references vehiculo (id),
  conductor_id         bigint references personal_transporte (id),
  placa_tracto         text,
  placa_carreta        text,
  conductor            text,
  bultos               integer,
  precinto             text,
  gre_remitente        text,
  gre_transportista    text,
  salida               timestamptz,
  llegada              timestamptz,
  motivo_retraso       text
);
create index transporte_unidad_ref_idx on transporte_unidad (referencia_id);

-- ---------- Detalle de ALMACENAJE (ALM) ----------
create table ref_almacenaje (
  referencia_id   bigint primary key references referencia (id) on delete cascade,
  almacen_id      bigint references almacen (id),
  producto_id     bigint references producto (id),
  fecha_ingreso   date,
  bultos_inicial  integer not null default 0 check (bultos_inicial >= 0),
  ubicacion       text,
  m2_ocupados     numeric(10,2)
);

create table movimiento_stock (
  id                    bigint generated always as identity primary key,
  referencia_id         bigint not null references referencia (id) on delete cascade,  -- la ALM
  tipo                  text not null check (tipo in ('SALIDA', 'AJUSTE')),
  bultos                integer not null check (bultos <> 0),                          -- negativo = sale
  transporte_unidad_id  bigint references transporte_unidad (id) on delete set null,
  fecha                 timestamptz not null default now(),
  usuario_id            uuid default auth.uid(),
  observacion           text
);
create index movimiento_stock_ref_idx on movimiento_stock (referencia_id);

-- =====================================================================
-- DOCUMENTOS, TAREAS, BITÁCORA, NOTIFICACIONES
-- =====================================================================
create table tipo_documento (
  codigo  text primary key,
  nombre  text not null
);

-- Documentos que pide cada tipo de referencia (opcionalmente desde una etapa).
create table documento_requerido (
  id               bigint generated always as identity primary key,
  tipo             tipo_referencia not null,
  tipo_documento   text not null references tipo_documento (codigo),
  desde_etapa_id   bigint references etapa (id),
  obligatorio      boolean not null default true,
  unique (tipo, tipo_documento)
);

create type estado_documento as enum ('pendiente', 'validado', 'observado', 'rechazado');

create table documento (
  id                 bigint generated always as identity primary key,
  expediente_id      bigint not null references expediente (id) on delete cascade,
  referencia_id      bigint references referencia (id) on delete cascade,
  tipo_documento     text not null references tipo_documento (codigo),
  nombre_archivo     text not null,
  ruta_storage       text not null,
  tamano_bytes       bigint,
  estado             estado_documento not null default 'pendiente',
  observacion        text,
  validado_por       uuid references perfil (id),
  validado_en        timestamptz,
  visible_cliente    boolean not null default false,
  vencimiento        date,
  subido_por         uuid default auth.uid() references perfil (id),
  creado_en          timestamptz not null default now()
);
create index documento_ref_idx on documento (referencia_id);
create index documento_exp_idx on documento (expediente_id);

create type estado_tarea as enum ('pendiente', 'en_proceso', 'hecha', 'cancelada');

create table tarea (
  id             bigint generated always as identity primary key,
  expediente_id  bigint not null references expediente (id) on delete cascade,
  referencia_id  bigint references referencia (id) on delete cascade,
  titulo         text not null,
  descripcion    text,
  asignado_a     uuid references perfil (id),
  vence_en       timestamptz,
  estado         estado_tarea not null default 'pendiente',
  completada_en  timestamptz,
  creado_por     uuid default auth.uid() references perfil (id),
  creado_en      timestamptz not null default now()
);
create index tarea_asignado_idx on tarea (asignado_a, estado);

create table comentario (
  id             bigint generated always as identity primary key,
  expediente_id  bigint not null references expediente (id) on delete cascade,
  referencia_id  bigint references referencia (id) on delete cascade,
  autor_id       uuid not null default auth.uid() references perfil (id),
  texto          text not null,
  creado_en      timestamptz not null default now()
);
create index comentario_ref_idx on comentario (referencia_id);

create table notificacion (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references perfil (id) on delete cascade,
  titulo      text not null,
  cuerpo      text,
  enlace      text,
  leida       boolean not null default false,
  creado_en   timestamptz not null default now()
);
create index notificacion_usuario_idx on notificacion (usuario_id, leida);

-- =====================================================================
-- COSTOS, VENTAS Y PAGOS
-- =====================================================================
create type estado_movimiento_economico as enum ('pendiente', 'facturado', 'pagado', 'anulado');

create table movimiento_economico (
  id                   bigint generated always as identity primary key,
  expediente_id        bigint not null references expediente (id) on delete cascade,
  referencia_id        bigint references referencia (id) on delete set null,
  concepto_id          bigint not null references concepto (id),
  proveedor_id         bigint references proveedor (id),
  tipo                 tipo_movimiento_economico not null,
  sobrecosto_asume     text check (sobrecosto_asume in ('CLIENTE', 'MAC')),
  cantidad             numeric(14,3) not null default 1,
  valor_unitario       numeric(14,4) not null,
  moneda               moneda not null,
  tipo_cambio          numeric(10,4) not null default 1 check (tipo_cambio > 0),
  igv                  numeric(14,2) not null default 0,
  comprobante          text,
  fecha_comprobante    date,
  fecha_pago           date,
  periodo              text,
  estado               estado_movimiento_economico not null default 'pendiente',
  creado_en            timestamptz not null default now()
);
create index movimiento_economico_exp_idx on movimiento_economico (expediente_id);

create type estado_solicitud_pago as enum ('solicitada', 'aprobada', 'rechazada', 'pagada');

create table solicitud_pago (
  id              bigint generated always as identity primary key,
  expediente_id   bigint not null references expediente (id) on delete cascade,
  referencia_id   bigint references referencia (id) on delete set null,
  proveedor_id    bigint references proveedor (id),
  concepto        text not null,
  monto           numeric(14,2) not null check (monto > 0),
  moneda          moneda not null,
  documento_id    bigint references documento (id) on delete set null,   -- sustento
  fecha_limite    date,
  estado          estado_solicitud_pago not null default 'solicitada',
  solicitado_por  uuid default auth.uid() references perfil (id),
  aprobado_por    uuid references perfil (id),
  aprobado_en     timestamptz,
  pagado_en       timestamptz,
  comprobante     text,
  observacion     text,
  creado_en       timestamptz not null default now()
);

create table incidencia (
  id                   bigint generated always as identity primary key,
  codigo               text unique,
  expediente_id        bigint references expediente (id),
  referencia_id        bigint references referencia (id),
  proveedor_id         bigint references proveedor (id),
  descripcion          text not null,
  fecha                date not null default current_date,
  medidas_correctivas  text,
  estado               text not null default 'activa' check (estado in ('activa', 'cerrada'))
);

-- =====================================================================
-- LÓGICA DE REFERENCIAS
-- =====================================================================

-- Antes de insertar: código automático y primera etapa del flujo.
create or replace function referencia_antes_insertar() returns trigger
language plpgsql as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := siguiente_codigo(prefijo_referencia(new.tipo));
  end if;
  if new.etapa_id is null then
    select id into new.etapa_id from etapa where tipo = new.tipo order by orden limit 1;
  end if;
  return new;
end $$;

create trigger referencia_antes_insertar before insert on referencia
  for each row execute function referencia_antes_insertar();

-- Después de insertar o al cambiar de etapa: historial y cierre automático.
create or replace function referencia_registrar_etapa() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_final boolean;
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then
    return new;
  end if;
  update referencia_etapa set fin = now() where referencia_id = new.id and fin is null;
  if new.etapa_id is not null then
    insert into referencia_etapa (referencia_id, etapa_id) values (new.id, new.etapa_id);
    select es_final into v_final from etapa where id = new.etapa_id;
    if v_final and new.estado = 'activa' then
      update referencia set estado = 'cerrada', fecha_cierre = now() where id = new.id;
    elsif not v_final and new.estado = 'cerrada' then
      update referencia set estado = 'activa', fecha_cierre = null where id = new.id;
    end if;
  end if;
  -- El expediente pasa a "en curso" cuando alguna referencia avanza.
  update expediente set estado = 'en_curso' where id = new.expediente_id and estado = 'abierto';
  return new;
end $$;

create trigger referencia_registrar_etapa after insert or update of etapa_id on referencia
  for each row execute function referencia_registrar_etapa();

create or replace function expediente_antes_insertar() returns trigger
language plpgsql as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := siguiente_codigo('EXP');
  end if;
  return new;
end $$;

create trigger expediente_antes_insertar before insert on expediente
  for each row execute function expediente_antes_insertar();

-- =====================================================================
-- VISTAS
-- =====================================================================
create view v_stock_almacenaje with (security_invoker = true) as
select r.id as referencia_id,
       r.codigo,
       r.expediente_id,
       e.cliente_id,
       a.almacen_id,
       a.fecha_ingreso,
       a.bultos_inicial,
       coalesce(-sum(m.bultos) filter (where m.tipo = 'SALIDA'), 0)::integer as bultos_despachados,
       (a.bultos_inicial + coalesce(sum(m.bultos), 0))::integer             as stock_actual,
       max(m.fecha) filter (where m.tipo = 'SALIDA')                         as ultimo_retiro
from referencia r
join ref_almacenaje a on a.referencia_id = r.id
join expediente e on e.id = r.expediente_id
left join movimiento_stock m on m.referencia_id = r.id
group by r.id, a.referencia_id, e.cliente_id;

-- Profit en USD (tipo_cambio = soles por dólar).
create view v_profit_expediente with (security_invoker = true) as
select expediente_id,
       sum(case when tipo in ('VENTA', 'VENTA_EXTRA', 'REEMBOLSO') then 1 else -1 end
           * cantidad * valor_unitario
           * case when moneda = 'PEN' then 1 / tipo_cambio else 1 end)::numeric(14,2) as profit_usd
from movimiento_economico
where estado <> 'anulado'
group by expediente_id;

-- Avance de cada referencia: etapa actual, posición en el flujo y horas en la etapa.
create view v_referencia_avance with (security_invoker = true) as
select r.id,
       r.expediente_id,
       r.tipo,
       r.codigo,
       r.estado,
       r.responsable_id,
       r.visible_cliente,
       et.id      as etapa_id,
       et.nombre  as etapa,
       et.orden   as etapa_orden,
       (select count(*) from etapa x where x.tipo = r.tipo)::integer as total_etapas,
       et.horas_estandar,
       re.inicio  as etapa_desde,
       round(extract(epoch from now() - re.inicio) / 3600, 1) as horas_en_etapa
from referencia r
left join etapa et on et.id = r.etapa_id
left join referencia_etapa re on re.referencia_id = r.id and re.fin is null;

-- Alertas vigentes. Cada fila: tipo, severidad, mensaje, enlace y a quién le toca.
create view v_alerta with (security_invoker = true) as
-- Tareas vencidas
select 'tarea_vencida'::text as tipo, 'alta'::text as severidad,
       'Tarea vencida: ' || t.titulo as mensaje,
       '/expedientes/' || t.expediente_id as enlace,
       t.expediente_id, t.referencia_id, t.asignado_a as usuario_id, t.vence_en as fecha
from tarea t
where t.estado in ('pendiente', 'en_proceso') and t.vence_en < now()
union all
-- Vencimiento de memo / días libres en los próximos 3 días
select 'vencimiento_memo', case when c.vencimiento_memo < current_date then 'alta' else 'media' end,
       r.codigo || ': vence memo el ' || to_char(c.vencimiento_memo, 'DD/MM'),
       '/referencias/' || r.id, r.expediente_id, r.id, r.responsable_id, c.vencimiento_memo::timestamptz
from referencia r join ref_carga c on c.referencia_id = r.id
where r.estado = 'activa' and c.vencimiento_memo <= current_date + 3
union all
-- Plazos de duda razonable
select 'duda_razonable', case when d.plazo_respuesta < current_date then 'alta' else 'media' end,
       r.codigo || ': duda razonable vence el ' || to_char(d.plazo_respuesta, 'DD/MM'),
       '/referencias/' || r.id, r.expediente_id, r.id, r.responsable_id, d.plazo_respuesta::timestamptz
from duda_razonable d join referencia r on r.id = d.referencia_id
where d.estado = 'abierta' and d.plazo_respuesta <= current_date + 2
union all
-- Etapas que superan su tiempo estándar
select 'etapa_demorada', 'media',
       a.codigo || ': ' || a.horas_en_etapa || ' h en "' || a.etapa || '" (estándar ' || a.horas_estandar || ' h)',
       '/referencias/' || a.id, a.expediente_id, a.id, a.responsable_id, a.etapa_desde
from v_referencia_avance a
where a.estado = 'activa' and a.horas_estandar is not null and a.horas_en_etapa > a.horas_estandar
union all
-- Documentos observados o rechazados
select 'documento_observado', 'media',
       r.codigo || ': documento ' || td.nombre || ' ' || d.estado,
       '/referencias/' || r.id, d.expediente_id, r.id, r.responsable_id, d.validado_en
from documento d
join referencia r on r.id = d.referencia_id
join tipo_documento td on td.codigo = d.tipo_documento
where d.estado in ('observado', 'rechazado') and r.estado = 'activa'
union all
-- Solicitudes de pago por aprobar
select 'pago_por_aprobar', 'media',
       'Pago por aprobar: ' || s.concepto || ' (' || s.moneda || ' ' || s.monto || ')',
       '/pagos', s.expediente_id, s.referencia_id, null::uuid, s.creado_en
from solicitud_pago s
where s.estado = 'solicitada';

-- ===================== migrations/20261127000002_seguridad.sql =====================
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

-- ===================== migrations/20261127000003_almacenamiento.sql =====================
-- MarsLogistics · Bucket privado para documentos (BL, DAM, facturas, GRE, actas...).
-- Ruta de cada archivo: <expediente_id>/<referencia_id o "general">/<marca de tiempo>-<nombre>.
-- Solo el personal con permiso de escritura sube y borra archivos. Las descargas
-- se hacen con URLs firmadas que genera el servidor tras comprobar, con RLS,
-- que el usuario puede ver la fila de `documento`.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists documentos_lectura_interna on storage.objects;
drop policy if exists documentos_subida on storage.objects;
drop policy if exists documentos_borrado on storage.objects;

create policy documentos_lectura_interna on storage.objects for select
  using (bucket_id = 'documentos' and public.es_interno());

create policy documentos_subida on storage.objects for insert
  with check (bucket_id = 'documentos' and public.puede_escribir());

create policy documentos_borrado on storage.objects for delete
  using (bucket_id = 'documentos' and public.puede_escribir());

-- ===================== migrations/20261127000004_contabilidad.sql =====================
-- MarsLogistics · Costeo, comprobantes e impuestos.
--
-- * COSTEO PROYECTADO: `movimiento_economico` (lo que se cotizó o presupuestó por concepto).
-- * COSTEO REAL: líneas de comprobantes RECIBIDOS (costo) y EMITIDOS (venta), cada línea
--   imputada a un expediente y, si se quiere, a una referencia. Notas de crédito restan.
-- * Impuestos por comprobante: IGV (por línea según afectación), ISC, detracción (en soles,
--   según tipo de servicio), retención y percepción.
-- * Emisión: el comprobante emitido nace en borrador; Finanzas lo emite y recibe su número de
--   la serie. El envío a SUNAT se hace por un OSE/PSE (pendiente de conectar); aquí quedan
--   los campos de respuesta (estado SUNAT, enlaces a PDF/XML/CDR).

create type sentido_comprobante as enum ('EMITIDO', 'RECIBIDO');
create type tipo_comprobante as enum (
  'FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'RECIBO_HONORARIOS', 'LIQUIDACION_COMPRA', 'DAM', 'TICKET', 'OTRO'
);
create type estado_comprobante as enum ('borrador', 'emitido', 'aceptado_sunat', 'rechazado_sunat', 'registrado', 'anulado');
create type afectacion_igv as enum ('GRAVADO', 'EXONERADO', 'INAFECTO', 'EXPORTACION');

-- Código SUNAT (tabla 10) de cada tipo.
create or replace function codigo_sunat(t tipo_comprobante) returns text
language sql immutable as $$
  select case t when 'FACTURA' then '01' when 'BOLETA' then '03' when 'NOTA_CREDITO' then '07'
                when 'NOTA_DEBITO' then '08' when 'RECIBO_HONORARIOS' then '02' when 'LIQUIDACION_COMPRA' then '04'
                when 'DAM' then '50' when 'TICKET' then '12' else '00' end
$$;

create table serie_comprobante (
  id             bigint generated always as identity primary key,
  tipo           tipo_comprobante not null,
  serie          text not null,
  ultimo_numero  integer not null default 0,
  activo         boolean not null default true,
  unique (tipo, serie)
);

-- Tipos de detracción (SPOT). Porcentajes referenciales: validarlos con contabilidad.
create table detraccion_tipo (
  codigo            text primary key,
  descripcion       text not null,
  porcentaje        numeric(5,2) not null,
  monto_minimo_pen  numeric(14,2) not null default 700,
  activo            boolean not null default true
);

create table comprobante (
  id                        bigint generated always as identity primary key,
  sentido                   sentido_comprobante not null,
  tipo                      tipo_comprobante not null,
  serie                     text,
  numero                    text,
  fecha_emision             date not null default current_date,
  fecha_vencimiento         date,
  periodo                   text,                                   -- AAAA-MM contable
  cliente_id                bigint references cliente (id),          -- si es EMITIDO
  proveedor_id              bigint references proveedor (id),        -- si es RECIBIDO
  ruc_contraparte           text,
  razon_social_contraparte  text,
  expediente_id             bigint references expediente (id),       -- expediente principal (las líneas pueden repartir)
  moneda                    moneda not null default 'USD',
  tipo_cambio               numeric(10,4) not null default 1 check (tipo_cambio > 0),  -- soles por dólar
  igv_porcentaje            numeric(5,2) not null default 18,
  forma_pago                text not null default 'CREDITO' check (forma_pago in ('CONTADO', 'CREDITO')),
  base_gravada              numeric(14,2) not null default 0,
  base_exonerada            numeric(14,2) not null default 0,
  base_inafecta             numeric(14,2) not null default 0,
  base_exportacion          numeric(14,2) not null default 0,
  isc                       numeric(14,2) not null default 0,
  igv                       numeric(14,2) not null default 0,
  otros_tributos            numeric(14,2) not null default 0,
  total                     numeric(14,2) not null default 0,
  detraccion_codigo         text references detraccion_tipo (codigo),
  detraccion_porcentaje     numeric(5,2),
  detraccion_monto_pen      numeric(14,2) not null default 0,        -- la detracción se deposita en soles
  detraccion_constancia     text,
  detraccion_fecha          date,
  retencion_monto           numeric(14,2) not null default 0,
  percepcion_monto          numeric(14,2) not null default 0,
  neto_a_pagar              numeric(14,2) not null default 0,        -- total − detracción − retención + percepción (en la moneda)
  comprobante_ref_id        bigint references comprobante (id),      -- para notas de crédito / débito
  motivo_nota               text,
  estado                    estado_comprobante not null default 'borrador',
  sunat_mensaje             text,
  enlace_pdf                text,
  enlace_xml                text,
  enlace_cdr                text,
  documento_id              bigint references documento (id) on delete set null,  -- archivo escaneado del recibido
  observacion               text,
  creado_por                uuid default auth.uid() references perfil (id),
  creado_en                 timestamptz not null default now(),
  check (tipo not in ('NOTA_CREDITO', 'NOTA_DEBITO') or comprobante_ref_id is not null)
);
create unique index comprobante_emitido_unico on comprobante (tipo, serie, numero)
  where sentido = 'EMITIDO' and numero is not null;
create unique index comprobante_recibido_unico on comprobante (ruc_contraparte, tipo, serie, numero)
  where sentido = 'RECIBIDO' and numero is not null and estado <> 'anulado';
create index comprobante_expediente_idx on comprobante (expediente_id);
create index comprobante_periodo_idx on comprobante (periodo, sentido);

create table comprobante_linea (
  id              bigint generated always as identity primary key,
  comprobante_id  bigint not null references comprobante (id) on delete cascade,
  concepto_id     bigint references concepto (id),
  descripcion     text not null,
  unidad          text not null default 'ZZ',     -- ZZ servicio, NIU unidad
  cantidad        numeric(14,3) not null default 1 check (cantidad > 0),
  valor_unitario  numeric(14,4) not null check (valor_unitario >= 0),   -- sin IGV
  afectacion      afectacion_igv not null default 'GRAVADO',
  isc             numeric(14,2) not null default 0,
  subtotal        numeric(14,2) not null default 0,
  igv             numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  expediente_id   bigint references expediente (id),
  referencia_id   bigint references referencia (id) on delete set null
);
create index comprobante_linea_comp_idx on comprobante_linea (comprobante_id);
create index comprobante_linea_exp_idx on comprobante_linea (expediente_id);

-- Pagos (a proveedores) y cobros (de clientes) aplicados a un comprobante.
create table pago_comprobante (
  id                 bigint generated always as identity primary key,
  comprobante_id     bigint not null references comprobante (id) on delete cascade,
  fecha              date not null default current_date,
  monto              numeric(14,2) not null check (monto > 0),
  moneda             moneda not null,
  tipo_cambio        numeric(10,4) not null default 1 check (tipo_cambio > 0),
  medio              text not null default 'TRANSFERENCIA'
                       check (medio in ('TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'TARJETA', 'DETRACCION', 'RETENCION', 'OTRO')),
  numero_operacion   text,
  cuenta             text,
  solicitud_pago_id  bigint references solicitud_pago (id) on delete set null,
  observacion        text,
  creado_por         uuid default auth.uid() references perfil (id),
  creado_en          timestamptz not null default now()
);
create index pago_comprobante_comp_idx on pago_comprobante (comprobante_id);

alter table solicitud_pago add column comprobante_id bigint references comprobante (id) on delete set null;

-- =====================================================================
-- Cálculos
-- =====================================================================

-- Línea: subtotal, IGV según afectación y total. Hereda el expediente del comprobante.
create or replace function comprobante_linea_calcular() returns trigger
language plpgsql as $$
declare
  v_pct numeric;
  v_exp bigint;
  v_estado estado_comprobante;
begin
  select igv_porcentaje, expediente_id, estado into v_pct, v_exp, v_estado
    from comprobante where id = coalesce(new.comprobante_id, old.comprobante_id);
  if v_estado not in ('borrador', 'registrado') then
    raise exception 'El comprobante ya fue emitido: corrige con una nota de crédito o débito';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.expediente_id := coalesce(new.expediente_id, v_exp);
  if new.referencia_id is not null and new.expediente_id is null then
    select expediente_id into new.expediente_id from referencia where id = new.referencia_id;
  end if;
  new.subtotal := round(new.cantidad * new.valor_unitario, 2);
  new.igv := case when new.afectacion = 'GRAVADO' then round((new.subtotal + new.isc) * v_pct / 100, 2) else 0 end;
  new.total := new.subtotal + new.isc + new.igv;
  return new;
end $$;
create trigger comprobante_linea_calcular before insert or update or delete on comprobante_linea
  for each row execute function comprobante_linea_calcular();

-- Totales e impuestos de cabecera a partir de las líneas.
create or replace function comprobante_recalcular(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update comprobante c set
    base_gravada     = coalesce(l.gravada, 0),
    base_exonerada   = coalesce(l.exonerada, 0),
    base_inafecta    = coalesce(l.inafecta, 0),
    base_exportacion = coalesce(l.exportacion, 0),
    isc              = coalesce(l.isc, 0),
    igv              = coalesce(l.igv, 0),
    total            = coalesce(l.total, 0) + c.otros_tributos
  from (select sum(subtotal) filter (where afectacion = 'GRAVADO')     as gravada,
               sum(subtotal) filter (where afectacion = 'EXONERADO')   as exonerada,
               sum(subtotal) filter (where afectacion = 'INAFECTO')    as inafecta,
               sum(subtotal) filter (where afectacion = 'EXPORTACION') as exportacion,
               sum(isc) as isc, sum(igv) as igv, sum(total) as total
          from comprobante_linea where comprobante_id = p_id) l
  where c.id = p_id;
end $$;
revoke execute on function comprobante_recalcular(bigint) from public, anon, authenticated;

create or replace function comprobante_linea_totalizar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform comprobante_recalcular(coalesce(new.comprobante_id, old.comprobante_id));
  return null;
end $$;
create trigger comprobante_linea_totalizar after insert or update or delete on comprobante_linea
  for each row execute function comprobante_linea_totalizar();

-- Cabecera: periodo, detracción, neto a pagar, numeración al emitir y control de permisos.
create or replace function comprobante_controlar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pct numeric;
  v_min numeric;
  v_total_pen numeric;
  v_num integer;
begin
  new.periodo := coalesce(new.periodo, to_char(new.fecha_emision, 'YYYY-MM'));
  if new.sentido = 'EMITIDO' then
    select ruc, razon_social into new.ruc_contraparte, new.razon_social_contraparte
      from cliente where id = new.cliente_id and new.ruc_contraparte is null;
  else
    select ruc, razon_social into new.ruc_contraparte, new.razon_social_contraparte
      from proveedor where id = new.proveedor_id and new.ruc_contraparte is null;
  end if;

  -- Detracción en soles, redondeada al entero, si supera el mínimo.
  if new.detraccion_codigo is not null then
    select porcentaje, monto_minimo_pen into v_pct, v_min from detraccion_tipo where codigo = new.detraccion_codigo;
    new.detraccion_porcentaje := coalesce(new.detraccion_porcentaje, v_pct);
    v_total_pen := new.total * case when new.moneda = 'USD' then new.tipo_cambio else 1 end;
    new.detraccion_monto_pen := case when v_total_pen > v_min then round(v_total_pen * new.detraccion_porcentaje / 100, 0) else 0 end;
  else
    new.detraccion_porcentaje := null;
    new.detraccion_monto_pen := 0;
  end if;
  new.neto_a_pagar := new.total
    - new.detraccion_monto_pen / case when new.moneda = 'USD' then new.tipo_cambio else 1 end
    - new.retencion_monto + new.percepcion_monto;

  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if new.sentido = 'EMITIDO' and auth.uid() is not null and not es_finanzas() then
      raise exception 'Solo finanzas emite o anula comprobantes';
    end if;
    if old.estado = 'anulado' then raise exception 'Un comprobante anulado no se reactiva'; end if;
    -- Al emitir: número correlativo de la serie.
    if new.sentido = 'EMITIDO' and old.estado = 'borrador' and new.estado = 'emitido' then
      if new.total <= 0 then raise exception 'El comprobante no tiene importe'; end if;
      if new.numero is null then
        update serie_comprobante set ultimo_numero = ultimo_numero + 1
         where tipo = new.tipo and serie = new.serie and activo
         returning ultimo_numero into v_num;
        if v_num is null then raise exception 'La serie % no está habilitada para %', new.serie, new.tipo; end if;
        new.numero := lpad(v_num::text, 8, '0');
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger comprobante_controlar before insert or update on comprobante
  for each row execute function comprobante_controlar();

-- Lo emitido no se borra: se anula o se corrige con una nota.
create or replace function comprobante_no_borrar() returns trigger
language plpgsql as $$
begin
  if old.sentido = 'EMITIDO' and old.estado <> 'borrador' then
    raise exception 'Un comprobante emitido no se elimina: anúlalo o emite una nota de crédito';
  end if;
  return old;
end $$;
create trigger comprobante_no_borrar before delete on comprobante
  for each row execute function comprobante_no_borrar();

-- Los pagos y cobros solo los registra Finanzas (también desde una solicitud aprobada).
create or replace function pago_comprobante_controlar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not puede_aprobar_pagos() then
    raise exception 'Solo finanzas registra pagos y cobros';
  end if;
  if new.solicitud_pago_id is not null then
    update solicitud_pago set estado = 'pagada', comprobante_id = new.comprobante_id
     where id = new.solicitud_pago_id and estado = 'aprobada';
  end if;
  return new;
end $$;
create trigger pago_comprobante_controlar before insert on pago_comprobante
  for each row execute function pago_comprobante_controlar();

-- =====================================================================
-- Vistas: saldos, costeo y registros de compras y ventas
-- =====================================================================
create or replace function signo_comprobante(t tipo_comprobante) returns integer
language sql immutable as $$ select case when t = 'NOTA_CREDITO' then -1 else 1 end $$;

-- Saldo por cobrar / pagar: neto − pagos − notas de crédito aplicadas (en la moneda del comprobante).
create view v_saldo_comprobante with (security_invoker = true) as
with pagos as (
  select p.comprobante_id,
         sum(p.monto * case when p.moneda = c.moneda then 1
                            when p.moneda = 'PEN' then 1 / p.tipo_cambio else p.tipo_cambio end)
           filter (where p.medio <> 'DETRACCION') as pagado,
         bool_or(p.medio = 'DETRACCION') as detraccion_pagada
  from pago_comprobante p join comprobante c on c.id = p.comprobante_id
  group by p.comprobante_id
), notas as (
  select comprobante_ref_id as comprobante_id, sum(total) as credito
  from comprobante where tipo = 'NOTA_CREDITO' and estado <> 'anulado' and estado <> 'borrador'
  group by comprobante_ref_id
)
select c.id, c.sentido, c.tipo, c.serie, c.numero, c.fecha_emision, c.fecha_vencimiento, c.moneda,
       c.cliente_id, c.proveedor_id, c.razon_social_contraparte, c.expediente_id, c.estado,
       c.total, c.neto_a_pagar,
       coalesce(n.credito, 0)::numeric(14,2) as notas_credito,
       coalesce(p.pagado, 0)::numeric(14,2) as pagado,
       (c.neto_a_pagar - coalesce(n.credito, 0) - coalesce(p.pagado, 0))::numeric(14,2) as saldo,
       c.detraccion_monto_pen,
       (c.detraccion_monto_pen = 0 or coalesce(p.detraccion_pagada, false) or c.detraccion_constancia is not null)
         as detraccion_al_dia
from comprobante c
left join pagos p on p.comprobante_id = c.id
left join notas n on n.comprobante_id = c.id
where c.estado not in ('anulado', 'borrador') and c.tipo <> 'NOTA_CREDITO';

-- Costeo por referencia (o por expediente cuando la línea no tiene referencia), en USD.
create view v_costeo with (security_invoker = true) as
with proyectado as (
  select expediente_id, referencia_id,
         sum(case when tipo in ('COSTO', 'SOBRECOSTO') then cantidad * valor_unitario
                  * case when moneda = 'PEN' then 1 / tipo_cambio else 1 end else 0 end) as costo_proyectado,
         sum(case when tipo in ('VENTA', 'VENTA_EXTRA', 'REEMBOLSO') then cantidad * valor_unitario
                  * case when moneda = 'PEN' then 1 / tipo_cambio else 1 end else 0 end) as venta_proyectada
  from movimiento_economico where estado <> 'anulado'
  group by expediente_id, referencia_id
), real as (
  select l.expediente_id, l.referencia_id,
         sum(case when c.sentido = 'RECIBIDO' then signo_comprobante(c.tipo) * (l.subtotal + l.isc)
                  * case when c.moneda = 'PEN' then 1 / c.tipo_cambio else 1 end else 0 end) as costo_real,
         sum(case when c.sentido = 'EMITIDO' then signo_comprobante(c.tipo) * (l.subtotal + l.isc)
                  * case when c.moneda = 'PEN' then 1 / c.tipo_cambio else 1 end else 0 end) as venta_real
  from comprobante_linea l join comprobante c on c.id = l.comprobante_id
  where c.estado <> 'anulado' and (c.sentido = 'RECIBIDO' or c.estado <> 'borrador') and l.expediente_id is not null
  group by l.expediente_id, l.referencia_id
)
select coalesce(p.expediente_id, r.expediente_id) as expediente_id,
       coalesce(p.referencia_id, r.referencia_id) as referencia_id,
       round(coalesce(p.costo_proyectado, 0), 2) as costo_proyectado_usd,
       round(coalesce(p.venta_proyectada, 0), 2) as venta_proyectada_usd,
       round(coalesce(r.costo_real, 0), 2)       as costo_real_usd,
       round(coalesce(r.venta_real, 0), 2)       as venta_real_usd,
       round(coalesce(p.venta_proyectada, 0) - coalesce(p.costo_proyectado, 0), 2) as margen_proyectado_usd,
       round(coalesce(r.venta_real, 0) - coalesce(r.costo_real, 0), 2)             as margen_real_usd
from proyectado p
full join real r on r.expediente_id = p.expediente_id and r.referencia_id is not distinct from p.referencia_id;

create view v_costeo_expediente with (security_invoker = true) as
select expediente_id,
       sum(costo_proyectado_usd) as costo_proyectado_usd,
       sum(venta_proyectada_usd) as venta_proyectada_usd,
       sum(costo_real_usd)       as costo_real_usd,
       sum(venta_real_usd)       as venta_real_usd,
       sum(margen_proyectado_usd) as margen_proyectado_usd,
       sum(margen_real_usd)       as margen_real_usd
from v_costeo group by expediente_id;

-- Formato base de los registros de ventas y compras (para exportar a contabilidad).
create view v_registro_contable with (security_invoker = true) as
select c.periodo, c.sentido, c.fecha_emision, c.fecha_vencimiento, codigo_sunat(c.tipo) as tipo_sunat, c.tipo,
       c.serie, c.numero, c.ruc_contraparte, c.razon_social_contraparte, c.moneda, c.tipo_cambio,
       signo_comprobante(c.tipo) * c.base_gravada as base_gravada,
       signo_comprobante(c.tipo) * (c.base_exonerada + c.base_inafecta + c.base_exportacion) as no_gravado,
       signo_comprobante(c.tipo) * c.isc as isc,
       signo_comprobante(c.tipo) * c.igv as igv,
       signo_comprobante(c.tipo) * c.otros_tributos as otros_tributos,
       signo_comprobante(c.tipo) * c.total as total,
       c.detraccion_codigo, c.detraccion_monto_pen, c.detraccion_constancia, c.detraccion_fecha,
       c.retencion_monto, c.percepcion_monto,
       r.tipo as ref_tipo, r.serie as ref_serie, r.numero as ref_numero, r.fecha_emision as ref_fecha,
       e.codigo as expediente, c.estado, c.id
from comprobante c
left join comprobante r on r.id = c.comprobante_ref_id
left join expediente e on e.id = c.expediente_id
where c.estado not in ('borrador');

-- =====================================================================
-- Permisos
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['serie_comprobante', 'detraccion_tipo', 'comprobante', 'comprobante_linea', 'pago_comprobante'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (puede_ver_costos())', t || '_lectura', t);
    execute format(
      'create trigger %I after insert or update or delete on %I for each row execute function registrar_cambio()',
      t || '_auditoria', t);
  end loop;
end $$;

create policy serie_comprobante_escritura on serie_comprobante for all using (es_finanzas()) with check (es_finanzas());
create policy detraccion_tipo_escritura on detraccion_tipo for all using (es_finanzas()) with check (es_finanzas());
-- Operaciones y aduanas registran comprobantes de proveedores y preparan borradores de venta;
-- emitir y anular es de finanzas (lo controla comprobante_controlar).
create policy comprobante_escritura on comprobante for all using (puede_ver_costos()) with check (puede_ver_costos());
create policy comprobante_linea_escritura on comprobante_linea for all using (puede_ver_costos()) with check (puede_ver_costos());
create policy pago_comprobante_escritura on pago_comprobante for all using (puede_aprobar_pagos()) with check (puede_aprobar_pagos());

-- ===================== seed.sql =====================
-- Datos iniciales: etapas por tipo de referencia, documentos requeridos, proveedores y conceptos
-- que ya usa la operación (planillas ORDENES / COSTOS). Las etapas y sus horas estándar se pueden
-- ajustar desde Configuración.
insert into proveedor (razon_social, nombre_corto, tipo) values
  ('MSC PERU', 'MSC', 'naviera'),
  ('MAERSK', 'MAERSK', 'naviera'),
  ('APM TERMINALS CALLAO', 'APMT', 'terminal'),
  ('SHARF', 'SHARF', 'agente_aduanas'),
  ('CONTRANS', 'CONTRANS', 'almacen'),
  ('MEDLOG', 'MEDLOG', 'deposito_vacios'),
  ('DEMARES', 'DEMARES', 'deposito_vacios'),
  ('TRANSPORTES MERIDIAN S.A.C.', 'MERIDIAN', 'transporte_local'),
  ('ZETRAMSA', 'ZETRAMSA', 'transporte_destino'),
  ('ALCONSA', 'ALCONSA', 'otro'),
  ('LATAM CARGO', 'LATAM', 'aerolinea')
on conflict do nothing;

insert into almacen (proveedor_id, nombre)
select id, 'CONTRANS' from proveedor where nombre_corto = 'CONTRANS'
on conflict do nothing;

insert into producto (codigo, descripcion, es_matpel, clase_onu, numero_onu, unidad_medida, unidad_bulto, peso_bulto_kg)
values ('NACN', 'CIANURO DE SODIO', true, '6.1', 'UN1689', 'TM', 'CAJA', 1100)
on conflict do nothing;

insert into concepto (nombre, tipo, etapa) values
  ('SERVICIO LOGISTICO', 'VENTA', 'general'),
  ('GASTOS ADMINISTRATIVOS', 'VENTA', 'general'),
  ('DIFERENCIAL CAMBIARIO', 'VENTA_EXTRA', 'general'),
  ('REEMBOLSO', 'REEMBOLSO', 'general'),
  ('EMISION DE BL', 'COSTO', 'transito'),
  ('THC', 'COSTO', 'puerto'),
  ('DESCARGA DIRECTA', 'COSTO', 'puerto'),
  ('USO DE AREA PUERTO', 'SOBRECOSTO', 'puerto'),
  ('GATE IN', 'COSTO', 'vacios'),
  ('REPROGRAMACION DE CITA', 'SOBRECOSTO', 'vacios'),
  ('COMISION ADUANAS', 'COSTO', 'aduana'),
  ('TRANSPORTE LOCAL', 'COSTO', 'puerto'),
  ('ALMACENAJE DS', 'COSTO', 'almacen'),
  ('ALMACENAJE SIN USO', 'SOBRECOSTO', 'almacen'),
  ('SEGURO DS', 'COSTO', 'almacen'),
  ('MANIPULEO - RECEPCION', 'COSTO', 'almacen'),
  ('MANIPULEO - DESPACHO', 'COSTO', 'almacen'),
  ('MONTACARGA', 'COSTO', 'almacen'),
  ('PLOTEO', 'COSTO', 'transporte'),
  ('TRANSPORTE A MINA', 'COSTO', 'transporte'),
  ('TRANSPORTE A MINA - SERVICIO ESPECIAL', 'COSTO', 'transporte')
on conflict do nothing;

-- Flujo de etapas por tipo de referencia (la última cierra la referencia).
insert into etapa (tipo, orden, codigo, nombre, horas_estandar, es_final) values
  ('CARGA_MARITIMA', 1, 'BOOKING', 'Booking', null, false),
  ('CARGA_MARITIMA', 2, 'RECOJO', 'Recojo en origen', null, false),
  ('CARGA_MARITIMA', 3, 'EMBARCADO', 'Embarcado / zarpe', null, false),
  ('CARGA_MARITIMA', 4, 'TRANSITO', 'En tránsito', null, false),
  ('CARGA_MARITIMA', 5, 'ARRIBO', 'Arribo', 48, false),
  ('CARGA_MARITIMA', 6, 'LIBERACION', 'Liberación (visto bueno y BL)', 24, false),
  ('CARGA_MARITIMA', 7, 'CERRADA', 'Cerrada', null, true),
  ('ADUANA', 1, 'RECEPCION_DOCS', 'Recepción de documentos', 24, false),
  ('ADUANA', 2, 'BORRADORES', 'Revisión y borradores', 24, false),
  ('ADUANA', 3, 'NUMERACION', 'Numeración DAM', 24, false),
  ('ADUANA', 4, 'PAGO', 'Pago de derechos', 24, false),
  ('ADUANA', 5, 'CANAL', 'Canal asignado', 8, false),
  ('ADUANA', 6, 'REVISION', 'Revisión física / documentaria', 48, false),
  ('ADUANA', 7, 'LEVANTE', 'Levante', 24, false),
  ('ADUANA', 8, 'RETIRO', 'Retiro autorizado', 48, false),
  ('ADUANA', 9, 'LIQUIDACION', 'Liquidación', 120, false),
  ('ADUANA', 10, 'CERRADA', 'Cerrada', null, true),
  ('TRANSPORTE', 1, 'SOLICITADO', 'Solicitado', 24, false),
  ('TRANSPORTE', 2, 'PROGRAMADO', 'Programado (unidad y conductor)', 24, false),
  ('TRANSPORTE', 3, 'EN_CARGA', 'En carga / retiro', 6, false),
  ('TRANSPORTE', 4, 'EN_RUTA', 'En ruta', null, false),
  ('TRANSPORTE', 5, 'ENTREGADO', 'Entregado', 48, false),
  ('TRANSPORTE', 6, 'CONFORMIDAD', 'Conformidad (guías firmadas)', null, false),
  ('TRANSPORTE', 7, 'CERRADO', 'Cerrado', null, true),
  ('ALMACENAJE', 1, 'INGRESO', 'Ingreso', 24, false),
  ('ALMACENAJE', 2, 'EN_ALMACEN', 'En almacén', null, false),
  ('ALMACENAJE', 3, 'RETIROS_PARCIALES', 'Retiros parciales', null, false),
  ('ALMACENAJE', 4, 'AGOTADO', 'Agotado', 120, false),
  ('ALMACENAJE', 5, 'LIQUIDADO', 'Liquidado', null, true),
  ('CARGA_AEREA', 1, 'BOOKING', 'Booking', null, false),
  ('CARGA_AEREA', 2, 'RECOJO', 'Recojo en origen', null, false),
  ('CARGA_AEREA', 3, 'EMBARCADO', 'Embarcado / zarpe', null, false),
  ('CARGA_AEREA', 4, 'TRANSITO', 'En tránsito', null, false),
  ('CARGA_AEREA', 5, 'ARRIBO', 'Arribo', 48, false),
  ('CARGA_AEREA', 6, 'LIBERACION', 'Liberación (visto bueno y BL)', 24, false),
  ('CARGA_AEREA', 7, 'CERRADA', 'Cerrada', null, true)
on conflict do nothing;

insert into tipo_documento (codigo, nombre) values
  ('FACTURA', 'Factura comercial'),
  ('PACKING', 'Packing list'),
  ('BL', 'Bill of lading (BL)'),
  ('AWB', 'Guía aérea (AWB)'),
  ('POLIZA', 'Póliza de seguro'),
  ('CERT_ORIGEN', 'Certificado de origen'),
  ('MSDS', 'Hoja de seguridad (MSDS)'),
  ('VISTO_BUENO', 'Visto bueno / volante'),
  ('DAM', 'DAM numerada'),
  ('LIQ_TRIBUTOS', 'Liquidación de tributos'),
  ('LEVANTE', 'Constancia de levante'),
  ('NOTIF_DUDA', 'Notificación de duda razonable'),
  ('LIQ_AGENTE', 'Liquidación del agente de aduanas'),
  ('GRE_REMITENTE', 'GRE remitente'),
  ('GRE_TRANSPORTISTA', 'GRE transportista'),
  ('CONFORMIDAD', 'Conformidad de entrega'),
  ('TICKET_INGRESO', 'Ticket / acta de ingreso a almacén'),
  ('ACTA_INSPECCION', 'Acta de inspección'),
  ('EIR', 'EIR de devolución de vacío'),
  ('COMPROBANTE', 'Comprobante de pago'),
  ('OTRO', 'Otro')
on conflict do nothing;

-- Documentos que pide cada tipo de referencia y desde qué etapa.
insert into documento_requerido (tipo, tipo_documento, desde_etapa_id, obligatorio)
select x.tipo::tipo_referencia, x.doc, et.id, x.obligatorio
from (values
  ('CARGA_MARITIMA', 'BL', 'ARRIBO', true),
  ('CARGA_MARITIMA', 'VISTO_BUENO', 'LIBERACION', true),
  ('CARGA_AEREA', 'AWB', 'ARRIBO', true),
  ('ADUANA', 'FACTURA', 'RECEPCION_DOCS', true),
  ('ADUANA', 'PACKING', 'RECEPCION_DOCS', true),
  ('ADUANA', 'BL', 'RECEPCION_DOCS', true),
  ('ADUANA', 'POLIZA', 'RECEPCION_DOCS', true),
  ('ADUANA', 'CERT_ORIGEN', 'RECEPCION_DOCS', false),
  ('ADUANA', 'DAM', 'NUMERACION', true),
  ('ADUANA', 'LIQ_TRIBUTOS', 'PAGO', true),
  ('ADUANA', 'LEVANTE', 'LEVANTE', true),
  ('ADUANA', 'LIQ_AGENTE', 'LIQUIDACION', true),
  ('TRANSPORTE', 'GRE_REMITENTE', 'EN_RUTA', true),
  ('TRANSPORTE', 'GRE_TRANSPORTISTA', 'EN_RUTA', true),
  ('TRANSPORTE', 'CONFORMIDAD', 'CONFORMIDAD', true),
  ('ALMACENAJE', 'TICKET_INGRESO', 'INGRESO', true)
) as x(tipo, doc, etapa, obligatorio)
join etapa et on et.tipo = x.tipo::tipo_referencia and et.codigo = x.etapa
on conflict do nothing;

-- Series de comprobantes propios (ajustarlas a las autorizadas en SUNAT).
insert into serie_comprobante (tipo, serie) values
  ('FACTURA', 'F001'), ('BOLETA', 'B001'), ('NOTA_CREDITO', 'FC01'), ('NOTA_DEBITO', 'FD01')
on conflict do nothing;

-- Detracciones (SPOT) más usadas en servicios logísticos. Porcentajes referenciales: validar con contabilidad.
insert into detraccion_tipo (codigo, descripcion, porcentaje, monto_minimo_pen) values
  ('027', 'Servicio de transporte de carga', 4, 400),
  ('022', 'Otros servicios empresariales', 12, 700),
  ('037', 'Demás servicios gravados con el IGV', 12, 700),
  ('012', 'Intermediación laboral y tercerización', 12, 700),
  ('019', 'Arrendamiento de bienes', 10, 700)
on conflict do nothing;

-- Vuelve a ser administrador (cambia el correo y ejecuta solo esta línea):
-- update perfil set rol = 'admin', activo = true where email = 'tu-correo@ejemplo.com';
