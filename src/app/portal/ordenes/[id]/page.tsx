import Link from "next/link";
import { notFound } from "next/navigation";
import { LineaEtapas } from "@/components/LineaEtapas";
import { Dato, Encabezado, Tabla, fecha, fechaHora } from "@/components/ui";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoOrden } from "@/lib/tipos";

const CANAL: Record<string, string> = { VERDE: "Verde", NARANJA: "Naranja", ROJO: "Rojo" };
const ESTADO_CONTENEDOR: Record<string, string> = {
  en_transito: "En tránsito",
  en_puerto: "En puerto",
  retirado: "Retirado del puerto",
  en_almacen: "En almacén",
  vaciado: "Descargado",
  devuelto: "Descargado",
};

type Contenedor = { id: number; numero: string; tamano: string; estado: string; hora_retiro: string | null; fecha_ingreso_almacen: string | null };

// Vista de seguimiento para el cliente: sin costos, proveedores ni datos internos.
export default async function PortalOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: orden } = await supabase
    .from("orden")
    .select("id, codigo, ref_cliente, estado, cantidad, unidad_medida, bultos, fecha_apertura, sede:sede_destino_id(nombre)")
    .eq("id", id)
    .single();
  if (!orden) notFound();

  const [{ data: embarques }, { data: aduanas }, { data: stock }, { data: despachos }] = await Promise.all([
    supabase
      .from("embarque")
      .select("mbl, puerto_origen, puerto_destino, etd, eta, fecha_llegada, contenedor(id, numero, tamano, estado, hora_retiro, fecha_ingreso_almacen)")
      .eq("orden_id", id),
    supabase.from("despacho_aduanero").select("dam, canal, fecha_numeracion, fecha_levante, estado").eq("orden_id", id),
    supabase.from("v_stock_lote").select("codigo, bultos_inicial, bultos_despachados, stock_actual").eq("orden_id", id),
    supabase.from("despacho").select("id, codigo, bultos, salida_punto_carga, llegada_destino, estado").eq("orden_id", id).order("salida_punto_carga"),
  ]);
  const e = embarques?.[0];
  const a = aduanas?.[0];

  return (
    <>
      <Link href="/portal" className="text-sm text-marca hover:underline">
        ← Mis órdenes
      </Link>
      <Encabezado
        titulo={orden.codigo}
        detalle={[orden.ref_cliente && `Su ref.: ${orden.ref_cliente}`, (orden.sede as unknown as { nombre: string } | null)?.nombre].filter(Boolean).join(" · ")}
      />
      <div className="mb-6">
        <LineaEtapas estado={orden.estado as EstadoOrden} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="tarjeta">
          <h2 className="mb-3 font-medium">Embarque</h2>
          <dl className="grid grid-cols-2 gap-3">
            <Dato titulo="BL" valor={e?.mbl} />
            <Dato titulo="Ruta" valor={e ? `${e.puerto_origen ?? "—"} → ${e.puerto_destino}` : null} />
            <Dato titulo="ETD" valor={fecha(e?.etd)} />
            <Dato titulo="ETA" valor={fecha(e?.eta)} />
            <Dato titulo="Llegada" valor={fecha(e?.fecha_llegada)} />
            <Dato titulo="Cantidad" valor={orden.cantidad ? `${orden.cantidad} ${orden.unidad_medida}` : null} />
          </dl>
        </section>
        <section className="tarjeta">
          <h2 className="mb-3 font-medium">Aduana</h2>
          <dl className="grid grid-cols-2 gap-3">
            <Dato titulo="DAM" valor={a?.dam} />
            <Dato titulo="Canal" valor={a?.canal ? CANAL[a.canal] : null} />
            <Dato titulo="Numeración" valor={fechaHora(a?.fecha_numeracion)} />
            <Dato titulo="Levante" valor={fechaHora(a?.fecha_levante)} />
          </dl>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-medium">Contenedores</h2>
        <Tabla
          filas={((e?.contenedor ?? []) as Contenedor[]).sort((x, y) => x.numero.localeCompare(y.numero))}
          claveFila={(k) => k.id}
          vacio="Aún no hay contenedores registrados."
          columnas={[
            { titulo: "Contenedor", valor: (k) => `${k.numero} (${k.tamano}')` },
            { titulo: "Estado", valor: (k) => ESTADO_CONTENEDOR[k.estado] },
            { titulo: "Retiro del puerto", valor: (k) => fechaHora(k.hora_retiro) },
            { titulo: "Ingreso a almacén", valor: (k) => fechaHora(k.fecha_ingreso_almacen) },
          ]}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-medium">Stock en almacén</h2>
        <Tabla
          filas={(stock ?? []) as { codigo: string; bultos_inicial: number; bultos_despachados: number; stock_actual: number }[]}
          claveFila={(l) => l.codigo}
          vacio="La carga aún no ingresa al almacén."
          columnas={[
            { titulo: "Lote", valor: (l) => l.codigo },
            { titulo: "Ingresó", valor: (l) => l.bultos_inicial },
            { titulo: "Despachado", valor: (l) => l.bultos_despachados },
            { titulo: "En almacén", valor: (l) => l.stock_actual },
          ]}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-medium">Despachos a destino</h2>
        <Tabla
          filas={(despachos ?? []) as { id: number; codigo: string; bultos: number; salida_punto_carga: string | null; llegada_destino: string | null; estado: string }[]}
          claveFila={(d) => d.id}
          vacio="Aún no hay despachos."
          columnas={[
            { titulo: "Despacho", valor: (d) => d.codigo },
            { titulo: "Bultos", valor: (d) => d.bultos },
            { titulo: "Salida", valor: (d) => fechaHora(d.salida_punto_carga) },
            { titulo: "Llegada", valor: (d) => fechaHora(d.llegada_destino) },
            { titulo: "Estado", valor: (d) => d.estado },
          ]}
        />
      </section>
    </>
  );
}
