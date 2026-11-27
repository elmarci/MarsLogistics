import Link from "next/link";
import { Encabezado, IconoTipo, duracion } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { demorada, etapasPorTipo, type Avance } from "@/lib/operacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { INFO_TIPO, TIPOS_REFERENCIA, type TipoReferencia } from "@/lib/tipos";

export const metadata = { title: "Referencias" };

// Bandeja por tipo: una columna por etapa, una tarjeta por referencia activa.
export default async function ReferenciasPage({ searchParams }: { searchParams: Promise<{ tipo?: string; mias?: string }> }) {
  const perfil = await exigirInterno();
  const sp = await searchParams;
  const tipo = (TIPOS_REFERENCIA as readonly string[]).includes(sp.tipo ?? "") ? (sp.tipo as TipoReferencia) : porArea(perfil.rol);
  const mias = sp.mias === "1";
  const supabase = await crearClienteServidor();

  let q = supabase.from("v_referencia_avance").select("*").eq("tipo", tipo).eq("estado", "activa").order("etapa_desde");
  if (mias) q = q.eq("responsable_id", perfil.id);
  const [{ data }, etapas, { data: conteo }] = await Promise.all([
    q,
    etapasPorTipo(),
    supabase.from("referencia").select("tipo").eq("estado", "activa"),
  ]);
  const refs = (data ?? []) as Avance[];
  const { data: extra } = refs.length
    ? await supabase
        .from("referencia")
        .select("id, descripcion, expediente:expediente_id(codigo, cliente:cliente_id(nombre_comercial, razon_social)), responsable:responsable_id(nombre)")
        .in("id", refs.map((r) => r.id))
    : { data: [] };
  type Extra = {
    id: number;
    descripcion: string | null;
    expediente: { codigo: string; cliente: { nombre_comercial: string | null; razon_social: string } | null } | null;
    responsable: { nombre: string } | null;
  };
  const info = new Map(((extra ?? []) as unknown as Extra[]).map((x) => [x.id, x]));
  const total = new Map<string, number>();
  for (const r of conteo ?? []) total.set(r.tipo, (total.get(r.tipo) ?? 0) + 1);
  const columnas = etapas[tipo].filter((e) => !e.es_final);

  return (
    <>
      <Encabezado etiqueta="Bandeja" titulo="Referencias en curso" detalle="Cada columna es una etapa. Las tarjetas en ámbar superan su tiempo estándar.">
        <Link
          href={`/referencias?tipo=${tipo}${mias ? "" : "&mias=1"}`}
          className={`rounded-md border px-3 py-1.5 text-xs ${mias ? "border-marca bg-marca-claro text-marca" : "border-borde text-tenue"}`}
        >
          Solo las mías
        </Link>
      </Encabezado>
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TIPOS_REFERENCIA.map((t) => (
          <Link
            key={t}
            href={`/referencias?tipo=${t}${mias ? "&mias=1" : ""}`}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap ${
              t === tipo ? "border-marca bg-marca-claro text-marca" : "border-borde text-tenue hover:text-texto"
            }`}
          >
            <IconoTipo tipo={t} /> {INFO_TIPO[t].corto}
            <span className="codigo text-xs opacity-70">{total.get(t) ?? 0}</span>
          </Link>
        ))}
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {columnas.map((e) => {
          const enEtapa = refs.filter((r) => r.etapa_id === e.id);
          return (
            <section key={e.id} className="w-64 shrink-0 snap-start rounded-lg border border-borde bg-slate-50">
              <header className="flex items-center justify-between border-b border-borde px-3 py-2">
                <p className="text-xs font-medium">
                  <span className="codigo mr-1.5 text-tenue">{String(e.orden).padStart(2, "0")}</span>
                  {e.nombre}
                </p>
                <span className="codigo text-xs text-marca">{enEtapa.length}</span>
              </header>
              <ul className="space-y-2 p-2">
                {enEtapa.map((r) => {
                  const x = info.get(r.id);
                  const tarde = demorada(r);
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/referencias/${r.id}`}
                        className={`block rounded-md border bg-white p-2.5 shadow-sm transition hover:border-marca ${tarde ? "border-aviso/60" : "border-borde"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="codigo text-sm font-medium">{r.codigo}</span>
                          <span className={`codigo text-[11px] ${tarde ? "text-aviso" : "text-tenue"}`}>{duracion(r.horas_en_etapa)}</span>
                        </div>
                        <p className="truncate text-xs text-slate-600">
                          {x?.expediente?.codigo} · {x?.expediente?.cliente?.nombre_comercial ?? x?.expediente?.cliente?.razon_social}
                        </p>
                        {x?.descripcion && <p className="truncate text-xs text-tenue">{x.descripcion}</p>}
                        <p className="mt-1 text-[11px] text-tenue">{x?.responsable?.nombre ?? "Sin responsable"}</p>
                      </Link>
                    </li>
                  );
                })}
                {enEtapa.length === 0 && <li className="px-1 py-3 text-center text-xs text-slate-400">—</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function porArea(rol: string): TipoReferencia {
  if (rol === "aduanas") return "ADUANA";
  if (rol === "transporte") return "TRANSPORTE";
  if (rol === "almacen") return "ALMACENAJE";
  return "CARGA_MARITIMA";
}
