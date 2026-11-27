"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  casilla,
  conZonaLima,
  entero,
  id,
  mensajeError,
  numero,
  texto,
  uuid,
  validar,
  type ResultadoAccion,
} from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

const refrescar = () => revalidatePath("/", "layout");

// ---------- Etapas ----------
export async function cambiarEtapa(referenciaId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const etapaId = Number(formData.get("etapa_id"));
  if (!etapaId) return { error: "Elige una etapa." };
  const nota = String(formData.get("nota") ?? "").trim();
  const supabase = await crearClienteServidor();
  const { data: ref, error } = await supabase
    .from("referencia")
    .update({ etapa_id: etapaId })
    .eq("id", referenciaId)
    .select("expediente_id, etapa:etapa_id(nombre)")
    .single();
  if (error) return { error: mensajeError(error) };
  const etapa = (ref.etapa as unknown as { nombre: string } | null)?.nombre ?? "";
  // El cambio queda en la bitácora para que las demás áreas lo vean.
  await supabase.from("comentario").insert({
    expediente_id: ref.expediente_id,
    referencia_id: referenciaId,
    texto: `▸ Etapa: ${etapa}${nota ? ` — ${nota}` : ""}`,
  });
  refrescar();
  return { ok: `Ahora en: ${etapa}` };
}

const esquemaGeneral = z.object({
  descripcion: texto,
  responsable_id: uuid,
  proveedor_id: id,
  visible_cliente: casilla,
  anulada: casilla,
});

export async function actualizarReferencia(referenciaId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaGeneral, formData);
  if (v.error !== null) return { error: v.error };
  const { anulada, ...datos } = v.datos;
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("referencia").select("estado").eq("id", referenciaId).single();
  const estado = anulada ? "anulada" : actual?.estado === "anulada" ? "activa" : undefined;
  const { error } = await supabase
    .from("referencia")
    .update({ ...datos, ...(estado ? { estado } : {}) })
    .eq("id", referenciaId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Referencia actualizada." };
}

// ---------- Detalle por tipo ----------
const esquemaCarga = z.object({
  booking: texto,
  mbl: texto,
  hbl: texto,
  nave_viaje: texto,
  manifiesto: texto,
  condicion: z.enum(["FCL", "LCL", "AEREO"]).default("FCL"),
  puerto_origen: texto,
  puerto_destino: z.string().nullable().transform((v) => v ?? "CALLAO"),
  terminal_id: id,
  etd: texto,
  eta: texto,
  fecha_zarpe: texto,
  fecha_llegada: texto,
  dias_libres: entero,
  vencimiento_memo: texto,
});

const esquemaAduana = z.object({
  regimen_aduanero: texto,
  dam: texto,
  ref_agente: texto,
  fecha_numeracion: texto,
  fecha_pago_derechos: texto,
  canal: z.enum(["VERDE", "NARANJA", "ROJO"]).nullable(),
  fecha_levante: texto,
  invoice: texto,
  valor_fob: numero,
  valor_cif: numero,
  derechos_usd: numero,
});

const esquemaTransporte = z.object({
  tipo_servicio: z.enum(["RETIRO_PUERTO", "TRASLADO_ALMACEN", "DISTRIBUCION", "DEVOLUCION_VACIO", "OTRO"]),
  origen: texto,
  destino: texto,
  sede_destino_id: id,
  fecha_programada: texto,
  bultos: entero,
  servicio_especial: casilla,
  observaciones: texto,
});

const esquemaAlmacenaje = z.object({
  almacen_id: id,
  producto_id: id,
  fecha_ingreso: texto,
  bultos_inicial: z.preprocess((v) => v ?? 0, z.coerce.number().int().min(0)),
  ubicacion: texto,
  m2_ocupados: numero,
});

const DETALLE = {
  ref_carga: esquemaCarga,
  ref_aduana: esquemaAduana,
  ref_transporte: esquemaTransporte,
  ref_almacenaje: esquemaAlmacenaje,
} as const;

export async function guardarDetalle(
  referenciaId: number,
  tabla: keyof typeof DETALLE,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(DETALLE[tabla], formData);
  if (v.error !== null) return { error: v.error };
  const datos: Record<string, unknown> = { ...v.datos };
  for (const k of ["fecha_numeracion", "fecha_levante"]) if (k in datos) datos[k] = conZonaLima(datos[k] as string | null);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from(tabla).upsert({ referencia_id: referenciaId, ...datos }, { onConflict: "referencia_id" });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Datos guardados." };
}

// ---------- Transporte: unidades ----------
const esquemaUnidad = z.object({
  contenedor_id: id,
  placa_tracto: texto,
  placa_carreta: texto,
  conductor: texto,
  bultos: entero,
  precinto: texto,
  gre_remitente: texto,
  gre_transportista: texto,
  salida: texto,
  llegada: texto,
});

export async function agregarUnidad(referenciaId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaUnidad, formData);
  if (v.error !== null) return { error: v.error };
  const d = v.datos;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("transporte_unidad").insert({
    ...d,
    referencia_id: referenciaId,
    placa_tracto: d.placa_tracto?.toUpperCase() ?? null,
    placa_carreta: d.placa_carreta?.toUpperCase() ?? null,
    salida: conZonaLima(d.salida),
    llegada: conZonaLima(d.llegada),
  });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Unidad agregada." };
}

