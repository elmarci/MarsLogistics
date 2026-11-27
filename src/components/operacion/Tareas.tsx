import { Check, Clock } from "lucide-react";
import Link from "next/link";
import { BotonAccion, Formulario } from "@/components/Formulario";
import { Vacio, fechaHora } from "@/components/ui";
import { cambiarEstadoTarea, crearTarea } from "@/app/(interno)/colaboracion";

export type Tarea = {
  id: number;
  titulo: string;
  descripcion: string | null;
  vence_en: string | null;
  estado: "pendiente" | "en_proceso" | "hecha" | "cancelada";
  asignado: { nombre: string } | null;
  referencia?: { id: number; codigo: string } | null;
  expediente?: { id: number; codigo: string } | null;
};

export function ListaTareas({ tareas, puedeEscribir, contexto }: { tareas: Tarea[]; puedeEscribir: boolean; contexto?: boolean }) {
  if (tareas.length === 0) return <Vacio>Sin tareas.</Vacio>;
  const ahora = Date.now();
  return (
    <ul className="divide-y divide-borde rounded-lg border border-borde">
      {tareas.map((t) => {
        const abierta = t.estado === "pendiente" || t.estado === "en_proceso";
        const vencida = abierta && t.vence_en && new Date(t.vence_en).getTime() < ahora;
        return (
          <li key={t.id} className={`flex items-start gap-3 p-3 ${abierta ? "" : "opacity-50"}`}>
            {puedeEscribir && abierta ? (
              <BotonAccion accion={cambiarEstadoTarea.bind(null, t.id, "hecha")} titulo="Marcar como hecha" clase="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-borde-fuerte hover:border-marca hover:text-marca">
                <Check className="h-3 w-3 opacity-0 hover:opacity-100" />
              </BotonAccion>
            ) : (
              <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${abierta ? "border-borde-fuerte" : "border-marca bg-marca text-fondo"}`}>
                {!abierta && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${abierta ? "" : "line-through"}`}>{t.titulo}</p>
              {t.descripcion && <p className="text-xs text-tenue">{t.descripcion}</p>}
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-tenue">
                {contexto && t.referencia && (
                  <Link href={`/referencias/${t.referencia.id}`} className="codigo text-marca hover:underline">
                    {t.referencia.codigo}
                  </Link>
                )}
                {contexto && !t.referencia && t.expediente && (
                  <Link href={`/expedientes/${t.expediente.id}`} className="codigo text-marca hover:underline">
                    {t.expediente.codigo}
                  </Link>
                )}
                <span>{t.asignado?.nombre ?? "Sin asignar"}</span>
                {t.vence_en && (
                  <span className={`flex items-center gap-1 ${vencida ? "font-medium text-alerta" : ""}`}>
                    <Clock className="h-3 w-3" /> {fechaHora(t.vence_en)}
                  </span>
                )}
              </p>
            </div>
            {puedeEscribir && abierta && t.estado === "pendiente" && (
              <BotonAccion accion={cambiarEstadoTarea.bind(null, t.id, "en_proceso")}>En proceso</BotonAccion>
            )}
            {t.estado === "en_proceso" && <span className="text-[11px] text-marca">en proceso</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function NuevaTarea({
  expedienteId,
  referenciaId,
  equipo,
}: {
  expedienteId: number;
  referenciaId: number | null;
  equipo: { value: string; label: string }[];
}) {
  return (
    <details className="rounded-lg border border-borde p-3">
      <summary className="cursor-pointer text-sm font-medium text-marca">Asignar tarea</summary>
      <Formulario accion={crearTarea.bind(null, expedienteId, referenciaId)} textoBoton="Asignar" limpiar className="mt-3">
        <input name="titulo" required placeholder="Qué hay que hacer" className="campo" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="asignado_a" className="campo" defaultValue="">
            <option value="">Asignar a…</option>
            {equipo.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input type="datetime-local" name="vence_en" className="campo" title="Fecha límite" />
        </div>
        <textarea name="descripcion" rows={2} placeholder="Detalle (opcional)" className="campo" />
      </Formulario>
    </details>
  );
}
