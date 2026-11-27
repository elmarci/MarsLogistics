-- Prueba de permisos y automatizaciones del modelo expediente → referencias.
\set ON_ERROR_STOP on
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

insert into cliente (razon_social) values ('MINERA A'), ('MINERA B');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'ops@mac.pe'),
  ('00000000-0000-0000-0000-000000000002', 'cliente.a@minera.pe'),
  ('00000000-0000-0000-0000-000000000003', 'nuevo@x.pe'),
  ('00000000-0000-0000-0000-000000000004', 'ana.finanzas@mac.pe');
update perfil set rol = 'operaciones', activo = true, nombre = 'Ops' where email = 'ops@mac.pe';
update perfil set rol = 'finanzas', activo = true, nombre = 'Ana' where email = 'ana.finanzas@mac.pe';
update perfil set rol = 'cliente', cliente_id = (select id from cliente where razon_social = 'MINERA A'), activo = true
  where email = 'cliente.a@minera.pe';

create function pg_temp.verificar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

-- ---------- Operaciones crea el expediente y sus referencias ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

insert into expediente (cliente_id, descripcion) select id, 'Cianuro China' from cliente where razon_social = 'MINERA A';
insert into expediente (cliente_id, descripcion) select id, 'Otro' from cliente where razon_social = 'MINERA B';
select pg_temp.verificar((select codigo from expediente where descripcion = 'Cianuro China')
                         = 'EXP' || to_char(now() at time zone 'America/Lima', 'YY') || '0001', 'código EXP correlativo');

insert into referencia (expediente_id, tipo) select id, 'CARGA_MARITIMA' from expediente where descripcion = 'Cianuro China';
insert into referencia (expediente_id, tipo, responsable_id)
  select id, 'ADUANA', '00000000-0000-0000-0000-000000000004' from expediente where descripcion = 'Cianuro China';
insert into referencia (expediente_id, tipo) select id, 'ALMACENAJE' from expediente where descripcion = 'Cianuro China';
insert into referencia (expediente_id, tipo, visible_cliente)
  select id, 'TRANSPORTE', false from expediente where descripcion = 'Cianuro China';
insert into referencia (expediente_id, tipo) select id, 'TRANSPORTE' from expediente where descripcion = 'Otro';

select pg_temp.verificar((select count(*) from referencia where codigo like 'SEA%0001') = 1, 'código SEA correlativo');
select pg_temp.verificar((select count(*) from referencia where codigo like 'TRA%0002') = 1, 'correlativo independiente por prefijo');
select pg_temp.verificar((select e.codigo from referencia r join etapa e on e.id = r.etapa_id where r.tipo = 'ADUANA')
                         = 'RECEPCION_DOCS', 'la referencia arranca en la primera etapa');
select pg_temp.verificar((select count(*) from referencia_etapa) = 5, 'historial de etapa inicial');

-- Avance de etapa: registra historial
update referencia set etapa_id = (select id from etapa where tipo = 'ADUANA' and codigo = 'LEVANTE') where tipo = 'ADUANA';
select pg_temp.verificar((select count(*) from referencia_etapa re join referencia r on r.id = re.referencia_id
                          where r.tipo = 'ADUANA') = 2, 'cambio de etapa queda en el historial');
select pg_temp.verificar((select count(*) from referencia_etapa re join referencia r on r.id = re.referencia_id
                          where r.tipo = 'ADUANA' and re.fin is null) = 1, 'solo una etapa abierta');
select pg_temp.verificar((select estado from expediente where descripcion = 'Cianuro China') = 'en_curso', 'expediente pasa a en curso');

-- Etapa final cierra la referencia
update referencia set etapa_id = (select id from etapa where tipo = 'CARGA_MARITIMA' and codigo = 'CERRADA')
 where tipo = 'CARGA_MARITIMA';
select pg_temp.verificar((select estado from referencia where tipo = 'CARGA_MARITIMA') = 'cerrada', 'etapa final cierra la referencia');

-- Almacenaje: stock y agotado automático
insert into ref_almacenaje (referencia_id, almacen_id, fecha_ingreso, bultos_inicial)
  select id, (select id from almacen limit 1), current_date, 120 from referencia where tipo = 'ALMACENAJE';
insert into movimiento_stock (referencia_id, tipo, bultos) select id, 'SALIDA', -20 from referencia where tipo = 'ALMACENAJE';
select pg_temp.verificar((select stock_actual from v_stock_almacenaje) = 100, 'stock = 120 - 20');
select pg_temp.verificar((select e.codigo from referencia r join etapa e on e.id = r.etapa_id where r.tipo = 'ALMACENAJE')
                         = 'RETIROS_PARCIALES', 'primera salida pasa a retiros parciales');
do $$ begin
  insert into movimiento_stock (referencia_id, tipo, bultos) select id, 'SALIDA', -101 from referencia where tipo = 'ALMACENAJE';
  raise exception 'no debió permitir';
exception when others then
  if sqlerrm not like 'Stock insuficiente%' then raise; end if;
