"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { entero, id, idRequerido, mensajeError, numero, texto, uuid, validar, type ResultadoAccion } from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TIPOS_REFERENCIA } from "@/lib/tipos";



const esquemaExpediente = z.object({
  cliente_id: idRequerido,
  sede_destino_id: id,
  ref_cliente: texto,
  producto_id: id,
  descripcion: texto,
  cantidad: numero,
  unidad_medida: z.string().nullable().transform((v) => v ?? "TM"),
  bultos: entero,
  incoterm: texto,
  pais_origen: texto,
  responsable_id: uuid,
  observaciones: texto,
});

export async function crearExpediente(_: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaExpediente, formData);
  if (v.error !== null) return { error: v.error };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("expediente").insert(v.datos).select("id").single();
  if (error) return { error: mensajeError(error) };

  // Referencias marcadas al crear: nacen ya amarradas al expediente.
  const tipos = TIPOS_REFERENCIA.filter((t) => formData.get(`ref_${t}`) === "on");
  if (tipos.length) {
    const { error: e2 } = await supabase.from("referencia").insert(
      tipos.map((tipo) => ({ expediente_id: data.id, tipo, responsable_id: v.datos.responsable_id })),
    );
    if (e2) return { error: mensajeError(e2) };
    await crearDetalles(data.id);
  }
  redirect(`/expedientes/${data.id}`);
}

// Crea la fila de detalle (ref_carga, ref_aduana, ...) de las referencias que aún no la tienen.
async function crearDetalles(expedienteId: number) {
  const supabase = await crearClienteServidor();
  const { data: refs } = await supabase.from("referencia").select("id, tipo").eq("expediente_id", expedienteId);
  const tabla: Record<string, string> = {
    CARGA_MARITIMA: "ref_carga",
    CARGA_AEREA: "ref_carga",
    ADUANA: "ref_aduana",
    TRANSPORTE: "ref_transporte",
    ALMACENAJE: "ref_almacenaje",
  };
  for (const r of refs ?? []) {
    const extra = r.tipo === "CARGA_AEREA" ? { condicion: "AEREO" } : {};
    await supabase.from(tabla[r.tipo]).upsert({ referencia_id: r.id, ...extra }, { onConflict: "referencia_id", ignoreDuplicates: true });
  }
}

export async function actualizarExpediente(expedienteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(
    esquemaExpediente.extend({ estado: z.enum(["abierto", "en_curso", "cerrado", "anulado"]) }),
    formData,
  );
  if (v.error !== null) return { error: v.error };
  const datos = {
    ...v.datos,
    fecha_cierre: v.datos.estado === "cerrado" ? new Date().toISOString().slice(0, 10) : null,
  };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("expediente").update(datos).eq("id", expedienteId);
  if (error) return { error: mensajeError(error) };
  revalidatePath(`/expedientes/${expedienteId}`);
  return { ok: "Expediente actualizado." };
}

const esquemaReferencia = z.object({
  tipo: z.enum(TIPOS_REFERENCIA),
  descripcion: texto,
  responsable_id: uuid,
  proveedor_id: id,
  referencia_origen_id: id,
  tipo_servicio: texto,
  origen: texto,
  destino: texto,
});

export async function agregarReferencia(expedienteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaReferencia, formData);
  if (v.error !== null) return { error: v.error };
  const { tipo_servicio, origen, destino, ...ref } = v.datos;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("referencia")
    .insert({ ...ref, expediente_id: expedienteId })
    .select("id, codigo")
    .single();
  if (error) return { error: mensajeError(error) };
  await crearDetalles(expedienteId);
  if (ref.tipo === "TRANSPORTE" && (tipo_servicio || origen || destino)) {
    await supabase
      .from("ref_transporte")
      .update({ tipo_servicio: tipo_servicio ?? "DISTRIBUCION", origen, destino })
      .eq("referencia_id", data.id);
  }
  revalidatePath(`/expedientes/${expedienteId}`);
  return { ok: `${data.codigo} creada.` };
}

export async function agregarContenedores(expedienteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  // Se aceptan varios números separados por coma, espacio o salto de línea.
  const numeros = String(formData.get("numeros") ?? "")
    .split(/[\s,;]+/)
    .map((n) => n.trim().toUpperCase())
    .filter(Boolean);
  if (numeros.length === 0) return { error: "Ingresa al menos un número de contenedor." };
  const tamano = String(formData.get("tamano") || "20");
  const bultos = Number(formData.get("bultos")) || null;
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("contenedor")
    .insert(numeros.map((numero) => ({ expediente_id: expedienteId, numero, tamano, bultos })));
  if (error) return { error: mensajeError(error) };
  revalidatePath(`/expedientes/${expedienteId}`);
  return { ok: `${numeros.length} contenedor(es) agregado(s).` };
}

const ESTADOS_CONTENEDOR = ["en_transito", "en_puerto", "retirado", "en_almacen", "vaciado", "devuelto"] as const;

export async function cambiarEstadoContenedor(
  expedienteId: number,
  contenedorId: number,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const estado = z.enum(ESTADOS_CONTENEDOR).safeParse(formData.get("estado"));
  if (!estado.success) return { error: "Estado no válido." };
  const supabase = await crearClienteServidor();
  const ahora = new Date().toISOString();
  const marcas: Record<string, Record<string, string>> = {
    retirado: { hora_retiro: ahora },
    en_almacen: { fecha_ingreso_almacen: ahora },
    devuelto: { fecha_devolucion_vacio: ahora },
  };
  const { error } = await supabase
    .from("contenedor")
    .update({ estado: estado.data, ...(marcas[estado.data] ?? {}) })
    .eq("id", contenedorId);
  if (error) return { error: mensajeError(error) };
  revalidatePath(`/expedientes/${expedienteId}`);
  return { ok: "Contenedor actualizado." };
}
