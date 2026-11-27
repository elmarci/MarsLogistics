import Link from "next/link";
import { Search } from "lucide-react";
import { Encabezado, Insignia, Vacio, fecha } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_ESTADO_EXPEDIENTE, type EstadoExpediente } from "@/lib/tipos";
import type { Avance } from "@/lib/operacion";
import { LineaReferencias } from "./Linea";

export const metadata = { title: "Expedientes" };

type Fila = {
  id: number;
  codigo: string;
  ref_cliente: string | null;
  descripcion: string | null;
  estado: EstadoExpediente;
  fecha_apertura: string;
  cantidad: number | null;
  unidad_medida: string;
  cliente: { razon_social: string; nombre_comercial: string | null } | null;
  producto: { descripcion: string } | null;
  responsable: { nombre: string } | null;
};

export default async function ExpedientesPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const perfil = await exigirInterno();
  const { q, estado = "activos" } = await searchParams;
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("expediente")
    .select(
      "id, codigo, ref_cliente, descripcion, estado, fecha_apertura, cantidad, unidad_medida, cliente:cliente_id(razon_social, nombre_comercial), producto:producto_id(descripcion), responsable:responsable_id(nombre)",
    )
    .order("creado_en", { ascending: false })
    .limit(100);
  if (estado === "activos") consulta = consulta.in("estado", ["abierto", "en_curso"]);
  else if (estado !== "todos") consulta = consulta.eq("estado", estado);
  if (q) {
    const t = q.replace(/[%,()]/g, " ").trim();
    consulta = consulta.or(`codigo.ilike.%${t}%,ref_cliente.ilike.%${t}%,descripcion.ilike.%${t}%`);
  }
  const { data } = await consulta;
  const filas = (data ?? []) as unknown as Fila[];

  const { data: avances } = filas.length
    ? await supabase.from("v_referencia_avance").select("*").in("expediente_id", filas.map((f) => f.id)).order("codigo")
    : { data: [] };
  const porExp = new Map<number, Avance[]>();
  for (const a of (avances ?? []) as Avance[]) porExp.set(a.expediente_id, [...(porExp.get(a.expediente_id) ?? []), a]);

  const filtros = [
    ["activos", "En curso"],
    ["cerrado", "Cerrados"],
    ["anulado", "Anulados"],
    ["todos", "Todos"],
  ];

  return (
    <>
      <Encabezado
        etiqueta="Operación"
        titulo="Expedientes"
        detalle="Cada expediente es el servicio completo contratado por el cliente; de él cuelgan sus referencias."
        accion={puedeEscribir(perfil) ? { href: "/expedientes/nuevo", label: "+ Nuevo expediente" } : undefined}
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-tenue" />
          <input name="q" defaultValue={q} placeholder="Buscar por código, ref. cliente o descripción" className="campo pl-9" />
          <input type="hidden" name="estado" value={estado} />
        </div>
        <div className="flex gap-1">
          {filtros.map(([v, l]) => (
            <Link
              key={v}
              href={`/expedientes?estado=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-md border px-3 py-1.5 text-xs ${estado === v ? "border-marca bg-marca-claro text-marca" : "border-borde text-tenue hover:text-texto"}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </form>

      {filas.length === 0 ? (
        <Vacio>No hay expedientes con ese filtro.</Vacio>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filas.map((f) => {
            const refs = porExp.get(f.id) ?? [];
            return (
              <article key={f.id} className="tarjeta group transition hover:border-marca/50">
                <Link href={`/expedientes/${f.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="codigo text-lg font-semibold text-marca">{f.codigo}</p>
                      <p className="truncate text-sm font-medium">{f.cliente?.nombre_comercial ?? f.cliente?.razon_social}</p>
                      <p className="truncate text-xs text-tenue">
                        {f.descripcion ?? f.producto?.descripcion ?? "—"}
                        {f.cantidad ? ` · ${f.cantidad} ${f.unidad_medida}` : ""}
                        {f.ref_cliente ? ` · ref. ${f.ref_cliente}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <Insignia tono={f.estado === "en_curso" ? "acento" : f.estado === "anulado" ? "apagado" : "neutro"}>
                        {ETIQUETA_ESTADO_EXPEDIENTE[f.estado]}
                      </Insignia>
                      <p className="codigo mt-1 text-[11px] text-tenue">{fecha(f.fecha_apertura)}</p>
                    </div>
                  </div>
                </Link>
                <div className="mt-3 border-t border-borde pt-3">
                  {refs.length ? <LineaReferencias refs={refs} compacta /> : <p className="text-xs text-tenue">Sin referencias todavía.</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
