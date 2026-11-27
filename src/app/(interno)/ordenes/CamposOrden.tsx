import { AreaTexto, Campo, Rejilla, Selector } from "@/components/ui";

type Opcion = { value: string | number; label: string };
type Orden = Partial<{
  codigo: string;
  cliente_id: number;
  sede_destino_id: number | null;
  ref_cliente: string | null;
  ref_agente: string | null;
  producto_id: number | null;
  cantidad: number | null;
  unidad_medida: string;
  bultos: number | null;
  incoterm: string | null;
  fecha_recepcion: string | null;
  observaciones: string | null;
}>;

export function CamposOrden({
  o = {},
  clientes,
  sedes,
  productos,
}: {
  o?: Orden;
  clientes: Opcion[];
  sedes: Opcion[];
  productos: Opcion[];
}) {
  return (
    <>
      <Rejilla>
        <Campo name="codigo" label="Código de orden" defaultValue={o.codigo} required />
        <Selector name="cliente_id" label="Cliente" opciones={clientes} defaultValue={o.cliente_id} required />
        <Selector name="sede_destino_id" label="Destino (sede del cliente)" opciones={sedes} defaultValue={o.sede_destino_id} />
        <Campo name="ref_cliente" label="Ref. del cliente (OC)" defaultValue={o.ref_cliente} />
        <Campo name="ref_agente" label="Ref. del agente de aduanas" defaultValue={o.ref_agente} />
        <Selector name="producto_id" label="Producto" opciones={productos} defaultValue={o.producto_id} />
        <Campo name="cantidad" label="Cantidad" type="number" step="0.001" defaultValue={o.cantidad} />
        <Campo name="unidad_medida" label="Unidad" defaultValue={o.unidad_medida ?? "TM"} />
        <Campo name="bultos" label="Bultos (cajas)" type="number" defaultValue={o.bultos} />
        <Campo name="incoterm" label="Incoterm" defaultValue={o.incoterm} placeholder="CFR, CIF, FOB…" />
        <Campo name="fecha_recepcion" label="Fecha de recepción de la orden" type="date" defaultValue={o.fecha_recepcion} />
      </Rejilla>
      <AreaTexto name="observaciones" label="Observaciones" defaultValue={o.observaciones} />
    </>
  );
}
