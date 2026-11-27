import { Check } from "lucide-react";
import { Formulario } from "@/components/Formulario";
import { duracion } from "@/components/ui";
import type { ResultadoAccion } from "@/lib/acciones";
import type { Etapa } from "@/lib/tipos";

export type Paso = { etapa_id: number; inicio: string; fin: string | null };

// Línea de etapas con fecha de inicio y duración real de cada una.
export function LineaEtapas({
  etapas,
  actualId,
  historial,
  estado,
}: {
  etapas: Etapa[];
  actualId: number | null;
  historial: Paso[];
  estado: string;
}) {
  const actual = etapas.find((e) => e.id === actualId)?.orden ?? 0;
  const ultimo = new Map<number, Paso>();
  for (const h of historial) ultimo.set(h.etapa_id, h);
  return (
    <ol className="grid gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
      {etapas.map((e) => {
        const h = ultimo.get(e.id);
        const hecho = estado === "cerrada" || e.orden < actual;
        const enCurso = e.orden === actual && estado !== "cerrada";
        const horas = h ? (new Date(h.fin ?? Date.now()).getTime() - new Date(h.inicio).getTime()) / 3.6e6 : null;
        const demora = enCurso && e.horas_estandar !== null && horas !== null && horas > e.horas_estandar;
        return (
          <li
            key={e.id}
            className={`relative flex gap-3 rounded-md border p-2.5 sm:flex-col sm:gap-1.5 ${
              enCurso
                ? demora
                  ? "border-aviso/60 bg-aviso/5"
                  : "border-marca/60 bg-marca-claro"
                : hecho
                  ? "border-borde bg-panel"
                  : "border-dashed border-borde bg-transparent"
            }`}
          >
            <span
              className={`codigo flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                hecho ? "border-marca bg-marca text-white" : enCurso ? "border-marca text-marca" : "border-borde-fuerte text-slate-400"
              }`}
            >
              {hecho ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : e.orden}
            </span>
            <div className="min-w-0">
              <p className={`text-xs leading-tight font-medium ${hecho || enCurso ? "text-texto" : "text-slate-400"}`}>{e.nombre}</p>
              {h && (
                <p className="codigo mt-0.5 text-[10px] text-tenue">
                  {marca(h.inicio)}
                  {(hecho || enCurso) && !e.es_final && <> · {duracion(horas)}</>}
                </p>
              )}
              {enCurso && e.horas_estandar !== null && (
                <p className={`codigo text-[10px] ${demora ? "text-aviso" : "text-tenue"}`}>estándar {duracion(e.horas_estandar)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CambiarEtapa({
  etapas,
  actualId,
  accion,
  faltantes,
}: {
  etapas: Etapa[];
  actualId: number | null;
  accion: (estado: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>;
  faltantes: string[];
}) {
  const actual = etapas.find((e) => e.id === actualId);
  const siguiente = etapas.find((e) => e.orden === (actual?.orden ?? 0) + 1);
  return (
    <Formulario accion={accion} textoBoton={siguiente ? `Avanzar` : "Cambiar etapa"} className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        <select name="etapa_id" defaultValue={siguiente?.id ?? actual?.id} className="campo" aria-label="Etapa">
          {etapas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.orden}. {e.nombre}
              {e.id === actualId ? " (actual)" : ""}
            </option>
          ))}
        </select>
        <input name="nota" placeholder="Nota para la bitácora (opcional)" className="campo" />
      </div>
      {faltantes.length > 0 && (
        <p className="text-xs text-aviso">Documentos pendientes hasta esta etapa: {faltantes.join(", ")}.</p>
      )}
    </Formulario>
  );
}

// 20/11 18:14 en hora de Lima: corto para que entre en la tarjeta de etapa.
function marca(v: string) {
  return new Date(v).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(",", "");
}
