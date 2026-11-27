"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { casilla, mensajeError, texto, textoRequerido, validar, type ResultadoAccion } from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TIPOS_PROVEEDOR } from "@/lib/tipos";

const esquema = z.object({
  razon_social: textoRequerido,
  nombre_corto: texto,
  ruc: texto,
  pais: z.string().nullable().transform((v) => v ?? "PE"),
  tipo: z.enum(TIPOS_PROVEEDOR, { errorMap: () => ({ message: "elige un tipo" }) }),
  contacto: texto,
  email: texto,
  telefono: texto,
  condiciones_pago: texto,
  estado_homologacion: z.enum(["pendiente", "homologado", "observado", "suspendido"]).default("pendiente"),
});

export async function crearProveedor(_: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquema, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { data, error: e } = await supabase.from("proveedor").insert(datos).select("id").single();
  if (e) return { error: mensajeError(e) };
  redirect(`/proveedores/${data.id}`);
}

export async function actualizarProveedor(proveedorId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquema.extend({ activo: casilla }), formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase.from("proveedor").update(datos).eq("id", proveedorId);
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/proveedores/${proveedorId}`);
  return { ok: "Cambios guardados." };
}
