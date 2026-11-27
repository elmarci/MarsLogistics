import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, FileText, Info, ListChecks, MessageSquare, Route, Settings2, Wallet } from "lucide-react";
import { Formulario } from "@/components/Formulario";
import { Indice, Seccion } from "@/components/Seccion";
import { Bitacora, type Comentario } from "@/components/operacion/Bitacora";
import { NuevoCosteo, ResumenCosteo, TablaCosteo, type LineaCosteo, type Resumen } from "@/components/operacion/Costeo";
import { PanelDocumentos, type Documento, type Requerido } from "@/components/operacion/Documentos";
import { CambiarEtapa, LineaEtapas, type Paso } from "@/components/operacion/Etapas";
import { ListaPagos, NuevaSolicitud, type SolicitudPago } from "@/components/operacion/Pagos";
import { ListaTareas, NuevaTarea, type Tarea } from "@/components/operacion/Tareas";
import { AreaTexto, Casilla, Dato, Encabezado, IconoTipo, Insignia, Selector } from "@/components/ui";
import { exigirInterno, puedeEscribir, puedeVerCostos } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { equipo, etapasPorTipo } from "@/lib/operacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { INFO_TIPO, type TipoReferencia } from "@/lib/tipos";
import { actualizarReferencia, cambiarEtapa } from "../actions";
import { Dudas, FormAduana, FormAlmacenaje, FormCarga, FormTransporte, Stock, Unidades } from "../DetalleTipo";

export const metadata = { title: "Referencia" };

const TABLA: Record<TipoReferencia, string> = {
  CARGA_MARITIMA: "ref_carga",
  CARGA_AEREA: "ref_carga",
  ADUANA: "ref_aduana",
  TRANSPORTE: "ref_transporte",
  ALMACENAJE: "ref_almacenaje",
};

