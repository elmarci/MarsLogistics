"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { conZonaLima, id, mensajeError, numero, texto, uuid, validar, type ResultadoAccion } from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

// Documentos, tareas, bitácora, pagos, costeo y avisos: comunes a expedientes y referencias.
const refrescar = () => revalidatePath("/", "layout");
const MAX_BYTES = 20 * 1024 * 1024;

// ---------- Documentos ----------
export async function subirDocumento(
  expedienteId: number,
  referenciaId: number | null,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const archivo = formData.get("archivo");
  const tipo = String(formData.get("tipo_documento") ?? "");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige un archivo." };
  if (!tipo) return { error: "Elige el tipo de documento." };
  if (archivo.size > MAX_BYTES) return { error: "El archivo supera 20 MB." };
  const vencimiento = String(formData.get("vencimiento") ?? "") || null;
  const visible = formData.get("visible_cliente") === "on";

  const supabase = await crearClienteServidor();
  const limpio = archivo.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-120);
  const ruta = `${expedienteId}/${referenciaId ?? "general"}/${Date.now()}-${limpio}`;
  const { error: eSubida } = await supabase.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type || "application/octet-stream" });
  if (eSubida) return { error: `No se pudo subir el archivo: ${eSubida.message}` };

  const { error } = await supabase.from("documento").insert({
    expediente_id: expedienteId,
    referencia_id: referenciaId,
    tipo_documento: tipo,
    nombre_archivo: archivo.name,
    ruta_storage: ruta,
    tamano_bytes: archivo.size,
    vencimiento,
    visible_cliente: visible,
  });
  if (error) {
    await supabase.storage.from("documentos").remove([ruta]);
    return { error: mensajeError(error) };
  }
  refrescar();
  return { ok: "Documento subido. Queda por validar." };
}

export async function revisarDocumento(documentoId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const estado = z.enum(["validado", "observado", "rechazado", "pendiente"]).safeParse(formData.get("estado"));
  if (!estado.success) return { error: "Estado no válido." };
  const observacion = String(formData.get("observacion") ?? "").trim() || null;
  if (estado.data !== "validado" && estado.data !== "pendiente" && !observacion)
    return { error: "Escribe qué está mal para que lo corrijan." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("documento").update({ estado: estado.data, observacion }).eq("id", documentoId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Documento revisado." };
}

export async function alternarVisibleDocumento(documentoId: number, visible: boolean): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("documento").update({ visible_cliente: visible }).eq("id", documentoId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: visible ? "Visible para el cliente." : "Oculto al cliente." };
}

// ---------- Tareas ----------
const esquemaTarea = z.object({
  titulo: z.string({ required_error: "es obligatorio" }).min(1, "es obligatorio"),
  descripcion: texto,
  asignado_a: uuid,
  vence_en: texto,
});

export async function crearTarea(
  expedienteId: number,
  referenciaId: number | null,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(esquemaTarea, formData);
  if (v.error !== null) return { error: v.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarea").insert({
    ...v.datos,
    vence_en: conZonaLima(v.datos.vence_en),
    expediente_id: expedienteId,
    referencia_id: referenciaId,
  });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Tarea asignada." };
}

export async function cambiarEstadoTarea(tareaId: number, estado: "pendiente" | "en_proceso" | "hecha" | "cancelada"): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarea").update({ estado }).eq("id", tareaId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Tarea actualizada." };
}

// ---------- Bitácora ----------
export async function comentar(
  expedienteId: number,
  referenciaId: number | null,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const textoComentario = String(formData.get("texto") ?? "").trim();
  if (!textoComentario) return { error: "Escribe un comentario." };
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("comentario").insert({
    expediente_id: expedienteId,
    referencia_id: referenciaId,
    autor_id: user?.id,
    texto: textoComentario,
  });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Publicado." };
}

// ---------- Solicitudes de pago ----------
const esquemaPago = z.object({
  concepto: z.string({ required_error: "es obligatorio" }).min(1, "es obligatorio"),
  proveedor_id: id,
  monto: z.coerce.number({ invalid_type_error: "debe ser un número" }).positive("debe ser mayor a cero"),
  moneda: z.enum(["USD", "PEN"]),
  fecha_limite: texto,
  documento_id: id,
  observacion: texto,
});

export async function solicitarPago(
  expedienteId: number,
  referenciaId: number | null,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(esquemaPago, formData);
  if (v.error !== null) return { error: v.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("solicitud_pago")
    .insert({ ...v.datos, expediente_id: expedienteId, referencia_id: referenciaId });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Solicitud enviada a Finanzas." };
}

export async function cambiarEstadoPago(
  solicitudId: number,
  estado: "aprobada" | "rechazada" | "pagada",
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const observacion = String(formData.get("observacion") ?? "").trim() || undefined;
  const comprobante = String(formData.get("comprobante") ?? "").trim() || undefined;
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("solicitud_pago")
    .update({ estado, ...(observacion ? { observacion } : {}), ...(comprobante ? { comprobante } : {}) })
    .eq("id", solicitudId);
  if (error) return { error: mensajeError(error).replace("No se pudo guardar: ", "") };
  refrescar();
  return { ok: `Solicitud ${estado}.` };
}

// ---------- Costeo proyectado ----------
const esquemaCosto = z.object({
  concepto_id: z.coerce.number({ invalid_type_error: "es obligatorio" }).int().positive("es obligatorio"),
  proveedor_id: id,
  tipo: z.enum(["COSTO", "VENTA", "VENTA_EXTRA", "SOBRECOSTO", "REEMBOLSO"]),
  sobrecosto_asume: z.enum(["CLIENTE", "MAC"]).nullable(),
  cantidad: z.preprocess((v) => v ?? 1, z.coerce.number().positive()),
  valor_unitario: z.coerce.number({ invalid_type_error: "es obligatorio" }),
  moneda: z.enum(["USD", "PEN"]),
  tipo_cambio: z.preprocess((v) => v ?? 1, z.coerce.number().positive()),
  igv: numero,
});

export async function registrarCosteo(
  expedienteId: number,
  referenciaId: number | null,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(esquemaCosto, formData);
  if (v.error !== null) return { error: v.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("movimiento_economico").insert({
    ...v.datos,
    igv: v.datos.igv ?? 0,
    expediente_id: expedienteId,
    referencia_id: referenciaId,
  });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Línea de costeo agregada." };
}

export async function anularCosteo(movimientoId: number): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("movimiento_economico").update({ estado: "anulado" }).eq("id", movimientoId);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Línea anulada." };
}

// ---------- Avisos ----------
export async function marcarLeidas(ids: number[] | "todas"): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const q = supabase.from("notificacion").update({ leida: true }).eq("leida", false);
  const { error } = ids === "todas" ? await q : await q.in("id", ids);
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Listo." };
}