end $$;
select pg_temp.verificar(true, 'no se despacha más de lo que hay');
insert into movimiento_stock (referencia_id, tipo, bultos) select id, 'SALIDA', -100 from referencia where tipo = 'ALMACENAJE';
select pg_temp.verificar((select e.codigo from referencia r join etapa e on e.id = r.etapa_id where r.tipo = 'ALMACENAJE')
                         = 'AGOTADO', 'stock en cero pasa a agotado');

-- Costos y profit
insert into movimiento_economico (expediente_id, concepto_id, tipo, valor_unitario, moneda)
  select e.id, c.id, 'VENTA', 1000, 'USD' from expediente e, concepto c
   where e.descripcion = 'Cianuro China' and c.nombre = 'SERVICIO LOGISTICO';
insert into movimiento_economico (expediente_id, concepto_id, tipo, valor_unitario, moneda, tipo_cambio)
  select e.id, c.id, 'COSTO', 370, 'PEN', 3.7 from expediente e, concepto c
   where e.descripcion = 'Cianuro China' and c.nombre = 'TRANSPORTE A MINA';
select pg_temp.verificar((select profit_usd from v_profit_expediente) = 900, 'profit = 1000 - 370/3.7');

-- Tareas, comentarios con mención y documentos
insert into tarea (expediente_id, titulo, asignado_a, vence_en)
  select id, 'Pedir BL', '00000000-0000-0000-0000-000000000004', now() - interval '1 hour'
  from expediente where descripcion = 'Cianuro China';
insert into comentario (expediente_id, referencia_id, texto)
  select r.expediente_id, r.id, 'Hola @ana.finanzas revisa esto' from referencia r where r.tipo = 'CARGA_MARITIMA';
insert into documento (expediente_id, referencia_id, tipo_documento, nombre_archivo, ruta_storage, visible_cliente)
  select r.expediente_id, r.id, 'BL', 'bl.pdf', 'x/bl.pdf', true from referencia r where r.tipo = 'CARGA_MARITIMA';
insert into documento (expediente_id, referencia_id, tipo_documento, nombre_archivo, ruta_storage, visible_cliente)
  select r.expediente_id, r.id, 'FACTURA', 'factura.pdf', 'x/f.pdf', true from referencia r where r.tipo = 'ADUANA';
update documento set estado = 'validado' where tipo_documento = 'BL';
select pg_temp.verificar((select validado_por from documento where tipo_documento = 'BL')
                         = '00000000-0000-0000-0000-000000000001', 'validación registra quién validó');
select pg_temp.verificar((select count(*) from v_alerta where tipo = 'tarea_vencida') = 1, 'alerta de tarea vencida');

-- Pagos: operaciones solicita pero no aprueba
insert into solicitud_pago (expediente_id, concepto, monto, moneda, estado)
  select id, 'Derechos', 500, 'USD', 'aprobada' from expediente where descripcion = 'Cianuro China';
select pg_temp.verificar((select estado from solicitud_pago) = 'solicitada', 'una solicitud nace como solicitada');
do $$ begin
  update solicitud_pago set estado = 'aprobada';
  raise exception 'no debió permitir';
exception when others then
  if sqlerrm not like 'Solo finanzas%' then raise; end if;
end $$;
select pg_temp.verificar(true, 'operaciones no aprueba pagos');

-- ---------- Finanzas ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select pg_temp.verificar((select count(*) from notificacion where titulo like 'Nueva tarea%') = 1, 'aviso de tarea asignada');
select pg_temp.verificar((select count(*) from notificacion where titulo like '%te mencionó%') = 1, 'aviso de mención');
select pg_temp.verificar((select count(*) from notificacion where titulo like 'Pago por aprobar%') = 1, 'aviso de pago por aprobar');
select pg_temp.verificar((select count(*) from notificacion where titulo like '%con levante') = 1, 'aviso de levante');
update solicitud_pago set estado = 'aprobada';
update solicitud_pago set estado = 'pagada';
select pg_temp.verificar((select estado from solicitud_pago) = 'pagada', 'finanzas aprueba y paga');

-- ---------- Cliente A ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.verificar((select count(*) from expediente) = 1, 'cliente ve solo su expediente');
select pg_temp.verificar((select count(*) from referencia) = 3, 'cliente no ve referencias ocultas');
select pg_temp.verificar((select count(*) from cliente) = 1, 'cliente ve solo su ficha');
select pg_temp.verificar((select count(*) from v_stock_almacenaje) = 1, 'cliente ve su stock');
select pg_temp.verificar((select count(*) from documento) = 1, 'cliente ve solo documentos validados y visibles');
select pg_temp.verificar((select count(*) from movimiento_economico) = 0, 'cliente NO ve costos');
select pg_temp.verificar((select count(*) from v_profit_expediente) = 0, 'cliente NO ve profit');
select pg_temp.verificar((select count(*) from tarea) = 0, 'cliente NO ve tareas');
select pg_temp.verificar((select count(*) from comentario) = 0, 'cliente NO ve bitácora');
select pg_temp.verificar((select count(*) from solicitud_pago) = 0, 'cliente NO ve pagos');
select pg_temp.verificar((select count(*) from proveedor) = 0, 'cliente NO ve proveedores');
select pg_temp.verificar((select count(*) from etapa) > 0, 'cliente ve los nombres de etapas');
update expediente set observaciones = 'hack';
select pg_temp.verificar(true, 'update de cliente no falla pero no afecta filas');

