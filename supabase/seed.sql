-- Datos iniciales: proveedores y conceptos que ya usa la operación (planillas ORDENES / COSTOS).
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
  ('ALCONSA', 'ALCONSA', 'otro')
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
