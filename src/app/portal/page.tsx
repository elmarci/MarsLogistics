import Link from "next/link";
import { LineaReferencias } from "@/app/(interno)/expedientes/Linea";
import { Encabezado, Insignia, Vacio, fecha } from "@/components/ui";
import type { Avance } from "@/lib/operacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_ESTADO_EXPEDIENTE, type EstadoExpediente } from "@/lib/tipos";

export const metadata = { title: "Mis operaciones" };

// RLS garantiza que solo vuelvan los expedientes del cliente y sus referencias visibles.
export default async function PortalPage({ searchParams }: { searchParams: Promise<{ todas?: string }> }) {
  const { todas } = await searchParams;
  const supabase = await crearClienteServidor();
  let q = supabase
    .from("expediente")
    .select("id, codigo, ref_cliente, descripcion, estado, fecha_apertura, cantidad, unidad_medida, sede:sede_destino_id(nombre)")
    .neq("estado", "anulado")
    .order("creado_en", { ascending: false })
    .limit(100);
  if (!todas) q = q.neq("estado", "cerrado");
  const { data } = await q;
  const exps = data ?? [];
  const { data: avances } = exps.length
    ? await supabase.from("v_referencia_avance").select("*").in("expediente_id", exps.map((e) => e.id)).neq("estado", "anulada").order("codigo")
    : { data: [] };
  const porExp = new Map<number, Avance[]>();
  for (const a of (avances ?? []) as Avance[]) porExp.set(a.expediente_id, [...(porExp.get(a.expediente_id) ?? []), a]);

  return (
    <>
      <Encabezado etiqueta="Seguimiento" titulo="Mis operaciones" detalle={todas ? "Todas" : "En curso"}>
        <Link href={todas ? "/portal" : "/portal?todas=1"} className="boton-secundario">
          {todas ? "Solo en curso" : "Incluir cerradas"}
        </Link>
      </Encabezado>
      {exps.length === 0 ? (
        <Vacio>No hay operaciones para mostrar.</Vacio>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {exps.map((e) => (
            <Link key={e.id} href={`/portal/expedientes/${e.id}`} className="tarjeta block transition hover:border-marca/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="codigo text-lg font-semibold text-marca">{e.codigo}</p>
                  <p className="truncate text-sm">{e.descripcion ?? "—"}</p>
                  <p className="text-xs text-tenue">
                    {e.ref_cliente && `Su ref. ${e.ref_cliente} · `}
                    {e.cantidad ? `${e.cantidad} ${e.unidad_medida} · ` : ""}
                    {(e.sede as unknown as { nombre: string } | null)?.nombre ?? ""}
                  </p>
                </div>
                <div className="text-right">
                  <Insignia tono={e.estado === "en_curso" ? "acento" : "neutro"}>{ETIQUETA_ESTADO_EXPEDIENTE[e.estado as EstadoExpediente]}</Insignia>
                  <p className="codigo mt-1 text-[11px] text-tenue">{fecha(e.fecha_apertura)}</p>
                </div>
              </div>
              <div className="mt-3 border-t border-borde pt-3">
                <LineaReferencias refs={porExp.get(e.id) ?? []} compacta base={null} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
