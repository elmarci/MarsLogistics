"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { casilla, mensajeError, numero, texto, textoRequerido, validar, type ResultadoAccion } from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

const esquema = z.object({
  codigo: texto,
  descripcion: textoRequerido,
  partida_arancelaria: texto,
  es_matpel: casilla,
  clase_onu: texto,
  numero_onu: texto,
  unidad_medida: z.string().nullable().transform((v) => v ?? "TM"),
  unidad_bulto: z.string().nullable().transform((v) => v ?? "CAJA"),
  peso_bulto_kg: numero,
});

export async function crearProducto(_: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquema, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase.from("producto").insert(datos);
  if (e) return { error: mensajeError(e) };
  revalidatePath("/productos");
  return { ok: "Producto creado." };
}
