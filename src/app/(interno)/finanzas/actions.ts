"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { id, mensajeError, numero, texto, validar, type ResultadoAccion } from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

const refrescar = () => revalidatePath("/", "layout");
const limpiar = (m: string) => m.replace("No se pudo guardar: ", "");

const esquemaCabecera = z.object({
  sentido: z.enum(["EMITIDO", "RECIBIDO"]),
  tipo: z.enum(["FACTURA", "BOLETA", "NOTA_CREDITO", "NOTA_DEBITO", "RECIBO_HONORARIOS", "LIQUIDACION_COMPRA", "DAM", "TICKET", "OTRO"]),
  serie: texto,
  numero: texto,
  fecha_emision: z.string().min(1, "es obligatorio"),
  fecha_vencimiento: texto,
  cliente_id: id,
  proveedor_id: id,
  expediente_id: id,
  moneda: z.enum(["USD", "PEN"]),
  tipo_cambio: z.preprocess((v) => v ?? 1, z.coerce.number().positive()),
  igv_porcentaje: z.preprocess((v) => v ?? 18, z.coerce.number().min(0)),
  forma_pago: z.enum(["CONTADO", "CREDITO"]),
  detraccion_codigo: texto,
  retencion_monto: z.preprocess((v) => v ?? 0, z.coerce.number().min(0)),
  percepcion_monto: z.preprocess((v) => v ?? 0, z.coerce.number().min(0)),
  otros_tributos: z.preprocess((v) => v ?? 0, z.coerce.number().min(0)),
  comprobante_ref_id: id,
  motivo_nota: texto,
  observacion: texto,
});

export async function crearComprobante(_: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaCabecera, formData);
  if (v.error !== null) return { error: v.error };
  const d = v.datos;
  if (d.sentido === "EMITIDO" && !d.cliente_id) return { error: "Elige el cliente." };
  if (d.sentido === "RECIBIDO" && !d.proveedor_id) return { error: "Elige el proveedor." };
  if (d.sentido === "RECIBIDO" && (!d.serie || !d.numero)) return { error: "Indica serie y número del comprobante del proveedor." };
  if ((d.tipo === "NOTA_CREDITO" || d.tipo === "NOTA_DEBITO") && !d.comprobante_ref_id) return { error: "Una nota debe referir al comprobante que modifica." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("comprobante")
    .insert({
      ...d,
      serie: d.serie?.toUpperCase() ?? null,
      numero: d.sentido === "EMITIDO" ? null : d.numero,
      cliente_id: d.sentido === "EMITIDO" ? d.cliente_id : null,
      proveedor_id: d.sentido === "RECIBIDO" ? d.proveedor_id : null,
      // Lo recibido ya existe: se registra. Lo emitido nace en borrador hasta que Finanzas lo emita.
      estado: d.sentido === "RECIBIDO" ? "registrado" : "borrador",
    })
    .select("id")
    .single();
  if (error) return { error: limpiar(mensajeError(error)) };
  redirect(`/finanzas/comprobantes/${data.id}`);
}

const esquemaLinea = z.object({
  concepto_id: id,
  descripcion: z.string({ required_error: "es obligatorio" }).min(1, "es obligatorio"),
  cantidad: z.preprocess((v) => v ?? 1, z.coerce.number().positive()),
  valor_unitario: z.coerce.number({ invalid_type_error: "es obligatorio" }).min(0),
  afectacion: z.enum(["GRAVADO", "EXONERADO", "INAFECTO", "EXPORTACION"]),
  isc: z.preprocess((v) => v ?? 0, z.coerce.number().min(0)),
  expediente_id: id,
  referencia_id: id,
});

export async function agregarLinea(comprobanteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaLinea, formData);
  if (v.error !== null) return { error: v.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("comprobante_linea").insert({ ...v.datos, comprobante_id: comprobanteId });
  if (error) return { error: limpiar(mensajeError(error)) };
  refrescar();
  return { ok: "Línea agregada." };
}

export async function quitarLinea(lineaId: number): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("comprobante_linea").delete().eq("id", lineaId);
  if (error) return { error: limpiar(mensajeError(error)) };
  refrescar();
  return { ok: "Línea quitada." };
}

export async function cambiarEstadoComprobante(
  comprobanteId: number,
  estado: "emitido" | "anulado" | "aceptado_sunat" | "rechazado_sunat",
): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("comprobante").update({ estado }).eq("id", comprobanteId);
  if (error) return { error: limpiar(mensajeError(error)) };
  refrescar();
  return { ok: "Comprobante actualizado." };
}

export async function eliminarBorrador(comprobanteId: number): Promise<ResultadoAccion> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("comprobante").delete().eq("id", comprobanteId);
  if (error) return { error: limpiar(mensajeError(error)) };
  refrescar();
  redirect("/finanzas/comprobantes");
}

const esquemaPago = z.object({
  fecha: z.string().min(1),
  monto: z.coerce.number().positive("debe ser mayor a cero"),
  moneda: z.enum(["USD", "PEN"]),
  tipo_cambio: z.preprocess((v) => v ?? 1, z.coerce.number().positive()),
  medio: z.enum(["TRANSFERENCIA", "CHEQUE", "EFECTIVO", "TARJETA", "DETRACCION", "RETENCION", "OTRO"]),
  numero_operacion: texto,
  cuenta: texto,
  solicitud_pago_id: id,
  observacion: texto,
});

export async function registrarPago(comprobanteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaPago, formData);
  if (v.error !== null) return { error: v.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("pago_comprobante").insert({ ...v.datos, comprobante_id: comprobanteId });
  if (error) return { error: limpiar(mensajeError(error)) };
  if (v.datos.medio === "DETRACCION") {
    await supabase
      .from("comprobante")
      .update({ detraccion_constancia: v.datos.numero_operacion, detraccion_fecha: v.datos.fecha })
      .eq("id", comprobanteId);
  }
  refrescar();
  return { ok: "Pago registrado." };
}

const esquemaSunat = z.object({ sunat_mensaje: texto, enlace_pdf: texto, enlace_xml: texto, enlace_cdr: texto, observacion: texto, tipo_cambio: numero });

export async function guardarDatosSunat(comprobanteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaSunat, formData);
  if (v.error !== null) return { error: v.error };
  const { tipo_cambio, ...resto } = v.datos;
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("comprobante")
    .update({ ...resto, ...(tipo_cambio ? { tipo_cambio } : {}) })
    .eq("id", comprobanteId);
  if (error) return { error: limpiar(mensajeError(error)) };
  refrescar();
  return { ok: "Guardado." };
}