export async function marcarUnidad(unidadId: number, campo: "salida" | "llegada"): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("transporte_unidad").update({ [campo]: new Date().toISOString() }).eq("id", unidadId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Hora registrada." };
}

export async function quitarUnidad(unidadId: number): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("transporte_unidad").delete().eq("id", unidadId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Unidad quitada." };
}

// ---------- Almacenaje: despacho (crea la TRA y descuenta stock) ----------
const esquemaDespacho = z.object({
  bultos: z.coerce.number({ invalid_type_error: "es obligatorio" }).int().positive("debe ser mayor a cero"),
  sede_destino_id: id,
  destino: texto,
  fecha_programada: texto,
  placa_tracto: texto,
  placa_carreta: texto,
  conductor: texto,
  responsable_id: uuid,
});

export async function programarDespacho(almacenajeId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaDespacho, formData);
  if (v.error !== null) return { error: v.error };
  const d = v.datos;
  const supabase = await crearClienteServidor();
  const { data: alm } = await supabase
    .from("referencia")
    .select("id, expediente_id, codigo, ref_almacenaje(almacen:almacen_id(nombre))")
    .eq("id", almacenajeId)
    .single();
  if (!alm) return { error: "No se encontró la referencia de almacenaje." };
  const almacen = (alm.ref_almacenaje as unknown as { almacen: { nombre: string } | null } | null)?.almacen?.nombre ?? "Almacén";
  let destino = d.destino;
  if (!destino && d.sede_destino_id) {
    const { data: sede } = await supabase.from("sede_cliente").select("nombre").eq("id", d.sede_destino_id).single();
    destino = sede?.nombre ?? null;
  }

  const { data: tra, error } = await supabase
    .from("referencia")
    .insert({
      expediente_id: alm.expediente_id,
      tipo: "TRANSPORTE",
      referencia_origen_id: alm.id,
      responsable_id: d.responsable_id,
      descripcion: `Despacho ${d.bultos} bultos desde ${almacen}${destino ? ` a ${destino}` : ""}`,
    })
    .select("id, codigo")
    .single();
  if (error) return { error: mensajeError(error) };

  const pasos = await Promise.all([
    supabase.from("ref_transporte").insert({
      referencia_id: tra.id,
      tipo_servicio: "DISTRIBUCION",
      origen: almacen,
      destino,
      sede_destino_id: d.sede_destino_id,
      fecha_programada: d.fecha_programada,
      bultos: d.bultos,
    }),
    supabase
      .from("transporte_unidad")
      .insert({
        referencia_id: tra.id,
        placa_tracto: d.placa_tracto?.toUpperCase() ?? null,
        placa_carreta: d.placa_carreta?.toUpperCase() ?? null,
        conductor: d.conductor,
        bultos: d.bultos,
      })
      .select("id")
      .single(),
  ]);
  const fallo = pasos.find((p) => p.error);
  if (fallo?.error) return { error: mensajeError(fallo.error) };
  const unidadId = (pasos[1].data as { id: number } | null)?.id ?? null;

  const { error: e3 } = await supabase.from("movimiento_stock").insert({
    referencia_id: alm.id,
    tipo: "SALIDA",
    bultos: -d.bultos,
    transporte_unidad_id: unidadId,
    observacion: `Despacho ${tra.codigo}`,
  });
  if (e3) {
    // Sin stock suficiente no queda la TRA a medias.
    await supabase.from("referencia").delete().eq("id", tra.id);
    return { error: mensajeError(e3).replace("No se pudo guardar: ", "") };
  }
  refrescar();
  return { ok: `${tra.codigo} creada y ${d.bultos} bultos descontados del stock.` };
}

export async function ajustarStock(almacenajeId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const bultos = Number(formData.get("bultos"));
  if (!Number.isInteger(bultos) || bultos === 0) return { error: "Indica bultos (+ ingresa, − sale)." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("movimiento_stock").insert({
    referencia_id: almacenajeId,
    tipo: "AJUSTE",
    bultos,
    observacion: String(formData.get("observacion") ?? "") || null,
  });
  if (error) return { error: mensajeError(error).replace("No se pudo guardar: ", "") };
  refrescar();
  return { ok: "Ajuste registrado." };
}

// ---------- Aduana: duda razonable ----------
const esquemaDuda = z.object({
  numero_notificacion: texto,
  descripcion: texto,
  fecha_recepcion: texto,
  plazo_respuesta: texto,
  garantia: texto,
});

export async function agregarDuda(referenciaId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaDuda, formData);
  if (v.error !== null) return { error: v.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("duda_razonable").insert({ ...v.datos, referencia_id: referenciaId });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Duda razonable registrada." };
}

export async function cerrarDuda(dudaId: number, estado: "respondida" | "cerrada"): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("duda_razonable").update({ estado }).eq("id", dudaId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Actualizado." };
}