-- Usuario recién registrado (inactivo)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select pg_temp.verificar((select count(*) from expediente) = 0, 'usuario inactivo no ve nada');
select pg_temp.verificar((select count(*) from etapa) = 0, 'usuario inactivo no ve catálogos');

-- Anónimo
reset request.jwt.claim.sub;
select pg_temp.verificar((select count(*) from expediente) = 0, 'sin sesión no ve nada');

reset role;
select pg_temp.verificar((select count(*) from expediente where observaciones is not null) = 0, 'el cliente no pudo modificar');
select pg_temp.verificar((select count(*) from historial_cambio) > 0, 'auditoría registra cambios');

-- ---------- Costeo y comprobantes ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into comprobante (sentido, tipo, serie, numero, proveedor_id, expediente_id, moneda, tipo_cambio, detraccion_codigo, estado)
  select 'RECIBIDO', 'FACTURA', 'E001', '123', (select id from proveedor where nombre_corto = 'MERIDIAN'), e.id, 'PEN', 3.7, '027', 'registrado'
  from expediente e where e.descripcion = 'Cianuro China';
insert into comprobante_linea (comprobante_id, descripcion, cantidad, valor_unitario, referencia_id)
  select c.id, 'Transporte a mina', 2, 1000, (select id from referencia where tipo = 'TRANSPORTE' and not visible_cliente)
  from comprobante c where c.numero = '123';
select pg_temp.verificar((select igv from comprobante where numero = '123') = 360, 'IGV 18% calculado por línea');
select pg_temp.verificar((select total from comprobante where numero = '123') = 2360, 'total = base + IGV');
select pg_temp.verificar((select detraccion_monto_pen from comprobante where numero = '123') = 94, 'detracción 4% en soles redondeada');
select pg_temp.verificar((select round(costo_real_usd, 2) from v_costeo where referencia_id is not null and costo_real_usd > 0) = 540.54,
                         'costo real por referencia en USD (sin IGV)');
insert into comprobante (sentido, tipo, serie, cliente_id, expediente_id, moneda)
  select 'EMITIDO', 'FACTURA', 'F001', e.cliente_id, e.id, 'USD' from expediente e where e.descripcion = 'Cianuro China';
insert into comprobante_linea (comprobante_id, descripcion, valor_unitario)
  select id, 'Servicio logístico integral', 1500 from comprobante where sentido = 'EMITIDO';
do $$ begin
  update comprobante set estado = 'emitido' where sentido = 'EMITIDO';
  raise exception 'no debió permitir';
exception when others then
  if sqlerrm not like 'Solo finanzas%' then raise; end if;
end $$;
select pg_temp.verificar(true, 'operaciones prepara el borrador pero no emite');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
update comprobante set estado = 'emitido' where sentido = 'EMITIDO';
select pg_temp.verificar((select numero from comprobante where sentido = 'EMITIDO') = '00000001', 'al emitir toma el correlativo de la serie');
do $$ begin
  update comprobante_linea set valor_unitario = 1 where comprobante_id = (select id from comprobante where sentido = 'EMITIDO');
  raise exception 'no debió permitir';
exception when others then
  if sqlerrm not like 'El comprobante ya fue emitido%' then raise; end if;
end $$;
select pg_temp.verificar(true, 'un comprobante emitido no se modifica');
insert into comprobante (sentido, tipo, serie, cliente_id, expediente_id, moneda, comprobante_ref_id, motivo_nota)
  select 'EMITIDO', 'NOTA_CREDITO', 'FC01', cliente_id, expediente_id, 'USD', id, 'Descuento' from comprobante where tipo = 'FACTURA' and sentido = 'EMITIDO';
insert into comprobante_linea (comprobante_id, descripcion, valor_unitario)
  select id, 'Descuento', 100 from comprobante where tipo = 'NOTA_CREDITO';
update comprobante set estado = 'emitido' where tipo = 'NOTA_CREDITO';
insert into pago_comprobante (comprobante_id, monto, moneda)
  select id, 1000, 'USD' from comprobante where tipo = 'FACTURA' and sentido = 'EMITIDO';
select pg_temp.verificar((select saldo from v_saldo_comprobante where sentido = 'EMITIDO') = 652, 'saldo = 1770 − NC 118 − cobro 1000');
select pg_temp.verificar((select venta_real_usd from v_costeo_expediente where venta_real_usd > 0) = 1400, 'venta real neta de NC');
select pg_temp.verificar((select count(*) from v_registro_contable) = 3, 'registro de compras y ventas');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.verificar((select count(*) from comprobante) = 0, 'cliente NO ve comprobantes');
reset role;
