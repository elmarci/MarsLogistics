import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark, ListOrdered, Receipt, Send } from "lucide-react";
import { BotonAccion, Formulario } from "@/components/Formulario";
import { Seccion } from "@/components/Seccion";
import { Dato, Encabezado, Insignia, Vacio, dinero, fecha } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ESTADOS_COMPROBANTE, TIPOS_COMPROBANTE, type EstadoComprobante, type TipoComprobante } from "@/lib/tipos";
import { agregarLinea, cambiarEstadoComprobante, eliminarBorrador, guardarDatosSunat, quitarLinea, registrarPago } from "../../actions";

export const metadata = { title: "Comprobante" };

export default async function ComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirInterno(["admin", "finanzas", "operaciones", "aduanas"]);
  const compId = Number((await params).id);
  const supabase = await crearClienteServidor();
  const { data: k } = await supabase
    .from("comprobante")
    .select("*, expediente:expediente_id(id, codigo), ref:comprobante_ref_id(id, serie, numero, tipo), detraccion:detraccion_codigo(descripcion)")
    .eq("id", compId)
    .maybeSingle();
  if (!k) notFound();

  const [{ data: lineas }, { data: pagos }, { data: saldo }, { data: notas }, c, { data: refs }, { data: solicitudes }] = await Promise.all([
    supabase
      .from("comprobante_linea")
      .select("*, concepto:concepto_id(nombre), referencia:referencia_id(id, codigo), expediente:expediente_id(codigo)")
      .eq("comprobante_id", compId)
      .order("id"),
    supabase.from("pago_comprobante").select("*").eq("comprobante_id", compId).order("fecha"),
    supabase.from("v_saldo_comprobante").select("pagado, notas_credito, saldo").eq("id", compId).maybeSingle(),
    supabase.from("comprobante").select("id, tipo, serie, numero, total, estado").eq("comprobante_ref_id", compId),
    catalogos(),
    k.expediente_id
      ? supabase.from("referencia").select("id, codigo").eq("expediente_id", k.expediente_id).order("codigo")
      : Promise.resolve({ data: [] as { id: number; codigo: string }[] }),
    k.sentido === "RECIBIDO"
      ? supabase.from("solicitud_pago").select("id, concepto, monto, moneda").eq("estado", "aprobada").eq("expediente_id", k.expediente_id ?? -1)
      : Promise.resolve({ data: [] as { id: number; concepto: string; monto: number; moneda: string }[] }),
  ]);

  const tipo = k.tipo as TipoComprobante;
  const estado = k.estado as EstadoComprobante;
  const editable = estado === "borrador" || estado === "registrado";
  const finanzas = perfil.rol === "finanzas" || perfil.rol === "admin";
  const registraPagos = perfil.rol === "finanzas";
  const emitido = k.sentido === "EMITIDO";
  const m = k.moneda as "USD" | "PEN";

  return (
    <>
      <Encabezado
        etiqueta={`${emitido ? "Venta" : "Compra"} · ${TIPOS_COMPROBANTE[tipo]}`}
        titulo={
          <span className="codigo">
            {k.serie ?? "—"}-{k.numero ?? "BORRADOR"}
          </span>
        }
        detalle={
          <span className="flex flex-wrap gap-2">
            <span className="text-texto">{k.razon_social_contraparte}</span>
            {k.ruc_contraparte && <span className="codigo">RUC {k.ruc_contraparte}</span>}
            {k.expediente && (
              <Link href={`/expedientes/${(k.expediente as { id: number }).id}`} className="codigo text-marca">
                {(k.expediente as { codigo: string }).codigo}
              </Link>
            )}
          </span>
        }
      >
        <Insignia tono={estado === "borrador" ? "aviso" : estado === "anulado" ? "alerta" : "acento"}>{ESTADOS_COMPROBANTE[estado]}</Insignia>
        {emitido && estado === "borrador" && finanzas && (
          <BotonAccion accion={cambiarEstadoComprobante.bind(null, compId, "emitido")} clase="boton" confirmar="Al emitir se asigna el número y ya no se puede modificar. ¿Continuar?">
            <Send className="h-4 w-4" /> Emitir
          </BotonAccion>
        )}
        {estado === "borrador" && (
          <BotonAccion accion={eliminarBorrador.bind(null, compId)} clase="boton-secundario" confirmar="¿Eliminar este borrador?">
            Eliminar borrador
          </BotonAccion>
        )}
        {!editable && estado !== "anulado" && emitido && (tipo === "FACTURA" || tipo === "BOLETA") && (
          <Link href={`/finanzas/comprobantes/nuevo?ref=${compId}`} className="boton-secundario">
            Nota de crédito / débito
          </Link>
        )}
        {estado !== "anulado" && estado !== "borrador" && finanzas && (
          <BotonAccion accion={cambiarEstadoComprobante.bind(null, compId, "anulado")} clase="boton-secundario" confirmar="¿Anular este comprobante?">
            Anular
          </BotonAccion>
        )}
      </Encabezado>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Seccion titulo="Detalle e imputación" icono={ListOrdered}>
            {(lineas ?? []).length === 0 ? (
              <Vacio>Agrega las líneas del comprobante.</Vacio>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-borde">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="text-xs font-medium text-tenue">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Descripción</th>
                      <th className="px-3 py-2 text-right font-medium">Cant. × valor</th>
                      <th className="px-3 py-2 text-left font-medium">IGV</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(lineas ?? []).map((l) => (
                      <tr key={l.id} className="border-t border-borde">
                        <td className="px-3 py-2">
                          {l.descripcion}
                          <span className="block text-xs text-tenue">
                            {(l.concepto as { nombre: string } | null)?.nombre}
                            {l.referencia ? (
                              <Link href={`/referencias/${(l.referencia as { id: number }).id}`} className="codigo ml-1 text-marca">
                                {(l.referencia as { codigo: string }).codigo}
                              </Link>
                            ) : (
                              l.expediente && <span className="codigo ml-1">{(l.expediente as { codigo: string }).codigo}</span>
                            )}
                          </span>
                        </td>
                        <td className="codigo px-3 py-2 text-right text-xs text-tenue">
                          {Number(l.cantidad)} × {dinero(l.valor_unitario, m)}
                        </td>
                        <td className="px-3 py-2 text-xs text-tenue">
                          {l.afectacion === "GRAVADO" ? dinero(l.igv, m) : l.afectacion.toLowerCase()}
                          {Number(l.isc) > 0 && <span className="block">ISC {dinero(l.isc, m)}</span>}
                        </td>
                        <td className="codigo px-3 py-2 text-right">{dinero(l.total, m)}</td>
                        <td className="px-2">
                          {editable && (
                            <BotonAccion accion={quitarLinea.bind(null, l.id)} titulo="Quitar">
                              ×
                            </BotonAccion>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editable && (
              <details className="mt-3 rounded-lg border border-borde p-3" open={(lineas ?? []).length === 0}>
                <summary className="cursor-pointer text-sm font-medium text-marca">+ Agregar línea</summary>
                <Formulario accion={agregarLinea.bind(null, compId)} textoBoton="Agregar línea" limpiar className="mt-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <select name="concepto_id" className="campo" defaultValue="">
                      <option value="">Concepto…</option>
                      {c.conceptos.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                    <input name="descripcion" required placeholder="Descripción en el comprobante" className="campo sm:col-span-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <input name="cantidad" type="number" step="0.001" defaultValue={1} className="campo" title="Cantidad" />
                    <input name="valor_unitario" type="number" step="0.0001" required placeholder="Valor unit. sin IGV" className="campo" />
                    <select name="afectacion" className="campo" defaultValue="GRAVADO">
                      <option value="GRAVADO">Gravado</option>
                      <option value="EXONERADO">Exonerado</option>
                      <option value="INAFECTO">Inafecto</option>
                      <option value="EXPORTACION">Exportación</option>
                    </select>
                    <input name="isc" type="number" step="0.01" placeholder="ISC" className="campo" />
                    <select name="referencia_id" className="campo" defaultValue="">
                      <option value="">Imputar a referencia…</option>
                      {(refs ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.codigo}
                        </option>
                      ))}
                    </select>
                  </div>
                </Formulario>
              </details>
            )}
          </Seccion>

          {estado !== "borrador" && estado !== "anulado" && tipo !== "NOTA_CREDITO" && (
            <Seccion titulo={emitido ? "Cobros" : "Pagos"} icono={Landmark}>
              {(pagos ?? []).length === 0 ? (
                <Vacio>Sin {emitido ? "cobros" : "pagos"} registrados.</Vacio>
              ) : (
                <ul className="divide-y divide-borde rounded-lg border border-borde text-sm">
                  {(pagos ?? []).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-2.5">
                      <span className="codigo w-24 text-xs text-tenue">{fecha(p.fecha)}</span>
                      <Insignia tono={p.medio === "DETRACCION" ? "aviso" : "neutro"}>{p.medio}</Insignia>
                      <span className="codigo flex-1 text-xs text-tenue">{p.numero_operacion}</span>
                      <span className="codigo">{dinero(p.monto, p.moneda)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {registraPagos && (
                <details className="mt-3 rounded-lg border border-borde p-3">
                  <summary className="cursor-pointer text-sm font-medium text-marca">+ Registrar {emitido ? "cobro" : "pago"}</summary>
                  <Formulario accion={registrarPago.bind(null, compId)} limpiar className="mt-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <input name="fecha" type="date" required defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" })} className="campo" />
                      <input name="monto" type="number" step="0.01" required placeholder="Monto" className="campo" />
                      <select name="moneda" defaultValue={m} className="campo">
                        <option value="USD">USD</option>
                        <option value="PEN">PEN</option>
                      </select>
                      <input name="tipo_cambio" type="number" step="0.0001" defaultValue={k.tipo_cambio} className="campo" title="Tipo de cambio" />
                      <select name="medio" className="campo" defaultValue="TRANSFERENCIA">
                        {["TRANSFERENCIA", "CHEQUE", "EFECTIVO", "TARJETA", "DETRACCION", "RETENCION", "OTRO"].map((x) => (
                          <option key={x} value={x}>
                            {x === "DETRACCION" ? "Depósito de detracción" : x.charAt(0) + x.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                      <input name="numero_operacion" placeholder="N.º operación / constancia" className="campo" />
                      <input name="cuenta" placeholder="Cuenta" className="campo" />
                      <select name="solicitud_pago_id" className="campo" defaultValue="">
                        <option value="">Solicitud aprobada…</option>
                        {(solicitudes ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.concepto} · {s.moneda} {s.monto}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Formulario>
                </details>
              )}
            </Seccion>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <Seccion titulo="Totales e impuestos" icono={Receipt}>
            <dl className="space-y-1.5 text-sm">
              {[
                ["Op. gravadas", k.base_gravada],
                ["Op. exoneradas", k.base_exonerada],
                ["Op. inafectas", k.base_inafecta],
                ["Exportación", k.base_exportacion],
                ["ISC", k.isc],
                [`IGV ${k.igv_porcentaje}%`, k.igv],
                ["Otros tributos", k.otros_tributos],
              ]
                .filter(([, v]) => Number(v) !== 0 || String(v).startsWith("Op. g"))
                .map(([t, v]) => (
                  <div key={t as string} className="flex justify-between">
                    <dt className="text-tenue">{t}</dt>
                    <dd className="codigo">{dinero(Number(v), m)}</dd>
                  </div>
                ))}
              <div className="flex justify-between border-t border-borde pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="codigo text-marca">{dinero(k.total, m)}</dd>
              </div>
              {k.detraccion_codigo && (
                <div className="flex justify-between text-aviso">
                  <dt>
                    Detracción {k.detraccion_porcentaje}%<span className="block text-[11px] text-tenue">{(k.detraccion as { descripcion: string } | null)?.descripcion}</span>
                  </dt>
                  <dd className="codigo">{dinero(k.detraccion_monto_pen, "PEN")}</dd>
                </div>
              )}
              {Number(k.retencion_monto) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-tenue">Retención</dt>
                  <dd className="codigo">−{dinero(k.retencion_monto, m)}</dd>
                </div>
              )}
              {Number(k.percepcion_monto) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-tenue">Percepción</dt>
                  <dd className="codigo">+{dinero(k.percepcion_monto, m)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-borde pt-2">
                <dt className="text-tenue">Neto a {emitido ? "cobrar" : "pagar"}</dt>
                <dd className="codigo">{dinero(k.neto_a_pagar, m)}</dd>
              </div>
              {saldo && (
                <>
                  {Number(saldo.notas_credito) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-tenue">Notas de crédito</dt>
                      <dd className="codigo">−{dinero(saldo.notas_credito, m)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-tenue">{emitido ? "Cobrado" : "Pagado"}</dt>
                    <dd className="codigo">−{dinero(saldo.pagado, m)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Saldo</dt>
                    <dd className={`codigo ${Number(saldo.saldo) > 0.005 ? "text-aviso" : "text-marca"}`}>{dinero(saldo.saldo, m)}</dd>
                  </div>
                </>
              )}
            </dl>
          </Seccion>

          <Seccion titulo="Datos">
            <dl className="grid grid-cols-2 gap-3">
              <Dato titulo="Emisión" valor={fecha(k.fecha_emision)} />
              <Dato titulo="Vencimiento" valor={fecha(k.fecha_vencimiento)} />
              <Dato titulo="Periodo" valor={k.periodo} mono />
              <Dato titulo="Forma de pago" valor={k.forma_pago} />
              <Dato titulo="Moneda / TC" valor={`${k.moneda} · ${k.tipo_cambio}`} mono />
              <Dato
                titulo="Modifica a"
                valor={
                  k.ref ? (
                    <Link href={`/finanzas/comprobantes/${(k.ref as { id: number }).id}`} className="codigo text-marca">
                      {(k.ref as { serie: string }).serie}-{(k.ref as { numero: string }).numero}
                    </Link>
                  ) : null
                }
              />
            </dl>
            {k.motivo_nota && <p className="mt-2 text-xs text-tenue">Motivo: {k.motivo_nota}</p>}
            {(notas ?? []).length > 0 && (
              <div className="mt-3 border-t border-borde pt-2">
                <p className="etiqueta">Notas emitidas</p>
                {(notas ?? []).map((n) => (
                  <Link key={n.id} href={`/finanzas/comprobantes/${n.id}`} className="codigo block text-xs text-marca">
                    {TIPOS_COMPROBANTE[n.tipo as TipoComprobante]} {n.serie}-{n.numero ?? "borrador"} · {dinero(n.total, m)}
                  </Link>
                ))}
              </div>
            )}
            {finanzas && (
              <details className="mt-3 border-t border-borde pt-3">
                <summary className="cursor-pointer text-sm font-medium text-marca">SUNAT y archivos</summary>
                <Formulario accion={guardarDatosSunat.bind(null, compId)} className="mt-3">
                  <input name="enlace_pdf" defaultValue={k.enlace_pdf ?? ""} placeholder="Enlace PDF" className="campo" />
                  <input name="enlace_xml" defaultValue={k.enlace_xml ?? ""} placeholder="Enlace XML" className="campo" />
                  <input name="enlace_cdr" defaultValue={k.enlace_cdr ?? ""} placeholder="Enlace CDR" className="campo" />
                  <input name="sunat_mensaje" defaultValue={k.sunat_mensaje ?? ""} placeholder="Respuesta SUNAT / OSE" className="campo" />
                  <textarea name="observacion" defaultValue={k.observacion ?? ""} rows={2} className="campo" placeholder="Observación" />
                </Formulario>
                {emitido && estado === "emitido" && (
                  <div className="mt-2 flex gap-1">
                    <BotonAccion accion={cambiarEstadoComprobante.bind(null, compId, "aceptado_sunat")}>Aceptado SUNAT</BotonAccion>
                    <BotonAccion accion={cambiarEstadoComprobante.bind(null, compId, "rechazado_sunat")}>Rechazado</BotonAccion>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-tenue">El envío automático a SUNAT por un OSE/PSE se conecta en un paso siguiente.</p>
              </details>
            )}
          </Seccion>
        </aside>
      </div>
    </>
  );
}
