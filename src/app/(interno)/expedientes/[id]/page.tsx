import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, Calculator, FileText, GitBranch, ListChecks, MessageSquare, Wallet, Zap } from "lucide-react";
import { Formulario } from "@/components/Formulario";
import { Indice, Seccion } from "@/components/Seccion";
import { Bitacora, type Comentario } from "@/components/operacion/Bitacora";
import { NuevoCosteo, ResumenCosteo, TablaCosteo, type LineaCosteo, type Resumen } from "@/components/operacion/Costeo";
import { PanelDocumentos, type Documento } from "@/components/operacion/Documentos";
import { ListaPagos, NuevaSolicitud, type SolicitudPago } from "@/components/operacion/Pagos";
import { ListaTareas, NuevaTarea, type Tarea } from "@/components/operacion/Tareas";
import { Dato, Encabezado, IconoTipo, Insignia, Vacio, dinero, fecha } from "@/components/ui";
import { exigirInterno, puedeEscribir, puedeVerCostos } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { equipo, type Avance } from "@/lib/operacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_ESTADO_EXPEDIENTE, INFO_TIPO, TIPOS_REFERENCIA, TIPOS_SERVICIO_TRANSPORTE, type EstadoExpediente } from "@/lib/tipos";
import { actualizarExpediente, agregarContenedores, agregarReferencia, cambiarEstadoContenedor } from "../actions";
import { CamposExpediente } from "../CamposExpediente";
import { LineaReferencias } from "../Linea";

export const metadata = { title: "Expediente" };

const ESTADOS_CONTENEDOR = {
  en_transito: "En tránsito",
  en_puerto: "En puerto",
  retirado: "Retirado",
  en_almacen: "En almacén",
  vaciado: "Vaciado",
  devuelto: "Vacío devuelto",
};

