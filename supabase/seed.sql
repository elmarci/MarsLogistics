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
