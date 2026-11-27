import Link from "next/link";
import { Encabezado, Tabla, fecha } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ESTADOS_ORDEN, ETIQUETA_ESTADO, type EstadoOrden } from "@/lib/tipos";

export const metadata = { title: "Inicio" };

type Proxima = { id: number; eta: string | null; mbl: string | null; orden: { id: number; codigo: string; estado: EstadoOrden } | null };

export default async function InicioPage() {
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  const hoy = new Date().toISOString().slice(0, 10);
  const en14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [{ data: ordenes }, { data: llegadas }, { data: stock }] = await Promise.all([
    supabase.from("orden").select("estado").not("estado", "in", "(cerrada,anulada)"),
    supabase
      .from("embarque")
      .select("id, eta, mbl, orden:orden_id(id, codigo, estado)")
      .gte("eta", hoy)
      .lte("eta", en14)
      .order("eta"),
    supabase.from("v_stock_lote").select("stock_actual").gt("stock_actual", 0),
  ]);

  const porEstado = new Map<string, number>();
  for (const o of ordenes ?? []) porEstado.set(o.estado, (porEstado.get(o.estado) ?? 0) + 1);
  const bultosEnAlmacen = (stock ?? []).reduce((s, l) => s + (l.stock_actual ?? 0), 0);

  return (
    <>
      <Encabezado titulo={`Hola, ${perfil.nombre.split(" ")[0]}`} detalle="Resumen de la operación en curso." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="tarjeta">
          <p className="text-xs text-slate-500">Órdenes activas</p>
          <p className="text-2xl font-semibold">{ordenes?.length ?? 0}</p>
        </div>
        <div className="tarjeta">
          <p className="text-xs text-slate-500">Llegadas en 14 días</p>
          <p className="text-2xl font-semibold">{llegadas?.length ?? 0}</p>
        </div>
        <div className="tarjeta">
          <p className="text-xs text-slate-500">Bultos en almacén</p>
          <p className="text-2xl font-semibold">{bultosEnAlmacen}</p>
        </div>
        <div className="tarjeta">
          <p className="text-xs text-slate-500">Lotes con stock</p>
          <p className="text-2xl font-semibold">{stock?.length ?? 0}</p>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 font-medium">Órdenes activas por etapa</h2>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_ORDEN.filter((e) => !["cerrada", "anulada"].includes(e)).map((e) => (
            <Link key={e} href={`/ordenes?estado=${e}`} className="tarjeta min-w-28 py-2 hover:border-marca">
              <p className="text-xs text-slate-500">{ETIQUETA_ESTADO[e]}</p>
              <p className="text-lg font-semibold">{porEstado.get(e) ?? 0}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Próximas llegadas</h2>
        <Tabla
          filas={(llegadas ?? []) as unknown as Proxima[]}
          claveFila={(f) => f.id}
          enlace={(f) => `/ordenes/${f.orden?.id}`}
          vacio="No hay naves programadas en los próximos 14 días."
          columnas={[
            { titulo: "Orden", valor: (f) => f.orden?.codigo ?? "—" },
            { titulo: "BL", valor: (f) => f.mbl ?? "—" },
            { titulo: "ETA", valor: (f) => fecha(f.eta) },
            { titulo: "Etapa", valor: (f) => (f.orden ? ETIQUETA_ESTADO[f.orden.estado] : "—") },
          ]}
        />
      </section>
    </>
  );
}
