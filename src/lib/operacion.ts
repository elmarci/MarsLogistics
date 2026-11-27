import { crearClienteServidor } from "@/lib/supabase/server";
import type { Etapa, TipoReferencia } from "@/lib/tipos";

// Catálogo de etapas agrupado por tipo de referencia, en orden de flujo.
export async function etapasPorTipo(): Promise<Record<TipoReferencia, Etapa[]>> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("etapa")
    .select("id, tipo, orden, codigo, nombre, horas_estandar, es_final")
    .order("tipo")
    .order("orden");
  const r = { CARGA_MARITIMA: [], CARGA_AEREA: [], ADUANA: [], TRANSPORTE: [], ALMACENAJE: [] } as Record<TipoReferencia, Etapa[]>;
  for (const e of (data ?? []) as Etapa[]) r[e.tipo].push(e);
  return r;
}

// Personal interno activo, para asignar responsables y tareas.
export async function equipo() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("perfil")
    .select("id, nombre, email, rol")
    .eq("activo", true)
    .neq("rol", "cliente")
    .order("nombre");
  return (data ?? []).map((p) => ({ value: p.id as string, label: p.nombre as string, alias: (p.email as string).split("@")[0] }));
}

export type Avance = {
  id: number;
  expediente_id: number;
  tipo: TipoReferencia;
  codigo: string;
  estado: "activa" | "cerrada" | "anulada";
  responsable_id: string | null;
  visible_cliente: boolean;
  etapa_id: number | null;
  etapa: string | null;
  etapa_orden: number | null;
  total_etapas: number;
  horas_estandar: number | null;
  etapa_desde: string | null;
  horas_en_etapa: number | null;
};

export const demorada = (a: Pick<Avance, "estado" | "horas_estandar" | "horas_en_etapa">) =>
  a.estado === "activa" && a.horas_estandar !== null && (a.horas_en_etapa ?? 0) > a.horas_estandar;
