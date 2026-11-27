import { AreaTexto, Campo, Rejilla, Selector } from "@/components/ui";
import type { catalogos } from "@/lib/catalogos";

type Valores = Partial<Record<string, string | number | null>>;

export function CamposExpediente({
  c,
  equipo,
  valores = {},
}: {
  c: Awaited<ReturnType<typeof catalogos>>;
  equipo: { value: string; label: string }[];
  valores?: Valores;
}) {
  return (
    <>
      <Rejilla>
        <Selector name="cliente_id" label="Cliente" opciones={c.clientes} defaultValue={valores.cliente_id} required />
        <Selector name="sede_destino_id" label="Destino final (sede)" opciones={c.sedes} defaultValue={valores.sede_destino_id} />
        <Campo name="ref_cliente" label="Referencia del cliente (OC / pedido)" defaultValue={valores.ref_cliente} />
        <Selector name="producto_id" label="Producto" opciones={c.productos} defaultValue={valores.producto_id} />
        <Campo name="descripcion" label="Descripción corta" placeholder="Cianuro China → Callao" defaultValue={valores.descripcion} />
        <Selector name="responsable_id" label="Responsable del expediente" opciones={equipo} defaultValue={valores.responsable_id} />
      </Rejilla>
      <Rejilla columnas={4}>
        <Campo name="cantidad" label="Cantidad" type="number" step="0.001" defaultValue={valores.cantidad} />
        <Selector
          name="unidad_medida"
          label="Unidad"
          vacio={false}
          opciones={["TM", "KG", "M3", "UND"].map((u) => ({ value: u, label: u }))}
          defaultValue={valores.unidad_medida ?? "TM"}
        />
        <Campo name="bultos" label="Bultos" type="number" defaultValue={valores.bultos} />
        <Selector
          name="incoterm"
          label="Incoterm"
          opciones={["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DDP"].map((i) => ({ value: i, label: i }))}
          defaultValue={valores.incoterm}
        />
      </Rejilla>
      <Rejilla columnas={2}>
        <Campo name="pais_origen" label="País de origen" defaultValue={valores.pais_origen} />
        <AreaTexto name="observaciones" label="Observaciones" defaultValue={valores.observaciones as string | null} filas={2} />
      </Rejilla>
    </>
  );
}
