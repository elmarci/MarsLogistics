"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  casilla,
  entero,
  id,
  idRequerido,
  mensajeError,
  numero,
  texto,
  textoRequerido,
  validar,
  type ResultadoAccion,
} from "@/lib/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ESTADOS_ORDEN } from "@/lib/tipos";

const esquemaOrden = z.object({
  codigo: textoRequerido,
  cliente_id: idRequerido,
  sede_destino_id: id,
  ref_cliente: texto,
  ref_agente: texto,
  producto_id: id,
  cantidad: numero,
  unidad_medida: z.string().nullable().transform((v) => v ?? "TM"),
  bultos: entero,
  incoterm: texto,
  fecha_recepcion: texto,
  observaciones: texto,
});

export async function crearOrden(_: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(esquemaOrden, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { data, error: e } = await supabase
    .from("orden")
    .insert({ ...datos, codigo: datos.codigo.toUpperCase() })
    .select("id")
    .single();
  if (e) return { error: mensajeError(e) };
  redirect(`/ordenes/${data.id}`);
}

export async function actualizarOrden(ordenId: number, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const v = validar(
    esquemaOrden.extend({ estado: z.enum(ESTADOS_ORDEN), fecha_cierre: texto }),
    formData,
  );
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase.from("orden").update(datos).eq("id", ordenId);
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: "Orden actualizada." };
}

// ---------- Embarque (tránsito internacional) ----------
const esquemaEmbarque = z.object({
  naviera_id: id,
  terminal_id: id,
  condicion: z.enum(["FCL", "LCL"]).default("FCL"),
  mbl: texto,
  hbl: texto,
  manifiesto: texto,
  puerto_origen: texto,
  puerto_destino: z.string().nullable().transform((v) => v ?? "CALLAO"),
  etd: texto,
  eta: texto,
  fecha_llegada: texto,
  dias_libres: entero,
  vencimiento_memo: texto,
});

export async function guardarEmbarque(
  ordenId: number,
  embarqueId: number | null,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(esquemaEmbarque, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { error: e } = embarqueId
    ? await supabase.from("embarque").update(datos).eq("id", embarqueId)
    : await supabase.from("embarque").insert({ ...datos, orden_id: ordenId });
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: "Embarque guardado." };
}

// ---------- Contenedores ----------
export async function agregarContenedores(
  ordenId: number,
  embarqueId: number,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  // Se aceptan varios números separados por coma, espacio o salto de línea.
  const numeros = String(formData.get("numeros") ?? "")
    .split(/[\s,;]+/)
    .map((n) => n.trim().toUpperCase())
    .filter(Boolean);
  if (numeros.length === 0) return { error: "Ingresa al menos un número de contenedor." };
  const tamano = String(formData.get("tamano") ?? "20");
  const bultos = Number(formData.get("bultos")) || null;

  const supabase = await crearClienteServidor();
  const { error: e } = await supabase
    .from("contenedor")
    .insert(numeros.map((numero) => ({ embarque_id: embarqueId, numero, tamano, bultos })));
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: `${numeros.length} contenedor(es) agregado(s).` };
}

const esquemaContenedor = z.object({
  numero: textoRequerido,
  tamano: z.string().nullable().transform((v) => v ?? "20"),
  precinto: texto,
  peso_bruto_kg: numero,
  bultos: entero,
  transporte_local_id: id,
  hora_descarga: texto,
  hora_cita: texto,
  hora_retiro: texto,
  perdida_cita_puerto: casilla,
  uso_area_puerto: casilla,
  fecha_ingreso_almacen: texto,
  fecha_apertura_almacen: texto,
  deposito_vacio_id: id,
  cita_vacio: texto,
  fecha_devolucion_vacio: texto,
  perdida_cita_vacio: casilla,
  estado: z.enum(["en_transito", "en_puerto", "retirado", "en_almacen", "vaciado", "devuelto"]),
});

// Los campos datetime-local llegan sin zona: se interpretan en hora de Lima.
const conZonaLima = (v: string | null | undefined) => (v && v.length === 16 ? `${v}:00-05:00` : v ?? null);

export async function actualizarContenedor(
  ordenId: number,
  contenedorId: number,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(esquemaContenedor, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const d = datos;
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase
    .from("contenedor")
    .update({
      ...d,
      numero: d.numero.toUpperCase(),
      hora_descarga: conZonaLima(d.hora_descarga),
      hora_cita: conZonaLima(d.hora_cita),
      hora_retiro: conZonaLima(d.hora_retiro),
      fecha_ingreso_almacen: conZonaLima(d.fecha_ingreso_almacen),
      cita_vacio: conZonaLima(d.cita_vacio),
      fecha_devolucion_vacio: conZonaLima(d.fecha_devolucion_vacio),
    })
    .eq("id", contenedorId);
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: "Contenedor actualizado." };
}

// ---------- Aduana ----------
const esquemaAduana = z.object({
  agente_id: id,
  dam: texto,
  fecha_envio_docs: texto,
  fecha_borradores: texto,
  fecha_numeracion: texto,
  fecha_pago_derechos: texto,
  fecha_levante: texto,
  canal: z.enum(["VERDE", "NARANJA", "ROJO"]).nullable(),
  invoice: texto,
  valor_fob: numero,
  valor_cif: numero,
  estado: z.enum(["pendiente", "numerado", "en_revision", "liberado"]),
});

export async function guardarAduana(
  ordenId: number,
  aduanaId: number | null,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(esquemaAduana, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const d = { ...datos, fecha_numeracion: conZonaLima(datos.fecha_numeracion), fecha_levante: conZonaLima(datos.fecha_levante) };
  const supabase = await crearClienteServidor();
  const { error: e } = aduanaId
    ? await supabase.from("despacho_aduanero").update(d).eq("id", aduanaId)
    : await supabase.from("despacho_aduanero").insert({ ...d, orden_id: ordenId });
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: "Datos de aduana guardados." };
}

const esquemaDuda = z.object({
  numero_notificacion: texto,
  descripcion: texto,
  fecha_emision: texto,
  fecha_recepcion: texto,
  plazo_respuesta: texto,
  garantia: texto,
});

export async function registrarDudaRazonable(
  ordenId: number,
  aduanaId: number,
  _: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const v = validar(esquemaDuda, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase.from("duda_razonable").insert({ ...datos, despacho_aduanero_id: aduanaId });
  if (e) return { error: mensajeError(e) };
  revalidatePath(`/ordenes/${ordenId}`);
  return { ok: "Duda razonable registrada." };
}
