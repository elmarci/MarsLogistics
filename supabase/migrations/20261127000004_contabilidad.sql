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
