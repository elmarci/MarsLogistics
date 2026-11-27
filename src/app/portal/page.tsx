import { Encabezado, Insignia, Tabla, fecha } from "@/components/ui";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_ESTADO, type EstadoOrden } from "@/lib/tipos";

export const metadata = { title: "Mis órdenes" };

type Fila = {
  id: number;
  codigo: string;
  ref_cliente: string | null;
  estado: EstadoOrden;
  cantidad: number | null;
  unidad_medida: string;
  sede: { nombre: string } | null;
  embarque: { eta: string | null; mbl: string | null }[];
};

// RLS garantiza que solo vuelvan las órdenes del cliente del usuario.
export default async function PortalPage({ searchParams }: { searchParams: Promise<{ todas?: string }> }) {
  const { todas } = await searchParams;
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("orden")
    .select("id, codigo, ref_cliente, estado, cantidad, unidad_medida, sede:sede_destino_id(nombre), embarque(eta, mbl)")
    .neq("estado", "anulada")
    .order("fecha_apertura", { ascending: false })
    .limit(200);
  if (!todas) consulta = consulta.neq("estado", "cerrada");
  const { data } = await consulta;

  return (
    <>
      <Encabezado titulo="Mis órdenes" detalle={todas ? "Todas las órdenes" : "Órdenes en curso"} />
      <p className="mb-4 text-sm">
        <a href={todas ? "/portal" : "/portal?todas=1"} className="text-marca hover:underline">
          {todas ? "Ver solo en curso" : "Ver también las cerradas"}
        </a>
      </p>
      <Tabla
        filas={(data ?? []) as unknown as Fila[]}
        claveFila={(f) => f.id}
        enlace={(f) => `/portal/ordenes/${f.id}`}
        vacio="No tienes órdenes en curso."
        columnas={[
          { titulo: "Orden", valor: (f) => f.codigo },
          { titulo: "Su referencia", valor: (f) => f.ref_cliente ?? "—" },
          { titulo: "Destino", valor: (f) => f.sede?.nombre ?? "—" },
          { titulo: "Cantidad", valor: (f) => (f.cantidad ? `${f.cantidad} ${f.unidad_medida}` : "—") },
          { titulo: "ETA", valor: (f) => fecha(f.embarque[0]?.eta) },
          { titulo: "Etapa", valor: (f) => <Insignia valor={f.estado} texto={ETIQUETA_ESTADO[f.estado]} /> },
        ]}
      />
    </>
  );
}
