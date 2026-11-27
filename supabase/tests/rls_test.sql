-- Prueba de permisos: interno ve todo, cliente solo lo suyo, anónimo nada.
\set ON_ERROR_STOP on
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

insert into cliente (razon_social) values ('MINERA A'), ('MINERA B');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'ops@mac.pe'),
  ('00000000-0000-0000-0000-000000000002', 'cliente.a@minera.pe'),
  ('00000000-0000-0000-0000-000000000003', 'nuevo@x.pe');
update perfil set rol = 'operaciones', activo = true where email = 'ops@mac.pe';
update perfil set rol = 'cliente', cliente_id = (select id from cliente where razon_social = 'MINERA A'), activo = true
  where email = 'cliente.a@minera.pe';

insert into orden (codigo, cliente_id) select 'SLI-A', id from cliente where razon_social = 'MINERA A';
insert into orden (codigo, cliente_id) select 'SLI-B', id from cliente where razon_social = 'MINERA B';
insert into lote (codigo, orden_id, almacen_id, fecha_ingreso, bultos_inicial)
  select 'SLI-A', o.id, (select id from almacen limit 1), current_date, 120 from orden o where codigo = 'SLI-A';
insert into movimiento_stock (lote_id, tipo, bultos) select id, 'SALIDA', -20 from lote where codigo = 'SLI-A';
insert into movimiento_economico (orden_id, concepto_id, tipo, valor_unitario, moneda)
  select o.id, c.id, 'VENTA', 1000, 'USD' from orden o, concepto c where o.codigo = 'SLI-A' and c.nombre = 'SERVICIO LOGISTICO';
insert into movimiento_economico (orden_id, concepto_id, tipo, valor_unitario, moneda, tipo_cambio)
  select o.id, c.id, 'COSTO', 370, 'PEN', 3.7 from orden o, concepto c where o.codigo = 'SLI-A' and c.nombre = 'TRANSPORTE A MINA';

create function pg_temp.verificar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

-- Interno
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.verificar((select count(*) from orden) = 2, 'operaciones ve todas las órdenes');
select pg_temp.verificar((select stock_actual from v_stock_lote where codigo = 'SLI-A') = 100, 'stock = 120 - 20');
select pg_temp.verificar((select profit_usd from v_profit_orden) = 900, 'profit = 1000 - 370/3.7');
select pg_temp.verificar((select count(*) from movimiento_economico) = 2, 'operaciones ve costos');
insert into proveedor (razon_social, tipo) values ('PRUEBA', 'otro');
select pg_temp.verificar(true, 'operaciones puede crear proveedor');

-- Cliente A
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.verificar((select count(*) from orden) = 1, 'cliente ve solo su orden');
select pg_temp.verificar((select codigo from orden) = 'SLI-A', 'y es la suya');
select pg_temp.verificar((select count(*) from cliente) = 1, 'cliente ve solo su ficha');
select pg_temp.verificar((select count(*) from v_stock_lote) = 1, 'cliente ve su stock');
select pg_temp.verificar((select count(*) from movimiento_economico) = 0, 'cliente NO ve costos');
select pg_temp.verificar((select count(*) from v_profit_orden) = 0, 'cliente NO ve profit');
select pg_temp.verificar((select count(*) from proveedor) = 0, 'cliente NO ve proveedores');
update orden set observaciones = 'hack';
select pg_temp.verificar(true, 'update de cliente no falla pero no afecta filas');

-- Usuario recién registrado (inactivo)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select pg_temp.verificar((select count(*) from orden) = 0, 'usuario inactivo no ve nada');

-- Anónimo
reset request.jwt.claim.sub;
select pg_temp.verificar((select count(*) from orden) = 0, 'sin sesión no ve nada');

reset role;
select pg_temp.verificar((select observaciones from orden where codigo = 'SLI-A') is null, 'el cliente no pudo modificar su orden');
select pg_temp.verificar((select count(*) from historial_cambio) > 0, 'auditoría registra cambios');
