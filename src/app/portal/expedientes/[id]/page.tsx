import { notFound } from "next/navigation";
import { Boxes, Download, FileText, Warehouse } from "lucide-react";
import { LineaEtapas, type Paso } from "@/components/operacion/Etapas";
import { Seccion } from "@/components/Seccion";
import { Dato, Encabezado, IconoTipo, Insignia, Vacio, fecha } from "@/components/ui";
import { etapasPorTipo, type Avance } from "@/lib/operacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { INFO_TIPO, type TipoReferencia } from "@/lib/tipos";

export const metadata = { title: "Seguimiento" };

const ESTADO_CONTENEDOR: Record<string, string> = {
  en_transito: "En tránsito",
  en_puerto: "En puerto",
  retirado: "Retirado de puerto",
  en_almacen: "En almacén",
  vaciado: "Vaciado",
  devuelto: "Vacío devuelto",
};

export default async function PortalExpediente({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const supabase = await crearClienteServidor();
  const { data: e } = await supabase
    .from("expediente")
    .select("id, codigo, ref_cliente, descripcion, estado, cantidad, unidad_medida, bultos, incoterm, pais_origen, fecha_apertura, sede:sede_destino_id(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!e) notFound();

  const [{ data: av }, etapas, { data: hist }, { data: cargas }, { data: conts }, { data: stock }, { data: docs }, { data: tds }] = await Promise.all([
    supabase.from("v_referencia_avance").select("*").eq("expediente_id", id).neq("estado", "anulada").order("codigo"),
    etapasPorTipo(),
    supabase.from("referencia_etapa").select("referencia_id, etapa_id, inicio, fin").order("inicio"),
    supabase.from("ref_carga").select("referencia_id, mbl, nave_viaje, eta, fecha_llegada, puerto_origen"),
    supabase.from("contenedor").select("id, numero, tamano, estado, bultos").eq("expediente_id", id).order("numero"),
    supabase.from("v_stock_almacenaje").select("*").eq("expediente_id", id),
    supabase.from("documento").select("id, tipo_documento, nombre_archivo, creado_en, referencia_id").eq("expediente_id", id).order("creado_en", { ascending: false }),
    supabase.from("tipo_documento").select("codigo, nombre"),
  ]);
  const refs = (av ?? []) as Avance[];
  const carga = new Map((cargas ?? []).map((c) => [c.referencia_id, c]));
  const nombreDoc = new Map((tds ?? []).map((t) => [t.codigo, t.nombre]));

  return (
    <>
      <Encabezado
        etiqueta="Seguimiento"
        titulo={<span className="codigo">{e.codigo}</span>}
        detalle={`${e.descripcion ?? ""}${e.ref_cliente ? ` · Su ref. ${e.ref_cliente}` : ""}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {refs.length === 0 && <Vacio>Aún no hay servicios en seguimiento.</Vacio>}
          {refs.map((r) => {
            const k = carga.get(r.id);
            return (
              <Seccion key={r.id} titulo={`${INFO_TIPO[r.tipo as TipoReferencia].nombre} · ${r.codigo}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <IconoTipo tipo={r.tipo} className="h-4 w-4 text-marca" />
                  <span>{r.estado === "cerrada" ? "Completado" : r.etapa}</span>
                  {k && (
                    <span className="text-xs text-tenue">
                      {k.nave_viaje && `${k.nave_viaje} · `}
                      {k.mbl && `BL ${k.mbl} · `}
                      {k.fecha_llegada ? `llegó ${fecha(k.fecha_llegada)}` : k.eta ? `ETA ${fecha(k.eta)}` : ""}
                    </span>
                  )}
                </div>
                <LineaEtapas
                  etapas={etapas[r.tipo as TipoReferencia]}
                  actualId={r.etapa_id}
                  historial={((hist ?? []) as (Paso & { referencia_id: number })[]).filter((h) => h.referencia_id === r.id)}
                  estado={r.estado}
                />
              </Seccion>
            );
          })}
        </div>
        <aside className="min-w-0 space-y-4">
          <Seccion titulo="Resumen">
            <dl className="grid grid-cols-2 gap-3">
              <Dato titulo="Cantidad" valor={e.cantidad ? `${e.cantidad} ${e.unidad_medida}` : null} />
              <Dato titulo="Bultos" valor={e.bultos} />
              <Dato titulo="Incoterm" valor={e.incoterm} />
              <Dato titulo="Origen" valor={e.pais_origen} />
              <Dato titulo="Destino" valor={(e.sede as unknown as { nombre: string } | null)?.nombre} />
              <Dato titulo="Apertura" valor={fecha(e.fecha_apertura)} />
            </dl>
          </Seccion>
          {(stock ?? []).length > 0 && (
            <Seccion titulo="Stock en almacén" icono={Warehouse}>
              {(stock ?? []).map((s) => (
                <div key={s.referencia_id} className="flex items-end justify-between">
                  <span className="codigo text-xs text-tenue">{s.codigo}</span>
                  <span className="text-right">
                    <span className="codigo text-2xl font-semibold text-marca">{s.stock_actual}</span>
                    <span className="block text-[11px] text-tenue">de {s.bultos_inicial} bultos · despachados {s.bultos_despachados}</span>
                  </span>
                </div>
              ))}
            </Seccion>
          )}
          <Seccion titulo={`Contenedores (${conts?.length ?? 0})`} icono={Boxes}>
            {(conts ?? []).length === 0 ? (
              <Vacio>Sin contenedores.</Vacio>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {(conts ?? []).map((k) => (
                  <li key={k.id} className="flex items-center justify-between">
                    <span className="codigo">{k.numero}</span>
                    <Insignia tono={k.estado === "devuelto" ? "apagado" : "neutro"}>{ESTADO_CONTENEDOR[k.estado]}</Insignia>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
          <Seccion titulo="Documentos" icono={FileText}>
            {(docs ?? []).length === 0 ? (
              <Vacio>Sin documentos publicados.</Vacio>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {(docs ?? []).map((d) => (
                  <li key={d.id}>
                    <a href={`/documentos/${d.id}`} className="flex items-center gap-2 hover:text-marca">
                      <Download className="h-3.5 w-3.5 text-tenue" />
                      <span className="flex-1 truncate">{nombreDoc.get(d.tipo_documento) ?? d.tipo_documento}</span>
                      <span className="codigo text-[11px] text-tenue">{fecha(d.creado_en)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </aside>
      </div>
    </>
  );
}
