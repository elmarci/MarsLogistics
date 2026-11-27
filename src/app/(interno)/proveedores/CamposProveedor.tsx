import { Campo, Rejilla, Selector } from "@/components/ui";
import { ETIQUETA_TIPO_PROVEEDOR, TIPOS_PROVEEDOR } from "@/lib/tipos";

export const ETIQUETA_HOMOLOGACION: Record<string, string> = {
  pendiente: "Pendiente",
  homologado: "Homologado",
  observado: "Observado",
  suspendido: "Suspendido",
};

type Proveedor = Partial<Record<string, string | null>>;

export function CamposProveedor({ p = {} }: { p?: Proveedor }) {
  return (
    <Rejilla>
      <Campo name="razon_social" label="Razón social" defaultValue={p.razon_social} required />
      <Campo name="nombre_corto" label="Nombre corto" defaultValue={p.nombre_corto} placeholder="p. ej. ZETRAMSA" />
      <Selector
        name="tipo"
        label="Tipo de servicio"
        required
        defaultValue={p.tipo}
        opciones={TIPOS_PROVEEDOR.map((t) => ({ value: t, label: ETIQUETA_TIPO_PROVEEDOR[t] }))}
      />
      <Campo name="ruc" label="RUC / ID fiscal" defaultValue={p.ruc} />
      <Campo name="pais" label="País" defaultValue={p.pais ?? "PE"} />
      <Selector
        name="estado_homologacion"
        label="Homologación"
        vacio={false}
        defaultValue={p.estado_homologacion ?? "pendiente"}
        opciones={Object.entries(ETIQUETA_HOMOLOGACION).map(([value, label]) => ({ value, label }))}
      />
      <Campo name="contacto" label="Contacto" defaultValue={p.contacto} />
      <Campo name="email" label="Correo" type="email" defaultValue={p.email} />
      <Campo name="telefono" label="Teléfono" defaultValue={p.telefono} />
      <Campo name="condiciones_pago" label="Condiciones de pago" defaultValue={p.condiciones_pago} />
    </Rejilla>
  );
}
