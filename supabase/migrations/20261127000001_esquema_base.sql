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
