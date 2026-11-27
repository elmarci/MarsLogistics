-- MarsLogistics · Esquema base Fase 1
-- Maestros, órdenes de importación, tránsito, aduana, puerto/vacíos, almacén,
-- transporte a destino, costos/ventas, incidencias y documentos.

create extension if not exists pgcrypto;

-- =====================================================================
-- PERFILES Y SEGURIDAD
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

-- Un perfil por usuario de Supabase Auth. Los usuarios de rol 'cliente' quedan
-- atados a un cliente y solo ven la información de ese cliente.
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
  'naviera', 'agente_aduanas', 'almacen', 'terminal', 'deposito_vacios',
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
  proveedor_id   bigint references proveedor (id),  -- null = tarifa de venta
  cliente_id     bigint references cliente (id),
  sede_id        bigint references sede_cliente (id),
  unidad         text not null,                       -- TM, CTN, DIA, VIAJE, SERVICIO
  moneda         moneda not null,
  precio         numeric(14,4) not null,
  minimo         numeric(14,4),
  vigente_desde  date not null,
  vigente_hasta  date,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- =====================================================================
-- ÓRDENES DE IMPORTACIÓN
-- =====================================================================
create type estado_orden as enum (
  'abierta', 'en_transito', 'en_aduana', 'en_puerto', 'en_almacen',
  'en_despacho', 'liquidacion', 'cerrada', 'anulada'
);

create table orden (
  id               bigint generated always as identity primary key,
  codigo           text not null unique,            -- SLI250148
  cliente_id       bigint not null references cliente (id),
  sede_destino_id  bigint references sede_cliente (id),
  ref_cliente      text,
  ref_agente       text,
  regimen          text not null default 'IMPORTACION' check (regimen in ('IMPORTACION', 'EXPORTACION')),
  producto_id      bigint references producto (id),
  cantidad         numeric(14,3),
  unidad_medida    text not null default 'TM',
  bultos           integer,
  incoterm         text,
  estado           estado_orden not null default 'abierta',
  fecha_recepcion  date,
  fecha_apertura   date not null default current_date,
  fecha_cierre     date,
  observaciones    text,
  creado_en        timestamptz not null default now()
);
create index orden_cliente_idx on orden (cliente_id);
create index orden_estado_idx on orden (estado);

create table embarque (
  id                bigint generated always as identity primary key,
  orden_id          bigint not null references orden (id) on delete cascade,
  naviera_id        bigint references proveedor (id),
  terminal_id       bigint references proveedor (id),
  tipo_transporte   text not null default 'MARITIMO',
  condicion         text not null default 'FCL' check (condicion in ('FCL', 'LCL')),
  mbl               text,
  hbl               text,
  manifiesto        text,
  puerto_origen     text,
  puerto_destino    text not null default 'CALLAO',
  etd               date,
  eta               date,
  fecha_llegada     date,
  dias_libres       integer,
  vencimiento_memo  date
);
create index embarque_orden_idx on embarque (orden_id);

create type estado_contenedor as enum ('en_transito', 'en_puerto', 'retirado', 'en_almacen', 'vaciado', 'devuelto');

create table contenedor (
  id                      bigint generated always as identity primary key,
  embarque_id             bigint not null references embarque (id) on delete cascade,
  numero                  text not null,
  tamano                  text not null default '20',
  tipo                    text not null default 'DRY',
  precinto                text,
  peso_bruto_kg           numeric(14,3),
  bultos                  integer,
  transporte_local_id     bigint references proveedor (id),
  hora_descarga           timestamptz,
  hora_cita               timestamptz,
  hora_retiro             timestamptz,
  perdida_cita_puerto     boolean not null default false,
  uso_area_puerto         boolean not null default false,
  fecha_ingreso_almacen   timestamptz,
  fecha_apertura_almacen  date,
  deposito_vacio_id       bigint references proveedor (id),
  cita_vacio              timestamptz,
  fecha_devolucion_vacio  timestamptz,
  perdida_cita_vacio      boolean not null default false,
  estado                  estado_contenedor not null default 'en_transito',
  unique (embarque_id, numero)
);

create type canal_aduanero as enum ('VERDE', 'NARANJA', 'ROJO');
create type estado_aduana as enum ('pendiente', 'numerado', 'en_revision', 'liberado');

create table despacho_aduanero (
  id                   bigint generated always as identity primary key,
  orden_id             bigint not null references orden (id) on delete cascade,
  agente_id            bigint references proveedor (id),
  dam                  text,
  fecha_envio_docs     date,
  fecha_borradores     date,
  fecha_numeracion     timestamptz,
  fecha_pago_derechos  date,
  fecha_levante        timestamptz,
  canal                canal_aduanero,
  invoice              text,
  valor_fob            numeric(14,2),
  valor_cif            numeric(14,2),
  estado               estado_aduana not null default 'pendiente'
);
create index despacho_aduanero_orden_idx on despacho_aduanero (orden_id);

create table duda_razonable (
  id                    bigint generated always as identity primary key,
  despacho_aduanero_id  bigint not null references despacho_aduanero (id) on delete cascade,
  numero_notificacion   text,
  descripcion           text,
  fecha_emision         date,
  fecha_recepcion       date,
  plazo_respuesta       date,
  garantia              text,
  estado                text not null default 'abierta' check (estado in ('abierta', 'respondida', 'cerrada'))
);

-- =====================================================================
-- ALMACÉN
-- =====================================================================
create table almacen (
  id              bigint generated always as identity primary key,
  proveedor_id    bigint references proveedor (id),
  nombre          text not null unique,
  m2_contratados  numeric(10,2),
  activo          boolean not null default true
);

