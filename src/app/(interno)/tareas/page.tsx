import Link from "next/link";
import { ListaTareas, type Tarea } from "@/components/operacion/Tareas";
import { Encabezado } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Mis tareas" };

export default async function TareasPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const perfil = await exigirInterno();
  const { ver = "mias" } = await searchParams;
  const supabase = await crearClienteServidor();
  let q = supabase
    .from("tarea")
    .select("id, titulo, descripcion, vence_en, estado, asignado:asignado_a(nombre), referencia:referencia_id(id, codigo), expediente:expediente_id(id, codigo)")
    .order("vence_en", { nullsFirst: false })
    .limit(200);
  if (ver === "mias") q = q.eq("asignado_a", perfil.id).in("estado", ["pendiente", "en_proceso"]);
  else if (ver === "delegadas") q = q.eq("creado_por", perfil.id).in("estado", ["pendiente", "en_proceso"]);
  else if (ver === "equipo") q = q.in("estado", ["pendiente", "en_proceso"]);
  else q = q.eq("asignado_a", perfil.id).eq("estado", "hecha");
  const { data } = await q;
  const filtros = [
    ["mias", "Asignadas a mí"],
    ["delegadas", "Que delegué"],
    ["equipo", "Todo el equipo"],
    ["hechas", "Hechas"],
  ];
  return (
    <>
      <Encabezado etiqueta="Operación" titulo="Tareas" detalle="Las tareas se crean desde cada expediente o referencia y avisan a quien se asignan." />
      <div className="mb-4 flex flex-wrap gap-1">
        {filtros.map(([v, l]) => (
          <Link
            key={v}
            href={`/tareas?ver=${v}`}
            className={`rounded-md border px-3 py-1.5 text-xs ${ver === v ? "border-marca bg-marca-claro text-marca" : "border-borde text-tenue"}`}
          >
            {l}
          </Link>
        ))}
      </div>
      <ListaTareas tareas={(data ?? []) as unknown as Tarea[]} puedeEscribir={puedeEscribir(perfil)} contexto />
    </>
  );
}
