import { Encabezado, Insignia, Tabla, fecha } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ESTADOS_ORDEN, ETIQUETA_ESTADO, type EstadoOrden } from "@/lib/tipos";

export const metadata = { title: "Órdenes" };

type Fila = {
  id: number;
  codigo: string;
  ref_cliente: string | null;
  estado: EstadoOrden;
  cantidad: number | null;
  unidad_medida: string;
  fecha_apertura: string;
  cliente: { razon_social: string } | null;
  sede: { nombre: string } | null;
  embarque: { eta: string | null; mbl: string | null }[];
};

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; cliente?: string; q?: string }>;
}) {
  const { estado, cliente, q } = await searchParams;
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("orden")
    .select(
      "id, codigo, ref_cliente, estado, cantidad, unidad_medida, fecha_apertura, cliente:cliente_id(razon_social), sede:sede_destino_id(nombre), embarque(eta, mbl)",
    )
    .order("fecha_apertura", { ascending: false })
    .limit(200);
  if (estado === "activas") consulta = consulta.not("estado", "in", "(cerrada,anulada)");
  else if (estado) consulta = consulta.eq("estado", estado);
  if (cliente) consulta = consulta.eq("cliente_id", cliente);
  if (q) consulta = consulta.or(`codigo.ilike.%${q.replace(/[%,()]/g, "")}%,ref_cliente.ilike.%${q.replace(/[%,()]/g, "")}%`);

  const [{ data }, { data: clientes }] = await Promise.all([
    consulta,
    supabase.from("cliente").select("id, razon_social").order("razon_social"),
  ]);

  return (
    <>
      <Encabezado
        titulo="Órdenes"
        detalle="Cada orden sigue la carga desde el embarque hasta la entrega y la liquidación."
        accion={puedeEscribir(perfil) ? { href: "/ordenes/nueva", label: "Nueva orden" } : undefined}
      />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="Buscar código o ref. cliente" className="campo" />
        <select name="estado" defaultValue={estado ?? "activas"} className="campo">
          <option value="activas">Activas</option>
          <option value="">Todas</option>
          {ESTADOS_ORDEN.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </select>
        <select name="cliente" defaultValue={cliente ?? ""} className="campo">
          <option value="">Todos los clientes</option>
          {(clientes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.razon_social}
            </option>
          ))}
        </select>
        <button className="boton-secundario">Filtrar</button>
      </form>
      <Tabla
        filas={(data ?? []) as unknown as Fila[]}
        claveFila={(f) => f.id}
        enlace={(f) => `/ordenes/${f.id}`}
        vacio="No hay órdenes con estos filtros."
        columnas={[
          { titulo: "Orden", valor: (f) => f.codigo },
          { titulo: "Cliente", valor: (f) => f.cliente?.razon_social ?? "—" },
          { titulo: "Destino", valor: (f) => f.sede?.nombre ?? "—" },
          { titulo: "Cantidad", valor: (f) => (f.cantidad ? `${f.cantidad} ${f.unidad_medida}` : "—") },
          { titulo: "BL", valor: (f) => f.embarque[0]?.mbl ?? "—" },
          { titulo: "ETA", valor: (f) => fecha(f.embarque[0]?.eta) },
          { titulo: "Estado", valor: (f) => <Insignia valor={f.estado} texto={ETIQUETA_ESTADO[f.estado]} /> },
        ]}
      />
    </>
  );
}