create table lote (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,
  orden_id        bigint not null references orden (id),
  almacen_id      bigint not null references almacen (id),
  producto_id     bigint references producto (id),
  fecha_ingreso   date not null,
  bultos_inicial  integer not null check (bultos_inicial >= 0),
  ubicacion       text,
  observaciones   text
);
create index lote_orden_idx on lote (orden_id);

-- =====================================================================
-- TRANSPORTE A DESTINO
-- =====================================================================
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

create type estado_despacho as enum ('programado', 'en_transito', 'entregado', 'anulado');

-- Una fila por unidad (tracto) en ruta; varias filas comparten el mismo código Bxxxx.
create table despacho (
  id                       bigint generated always as identity primary key,
  codigo                   text not null,
  orden_id                 bigint references orden (id),
  lote_id                  bigint references lote (id),
  sede_destino_id          bigint not null references sede_cliente (id),
  transportista_id         bigint not null references proveedor (id),
  tracto_id                bigint references vehiculo (id),
  carreta_id               bigint references vehiculo (id),
  conductor_id             bigint references personal_transporte (id),
  bultos                   integer not null check (bultos > 0),
  precinto                 text,
  gre_remitente            text,
  gre_transportista        text,
  fecha_programada         date,
  reprogramado             boolean not null default false,
  salida_punto_carga       timestamptz,
  llegada_destino          timestamptz,
  salida_destino           timestamptz,
  servicio_especial        boolean not null default false,
  horas_servicio_especial  numeric(6,2),
  turno                    text,
  condicion_clima          text,
  motivo_retraso           text,
  estado                   estado_despacho not null default 'programado'
);
create index despacho_codigo_idx on despacho (codigo);
create index despacho_lote_idx on despacho (lote_id);

-- Kardex. El stock de un lote es bultos_inicial + suma de movimientos.
create table movimiento_stock (
  id           bigint generated always as identity primary key,
  lote_id      bigint not null references lote (id) on delete cascade,
  tipo         text not null check (tipo in ('SALIDA', 'AJUSTE')),
  bultos       integer not null check (bultos <> 0),  -- negativo = sale del almacén
  despacho_id  bigint references despacho (id) on delete set null,
  fecha        timestamptz not null default now(),
  usuario_id   uuid default auth.uid(),
  observacion  text
);
create index movimiento_stock_lote_idx on movimiento_stock (lote_id);

-- =====================================================================
-- COSTOS Y VENTAS
-- =====================================================================
create type estado_movimiento_economico as enum ('pendiente', 'facturado', 'pagado', 'anulado');

create table movimiento_economico (
  id                   bigint generated always as identity primary key,
  orden_id             bigint not null references orden (id),
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
  numero_liquidacion   text,
  fecha_comprobante    date,
  fecha_vencimiento    date,
  fecha_pago           date,
  periodo              text,
  estado               estado_movimiento_economico not null default 'pendiente',
  creado_en            timestamptz not null default now()
);
create index movimiento_economico_orden_idx on movimiento_economico (orden_id);

-- =====================================================================
-- INCIDENCIAS Y DOCUMENTOS
-- =====================================================================
create table incidencia (
  id                   bigint generated always as identity primary key,
  codigo               text unique,
  contexto             text,
  orden_id             bigint references orden (id),
  despacho_id          bigint references despacho (id),
  proveedor_id         bigint references proveedor (id),
  descripcion          text not null,
  fecha                date not null default current_date,
  medidas_correctivas  text,
  estado               text not null default 'activa' check (estado in ('activa', 'cerrada'))
);

create table documento (
  id                bigint generated always as identity primary key,
  orden_id          bigint references orden (id) on delete cascade,
  entidad           text not null,     -- orden, contenedor, despacho, proveedor, incidencia
  entidad_id        bigint not null,
  tipo              text not null,     -- BL, FACTURA, PACKING_LIST, DAM, GRE, ACTA, CERTIFICADO...
  nombre_archivo    text not null,
  ruta_storage      text not null,
  visible_cliente   boolean not null default false,
  vencimiento       date,
  subido_por        uuid default auth.uid(),
  creado_en         timestamptz not null default now()
);
create index documento_entidad_idx on documento (entidad, entidad_id);

-- =====================================================================
-- VISTAS
-- =====================================================================
create view v_stock_lote with (security_invoker = true) as
select l.id,
       l.codigo,
       l.orden_id,
       o.cliente_id,
       l.almacen_id,
       l.fecha_ingreso,
       l.bultos_inicial,
       coalesce(-sum(m.bultos) filter (where m.tipo = 'SALIDA'), 0)::integer as bultos_despachados,
       (l.bultos_inicial + coalesce(sum(m.bultos), 0))::integer             as stock_actual,
       max(m.fecha) filter (where m.tipo = 'SALIDA')                         as ultimo_despacho
from lote l
join orden o on o.id = l.orden_id
left join movimiento_stock m on m.lote_id = l.id
group by l.id, o.cliente_id;

-- Profit en USD: ventas, ventas extra y reembolsos suman; costos y sobrecostos restan.
-- Un sobrecosto que asume el cliente se compensa con su REEMBOLSO.
-- tipo_cambio = soles por dólar.
create view v_profit_orden with (security_invoker = true) as
select orden_id,
       sum(case when tipo in ('VENTA', 'VENTA_EXTRA', 'REEMBOLSO') then 1 else -1 end
           * cantidad * valor_unitario
           * case when moneda = 'PEN' then 1 / tipo_cambio else 1 end)::numeric(14,2) as profit_usd
from movimiento_economico
where estado <> 'anulado'
group by orden_id;
