"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensajeError, numero, texto, textoRequerido, validar, type ResultadoAccion } from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

const esquemaCliente = z.object({
  ruc: texto,
  razon_social: textoRequerido,
  nombre_comercial: texto,
  grupo: texto,
  contacto: texto,
  email: texto,
  telefono: texto,
  direccion: texto,
});

export async function crearCliente(_: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaCliente, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { data, error: e } = await supabase.from("cliente").insert(datos).select("id").single();
  if (e) return { error: mensajeError(e) };
  redirect(`/clientes/${data.id}`);
}

export async function actualizarCliente(clienteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaCliente.extend({ activo: z.preprocess((v) => v === true, z.boolean()) }), formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase.from("cliente").update(datos).eq("id", clienteId);
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Cambios guardados." };
}

const esquemaSede = z.object({
  nombre: textoRequerido,
  direccion: texto,
  region: texto,
  tiempo_estandar_horas: numero,
});

export async function crearSede(clienteId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaSede, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase.from("sede_cliente").insert({ ...datos, cliente_id: clienteId });
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Sede agregada." };
}