export default async function ExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirInterno();
  const expedienteId = Number((await params).id);
  const supabase = await crearClienteServidor();
  const escribe = puedeEscribir(perfil);
  const costos = puedeVerCostos(perfil);

  const { data: e } = await supabase
    .from("expediente")
    .select("*, cliente:cliente_id(razon_social, nombre_comercial), sede:sede_destino_id(nombre), producto:producto_id(descripcion, es_matpel, numero_onu), responsable:responsable_id(nombre)")
    .eq("id", expedienteId)
    .maybeSingle();
  if (!e) notFound();

  const [avances, contenedores, documentos, tareas, comentarios, pagos, costeo, resumen, c, gente, comprobantes] = await Promise.all([
    supabase.from("v_referencia_avance").select("*").eq("expediente_id", expedienteId).order("codigo"),
    supabase.from("contenedor").select("*").eq("expediente_id", expedienteId).order("numero"),
    supabase
      .from("documento")
      .select("id, referencia_id, tipo_documento, nombre_archivo, estado, observacion, visible_cliente, vencimiento, creado_en, subido:subido_por(nombre)")
      .eq("expediente_id", expedienteId)
      .order("creado_en", { ascending: false }),
    supabase
      .from("tarea")
      .select("id, titulo, descripcion, vence_en, estado, asignado:asignado_a(nombre), referencia:referencia_id(id, codigo)")
      .eq("expediente_id", expedienteId)
      .order("estado")
      .order("vence_en", { nullsFirst: false }),
    supabase
      .from("comentario")
      .select("id, texto, creado_en, autor:autor_id(nombre), referencia:referencia_id(codigo)")
      .eq("expediente_id", expedienteId)
      .order("creado_en", { ascending: false })
      .limit(60),
    supabase
      .from("solicitud_pago")
      .select("id, concepto, monto, moneda, estado, fecha_limite, creado_en, observacion, proveedor:proveedor_id(nombre_corto, razon_social), solicitante:solicitado_por(nombre), referencia:referencia_id(id, codigo)")
      .eq("expediente_id", expedienteId)
      .order("creado_en", { ascending: false }),
    costos
      ? supabase
          .from("movimiento_economico")
          .select("id, tipo, cantidad, valor_unitario, moneda, tipo_cambio, sobrecosto_asume, estado, concepto:concepto_id(nombre), proveedor:proveedor_id(nombre_corto, razon_social), referencia:referencia_id(codigo)")
          .eq("expediente_id", expedienteId)
          .order("creado_en")
      : Promise.resolve({ data: [] }),
    costos ? supabase.from("v_costeo_expediente").select("*").eq("expediente_id", expedienteId).maybeSingle() : Promise.resolve({ data: null }),
    catalogos(),
    equipo(),
    costos
      ? supabase
          .from("comprobante")
          .select("id, sentido, tipo, serie, numero, razon_social_contraparte, total, moneda, estado, fecha_emision")
          .eq("expediente_id", expedienteId)
          .order("fecha_emision", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const refs = (avances.data ?? []) as Avance[];
  const codigos = new Map(refs.map((r) => [r.id, r.codigo]));
  const docs = (documentos.data ?? []) as unknown as Documento[];

  // Automatización: con levante y sin almacenaje o retiro, se sugiere crearlos ya vinculados.
  const aduana = refs.find((r) => r.tipo === "ADUANA" && r.estado !== "anulada");
  const conLevante = aduana && (aduana.etapa_orden ?? 0) >= 7;
  const sugerencias: { tipo: string; texto: string; origen: number; servicio?: string }[] = [];
  if (conLevante && !refs.some((r) => r.tipo === "TRANSPORTE"))
    sugerencias.push({ tipo: "TRANSPORTE", texto: "Retiro de puerto", origen: aduana.id, servicio: "RETIRO_PUERTO" });
  if (conLevante && !refs.some((r) => r.tipo === "ALMACENAJE"))
    sugerencias.push({ tipo: "ALMACENAJE", texto: "Ingreso a almacén", origen: aduana.id });

  const cliente = e.cliente as { razon_social: string; nombre_comercial: string | null } | null;
  const producto = e.producto as { descripcion: string; es_matpel: boolean; numero_onu: string | null } | null;

  return (
    <>
      <Encabezado
        etiqueta="Expediente"
        titulo={<span className="codigo">{e.codigo}</span>}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-texto">{cliente?.nombre_comercial ?? cliente?.razon_social}</span>
            {e.descripcion && <span>· {e.descripcion}</span>}
            {producto?.es_matpel && <Insignia tono="aviso">MATPEL {producto.numero_onu}</Insignia>}
          </span>
        }
      >
        <Insignia tono={e.estado === "en_curso" ? "acento" : "neutro"}>{ETIQUETA_ESTADO_EXPEDIENTE[e.estado as EstadoExpediente]}</Insignia>
      </Encabezado>

      <Indice
        items={[
          ["referencias", "Referencias"],
          ["contenedores", "Contenedores"],
          ["documentos", `Documentos (${docs.length})`],
          ["tareas", "Tareas"],
          ["bitacora", "Bitácora"],
          ["pagos", "Pagos"],
          ...(costos ? ([["costeo", "Costeo"]] as [string, string][]) : []),
          ["datos", "Datos"],
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Seccion id="referencias" titulo="Línea de tiempo por referencia" icono={GitBranch}>
            {refs.length ? <LineaReferencias refs={refs} /> : <Vacio>Agrega la primera referencia de este expediente.</Vacio>}

            {escribe && sugerencias.length > 0 && (
              <div className="mt-4 rounded-lg border border-marca/40 bg-marca-claro p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-marca">
                  <Zap className="h-3.5 w-3.5" /> {aduana?.codigo} ya tiene levante. Siguiente paso sugerido:
                </p>
                <div className="flex flex-wrap gap-2">
                  {sugerencias.map((s) => (
                    <Formulario key={s.tipo} accion={agregarReferencia.bind(null, expedienteId)} textoBoton={`Crear ${INFO_TIPO[s.tipo as keyof typeof INFO_TIPO].prefijo}: ${s.texto}`} boton="boton-mini">
                      <input type="hidden" name="tipo" value={s.tipo} />
                      <input type="hidden" name="referencia_origen_id" value={s.origen} />
                      <input type="hidden" name="descripcion" value={s.texto} />
                      {s.servicio && <input type="hidden" name="tipo_servicio" value={s.servicio} />}
                      {s.servicio && <input type="hidden" name="origen" value="Puerto del Callao" />}
                    </Formulario>
                  ))}
                </div>
              </div>
            )}

            {escribe && (
              <details className="mt-4 rounded-lg border border-borde p-3">
                <summary className="cursor-pointer text-sm font-medium text-marca">+ Agregar referencia</summary>
                <Formulario accion={agregarReferencia.bind(null, expedienteId)} textoBoton="Crear referencia" limpiar className="mt-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {TIPOS_REFERENCIA.map((t, i) => (
                      <label
                        key={t}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-borde-fuerte p-2 text-xs has-[:checked]:border-marca has-[:checked]:bg-marca-claro has-[:checked]:text-marca"
                      >
                        <input type="radio" name="tipo" value={t} defaultChecked={i === 3} className="sr-only" />
                        <IconoTipo tipo={t} /> {INFO_TIPO[t].corto}
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input name="descripcion" placeholder="Descripción (p. ej. despacho 3 a mina)" className="campo sm:col-span-3" />
                    <select name="responsable_id" className="campo" defaultValue={perfil.id}>
                      <option value="">Responsable…</option>
                      {gente.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <select name="proveedor_id" className="campo" defaultValue="">
                      <option value="">Proveedor principal…</option>
                      {c.proveedores.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <select name="referencia_origen_id" className="campo" defaultValue="">
                      <option value="">Viene de… (opcional)</option>
                      {refs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.codigo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-tenue">Solo transporte:</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <select name="tipo_servicio" className="campo" defaultValue="">
                      <option value="">Tipo de servicio…</option>
                      {Object.entries(TIPOS_SERVICIO_TRANSPORTE).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input name="origen" placeholder="Origen" className="campo" />
                    <input name="destino" placeholder="Destino" className="campo" />
                  </div>
                </Formulario>
              </details>
            )}
          </Seccion>

          <Seccion id="contenedores" titulo={`Contenedores (${contenedores.data?.length ?? 0})`} icono={Boxes}>
            {(contenedores.data ?? []).length === 0 ? (
              <Vacio>Sin contenedores.</Vacio>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {(contenedores.data ?? []).map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-2 rounded-md border border-borde p-2.5">
                    <div>
                      <p className="codigo text-sm">{k.numero}</p>
                      <p className="text-xs text-tenue">
                        {k.tamano}&apos; {k.tipo}
                        {k.bultos ? ` · ${k.bultos} bultos` : ""}
                        {k.precinto ? ` · precinto ${k.precinto}` : ""}
                      </p>
                    </div>
                    {escribe ? (
                      <Formulario accion={cambiarEstadoContenedor.bind(null, expedienteId, k.id)} textoBoton="✓" boton="boton-mini" className="flex items-center gap-1 space-y-0">
                        <select name="estado" defaultValue={k.estado} className="campo py-1 text-xs">
                          {Object.entries(ESTADOS_CONTENEDOR).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </Formulario>
                    ) : (
                      <Insignia>{ESTADOS_CONTENEDOR[k.estado as keyof typeof ESTADOS_CONTENEDOR]}</Insignia>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {escribe && (
              <details className="mt-3 rounded-lg border border-borde p-3">
                <summary className="cursor-pointer text-sm font-medium text-marca">+ Agregar contenedores</summary>
                <Formulario accion={agregarContenedores.bind(null, expedienteId)} textoBoton="Agregar" limpiar className="mt-3">
                  <textarea name="numeros" rows={2} placeholder="MSCU1234567, MSCU7654321…" className="campo codigo" />
                  <div className="grid grid-cols-2 gap-3">
                    <select name="tamano" className="campo" defaultValue="20">
                      <option value="20">20&apos;</option>
                      <option value="40">40&apos;</option>
                    </select>
                    <input name="bultos" type="number" placeholder="Bultos por contenedor" className="campo" />
                  </div>
                </Formulario>
              </details>
            )}
          </Seccion>

          <Seccion id="documentos" titulo="Documentos del expediente" icono={FileText}>
            <PanelDocumentos
              expedienteId={expedienteId}
              referenciaId={null}
              documentos={docs}
              tipos={c.tiposDocumento}
              puedeEscribir={escribe}
              codigos={codigos}
            />
          </Seccion>

          <Seccion id="tareas" titulo="Tareas" icono={ListChecks}>
            <div className="space-y-3">
              <ListaTareas tareas={(tareas.data ?? []) as unknown as Tarea[]} puedeEscribir={escribe} contexto />
              {escribe && <NuevaTarea expedienteId={expedienteId} referenciaId={null} equipo={gente} />}
            </div>
          </Seccion>

          <Seccion id="bitacora" titulo="Bitácora entre áreas" icono={MessageSquare}>
            <Bitacora
              expedienteId={expedienteId}
              referenciaId={null}
              comentarios={(comentarios.data ?? []) as unknown as Comentario[]}
              puedeEscribir={escribe}
              alias={gente.map((g) => g.alias)}
            />
          </Seccion>

          <Seccion id="pagos" titulo="Solicitudes de pago" icono={Wallet}>
            <div className="space-y-3">
              <ListaPagos pagos={(pagos.data ?? []) as unknown as SolicitudPago[]} aprueba={perfil.rol === "finanzas"} contexto />
              {escribe && (
                <NuevaSolicitud
                  expedienteId={expedienteId}
                  referenciaId={null}
                  proveedores={c.proveedores}
                  documentos={docs.map((d) => ({ value: d.id, label: `${d.tipo_documento} · ${d.nombre_archivo}` }))}
                />
              )}
            </div>
          </Seccion>

          {costos && (
            <Seccion
              id="costeo"
              titulo="Costeo del expediente"
              icono={Calculator}
              extra={
                <Link href={`/finanzas/comprobantes/nuevo?expediente=${expedienteId}`} className="boton-mini">
                  + Comprobante
                </Link>
              }
            >
              <div className="space-y-4">
                <ResumenCosteo r={resumen.data as Resumen | null} />
                <div>
                  <p className="etiqueta">Proyectado (cotizado)</p>
                  <TablaCosteo lineas={(costeo.data ?? []) as unknown as LineaCosteo[]} puedeEscribir={escribe} />
                </div>
                {escribe && <NuevoCosteo expedienteId={expedienteId} referenciaId={null} conceptos={c.conceptos} proveedores={c.proveedores} />}
                <div>
                  <p className="etiqueta">Real (comprobantes)</p>
                  {(comprobantes.data ?? []).length === 0 ? (
                    <Vacio>Sin comprobantes registrados.</Vacio>
                  ) : (
                    <ul className="divide-y divide-borde rounded-lg border border-borde text-sm">
                      {(comprobantes.data ?? []).map((k) => (
                        <li key={k.id}>
                          <Link href={`/finanzas/comprobantes/${k.id}`} className="flex items-center gap-3 p-2.5 hover:bg-panel-2">
                            <Insignia tono={k.sentido === "EMITIDO" ? "acento" : "neutro"}>{k.sentido === "EMITIDO" ? "Venta" : "Compra"}</Insignia>
                            <span className="codigo">
                              {k.serie ?? "—"}-{k.numero ?? "borrador"}
                            </span>
                            <span className="flex-1 truncate text-tenue">{k.razon_social_contraparte}</span>
                            <span className="codigo">{dinero(k.total, k.moneda)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Seccion>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <Seccion id="datos" titulo="Datos del expediente">
            <dl className="grid grid-cols-2 gap-3">
              <Dato titulo="Ref. cliente" valor={e.ref_cliente} mono />
              <Dato titulo="Responsable" valor={(e.responsable as { nombre: string } | null)?.nombre} />
              <Dato titulo="Producto" valor={producto?.descripcion} />
              <Dato titulo="Cantidad" valor={e.cantidad ? `${e.cantidad} ${e.unidad_medida}` : null} />
              <Dato titulo="Bultos" valor={e.bultos} />
              <Dato titulo="Incoterm" valor={e.incoterm} />
              <Dato titulo="Origen" valor={e.pais_origen} />
              <Dato titulo="Destino" valor={(e.sede as { nombre: string } | null)?.nombre} />
              <Dato titulo="Apertura" valor={fecha(e.fecha_apertura)} />
              <Dato titulo="Régimen" valor={e.regimen} />
            </dl>
            {escribe && (
              <details className="mt-4 border-t border-borde pt-3">
                <summary className="cursor-pointer text-sm font-medium text-marca">Editar expediente</summary>
                <Formulario accion={actualizarExpediente.bind(null, expedienteId)} className="mt-3 [&_.grid]:!grid-cols-1">
                  <CamposExpediente c={c} equipo={gente} valores={e} />
                  <div>
                    <label className="etiqueta" htmlFor="estado">
                      Estado
                    </label>
                    <select id="estado" name="estado" defaultValue={e.estado} className="campo">
                      {Object.entries(ETIQUETA_ESTADO_EXPEDIENTE).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </Formulario>
              </details>
            )}
          </Seccion>
        </aside>
      </div>
    </>
  );
}