export default async function ReferenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirInterno();
  const refId = Number((await params).id);
  const supabase = await crearClienteServidor();
  const escribe = puedeEscribir(perfil);
  const costos = puedeVerCostos(perfil);

  const { data: r } = await supabase
    .from("referencia")
    .select(
      "*, expediente:expediente_id(id, codigo, descripcion, cliente:cliente_id(razon_social, nombre_comercial)), responsable:responsable_id(nombre), proveedor:proveedor_id(nombre_corto, razon_social), origen:referencia_origen_id(id, codigo)",
    )
    .eq("id", refId)
    .maybeSingle();
  if (!r) notFound();
  const tipo = r.tipo as TipoReferencia;
  const exp = r.expediente as { id: number; codigo: string; descripcion: string | null; cliente: { razon_social: string; nombre_comercial: string | null } | null };

  const [todas, historial, detalle, documentos, requeridos, tareas, comentarios, pagos, costeo, resumen, c, gente, hijas] = await Promise.all([
    etapasPorTipo(),
    supabase.from("referencia_etapa").select("etapa_id, inicio, fin").eq("referencia_id", refId).order("inicio"),
    supabase.from(TABLA[tipo]).select("*").eq("referencia_id", refId).maybeSingle(),
    supabase
      .from("documento")
      .select("id, referencia_id, tipo_documento, nombre_archivo, estado, observacion, visible_cliente, vencimiento, creado_en, subido:subido_por(nombre)")
      .eq("referencia_id", refId)
      .order("creado_en", { ascending: false }),
    supabase
      .from("documento_requerido")
      .select("tipo_documento, obligatorio, td:tipo_documento(nombre), etapa:desde_etapa_id(orden)")
      .eq("tipo", tipo),
    supabase
      .from("tarea")
      .select("id, titulo, descripcion, vence_en, estado, asignado:asignado_a(nombre)")
      .eq("referencia_id", refId)
      .order("estado")
      .order("vence_en", { nullsFirst: false }),
    supabase
      .from("comentario")
      .select("id, texto, creado_en, autor:autor_id(nombre)")
      .eq("referencia_id", refId)
      .order("creado_en", { ascending: false })
      .limit(60),
    supabase
      .from("solicitud_pago")
      .select("id, concepto, monto, moneda, estado, fecha_limite, creado_en, observacion, proveedor:proveedor_id(nombre_corto, razon_social), solicitante:solicitado_por(nombre)")
      .eq("referencia_id", refId)
      .order("creado_en", { ascending: false }),
    costos
      ? supabase
          .from("movimiento_economico")
          .select("id, tipo, cantidad, valor_unitario, moneda, tipo_cambio, sobrecosto_asume, estado, concepto:concepto_id(nombre), proveedor:proveedor_id(nombre_corto, razon_social)")
          .eq("referencia_id", refId)
          .order("creado_en")
      : Promise.resolve({ data: [] }),
    costos ? supabase.from("v_costeo").select("*").eq("referencia_id", refId).maybeSingle() : Promise.resolve({ data: null }),
    catalogos(),
    equipo(),
    supabase.from("referencia").select("id, codigo, tipo").eq("referencia_origen_id", refId).order("codigo"),
  ]);

  const etapas = todas[tipo];
  const actual = etapas.find((e) => e.id === r.etapa_id);
  const siguienteOrden = (actual?.orden ?? 0) + 1;
  const docs = (documentos.data ?? []) as unknown as Documento[];
  const reqs: Requerido[] = (requeridos.data ?? []).map((q) => ({
    tipo_documento: q.tipo_documento,
    obligatorio: q.obligatorio,
    nombre: (q.td as unknown as { nombre: string } | null)?.nombre ?? q.tipo_documento,
    desde_orden: (q.etapa as unknown as { orden: number } | null)?.orden ?? null,
  }));
  const tiene = new Set(docs.filter((d) => d.estado !== "rechazado").map((d) => d.tipo_documento));
  const faltantes = reqs.filter((q) => q.obligatorio && (q.desde_orden ?? 0) <= siguienteOrden && !tiene.has(q.tipo_documento)).map((q) => q.nombre);
  const d = detalle.data as Record<string, string | number | boolean | null> | null;
  const soloLectura = !escribe || r.estado === "anulada";

  // Datos específicos por tipo
  let especifico: React.ReactNode = null;
  if (tipo === "CARGA_MARITIMA" || tipo === "CARGA_AEREA") {
    especifico = <FormCarga id={refId} d={d} c={c} aerea={tipo === "CARGA_AEREA"} soloLectura={soloLectura} />;
  } else if (tipo === "ADUANA") {
    const { data: dudas } = await supabase.from("duda_razonable").select("id, numero_notificacion, descripcion, plazo_respuesta, estado").eq("referencia_id", refId);
    especifico = (
      <div className="space-y-5">
        <FormAduana id={refId} d={d} soloLectura={soloLectura} />
        <div>
          <p className="etiqueta">Duda razonable</p>
          <Dudas id={refId} dudas={dudas ?? []} escribe={!soloLectura} />
        </div>
      </div>
    );
  } else if (tipo === "TRANSPORTE") {
    const [{ data: unidades }, { data: conts }] = await Promise.all([
      supabase
        .from("transporte_unidad")
        .select("id, placa_tracto, placa_carreta, conductor, bultos, precinto, gre_remitente, gre_transportista, salida, llegada, contenedor:contenedor_id(numero)")
        .eq("referencia_id", refId)
        .order("id"),
      supabase.from("contenedor").select("id, numero").eq("expediente_id", exp.id).order("numero"),
    ]);
    especifico = (
      <div className="space-y-5">
        <FormTransporte id={refId} d={d} c={c} soloLectura={soloLectura} />
        <div>
          <p className="etiqueta">Unidades</p>
          <Unidades
            id={refId}
            unidades={(unidades ?? []) as never}
            contenedores={(conts ?? []).map((k) => ({ value: k.id, label: k.numero }))}
            escribe={!soloLectura}
          />
        </div>
      </div>
    );
  } else if (tipo === "ALMACENAJE") {
    const [{ data: stock }, { data: movs }] = await Promise.all([
      supabase.from("v_stock_almacenaje").select("*").eq("referencia_id", refId).maybeSingle(),
      supabase.from("movimiento_stock").select("id, tipo, bultos, fecha, observacion").eq("referencia_id", refId).order("fecha", { ascending: false }),
    ]);
    especifico = (
      <div className="space-y-5">
        <FormAlmacenaje id={refId} d={d} c={c} soloLectura={soloLectura} />
        <Stock id={refId} stock={stock} movimientos={movs ?? []} c={c} equipo={gente} escribe={!soloLectura} />
      </div>
    );
  }

  return (
    <>
      <Encabezado
        etiqueta={INFO_TIPO[tipo].nombre}
        titulo={
          <span className="flex items-center gap-3">
            <IconoTipo tipo={tipo} className="h-6 w-6 text-marca" />
            <span className="codigo">{r.codigo}</span>
          </span>
        }
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/expedientes/${exp.id}`} className="codigo text-marca hover:underline">
              {exp.codigo}
            </Link>
            <span>· {exp.cliente?.nombre_comercial ?? exp.cliente?.razon_social}</span>
            {r.descripcion && <span>· {r.descripcion}</span>}
          </span>
        }
      >
        {r.estado !== "activa" && <Insignia tono={r.estado === "anulada" ? "alerta" : "apagado"}>{r.estado}</Insignia>}
        {!r.visible_cliente && <Insignia tono="apagado">Oculta al cliente</Insignia>}
      </Encabezado>

      <Indice
        items={[
          ["etapas", "Etapas"],
          ["operacion", "Operación"],
          ["documentos", `Documentos (${docs.length})`],
          ["tareas", "Tareas"],
          ["bitacora", "Bitácora"],
          ["pagos", "Pagos"],
          ...(costos ? ([["costeo", "Costeo"]] as [string, string][]) : []),
        ]}
      />

      <div className="space-y-4">
        <Seccion id="etapas" titulo={`Etapa ${actual?.orden ?? "—"} de ${etapas.length} · ${actual?.nombre ?? ""}`} icono={Route}>
          <LineaEtapas etapas={etapas} actualId={r.etapa_id} historial={(historial.data ?? []) as Paso[]} estado={r.estado} />
          {!soloLectura && (
            <div className="mt-4 border-t border-borde pt-4">
              <CambiarEtapa etapas={etapas} actualId={r.etapa_id} accion={cambiarEtapa.bind(null, refId)} faltantes={faltantes} />
            </div>
          )}
        </Seccion>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Seccion id="operacion" titulo="Datos de la operación" icono={Settings2}>
              {especifico}
            </Seccion>

            <Seccion id="documentos" titulo="Documentos" icono={FileText}>
              <PanelDocumentos
                expedienteId={exp.id}
                referenciaId={refId}
                documentos={docs}
                requeridos={reqs}
                tipos={c.tiposDocumento}
                puedeEscribir={escribe}
              />
            </Seccion>

            <Seccion id="tareas" titulo="Tareas" icono={ListChecks}>
              <div className="space-y-3">
                <ListaTareas tareas={(tareas.data ?? []) as unknown as Tarea[]} puedeEscribir={escribe} />
                {escribe && <NuevaTarea expedienteId={exp.id} referenciaId={refId} equipo={gente} />}
              </div>
            </Seccion>

            <Seccion id="pagos" titulo="Solicitudes de pago" icono={Wallet}>
              <div className="space-y-3">
                <ListaPagos pagos={(pagos.data ?? []) as unknown as SolicitudPago[]} aprueba={perfil.rol === "finanzas"} />
                {escribe && (
                  <NuevaSolicitud
                    expedienteId={exp.id}
                    referenciaId={refId}
                    proveedores={c.proveedores}
                    documentos={docs.map((x) => ({ value: x.id, label: `${x.tipo_documento} · ${x.nombre_archivo}` }))}
                  />
                )}
              </div>
            </Seccion>

            {costos && (
              <Seccion id="costeo" titulo="Costeo de la referencia" icono={Calculator}>
                <div className="space-y-4">
                  <ResumenCosteo r={resumen.data as Resumen | null} />
                  <TablaCosteo lineas={(costeo.data ?? []) as unknown as LineaCosteo[]} puedeEscribir={escribe} />
                  {escribe && <NuevoCosteo expedienteId={exp.id} referenciaId={refId} conceptos={c.conceptos} proveedores={c.proveedores} />}
                </div>
              </Seccion>
            )}
          </div>

          <aside className="min-w-0 space-y-4">
            <Seccion titulo="Resumen" icono={Info}>
              <dl className="grid grid-cols-2 gap-3">
                <Dato titulo="Responsable" valor={(r.responsable as { nombre: string } | null)?.nombre} />
                <Dato
                  titulo="Proveedor"
                  valor={(() => {
                    const p = r.proveedor as { nombre_corto: string | null; razon_social: string } | null;
                    return p ? (p.nombre_corto ?? p.razon_social) : null;
                  })()}
                />
                <Dato
                  titulo="Viene de"
                  valor={
                    r.origen ? (
                      <Link href={`/referencias/${(r.origen as { id: number }).id}`} className="codigo text-marca">
                        {(r.origen as { codigo: string }).codigo}
                      </Link>
                    ) : null
                  }
                />
                <Dato
                  titulo="Generó"
                  valor={
                    (hijas.data ?? []).length ? (
                      <span className="flex flex-wrap gap-1">
                        {(hijas.data ?? []).map((h) => (
                          <Link key={h.id} href={`/referencias/${h.id}`} className="codigo text-marca">
                            {h.codigo}
                          </Link>
                        ))}
                      </span>
                    ) : null
                  }
                />
              </dl>
              {escribe && (
                <details className="mt-4 border-t border-borde pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-marca">Responsable y visibilidad</summary>
                  <Formulario accion={actualizarReferencia.bind(null, refId)} className="mt-3">
                    <Selector name="responsable_id" label="Responsable" opciones={gente} defaultValue={r.responsable_id} />
                    <Selector name="proveedor_id" label="Proveedor principal" opciones={c.proveedores} defaultValue={r.proveedor_id} />
                    <AreaTexto name="descripcion" label="Descripción" defaultValue={r.descripcion} filas={2} />
                    <Casilla name="visible_cliente" label="El cliente ve esta referencia en su portal" defaultChecked={r.visible_cliente} />
                    <Casilla name="anulada" label="Anular referencia" defaultChecked={r.estado === "anulada"} />
                  </Formulario>
                </details>
              )}
            </Seccion>

            <Seccion id="bitacora" titulo="Bitácora" icono={MessageSquare}>
              <Bitacora
                expedienteId={exp.id}
                referenciaId={refId}
                comentarios={(comentarios.data ?? []) as unknown as Comentario[]}
                puedeEscribir={escribe}
                alias={gente.map((g) => g.alias)}
              />
            </Seccion>
          </aside>
        </div>
      </div>
    </>
  );
}
