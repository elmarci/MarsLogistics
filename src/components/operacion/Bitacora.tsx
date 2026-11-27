import { Formulario } from "@/components/Formulario";
import { fechaHora } from "@/components/ui";
import { comentar } from "@/app/(interno)/colaboracion";

export type Comentario = {
  id: number;
  texto: string;
  creado_en: string;
  autor: { nombre: string } | null;
  referencia?: { codigo: string } | null;
};

// Resalta las @menciones.
function conMenciones(texto: string) {
  return texto.split(/(@[\w.\-+]+)/g).map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="text-marca">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export function Bitacora({
  expedienteId,
  referenciaId,
  comentarios,
  puedeEscribir,
  alias,
}: {
  expedienteId: number;
  referenciaId: number | null;
  comentarios: Comentario[];
  puedeEscribir: boolean;
  alias: string[];
}) {
  return (
    <div className="space-y-3">
      {puedeEscribir && (
        <Formulario accion={comentar.bind(null, expedienteId, referenciaId)} textoBoton="Publicar" limpiar boton="boton-secundario">
          <textarea
            name="texto"
            rows={2}
            required
            placeholder={`Escribe para las demás áreas. Menciona con @: ${alias.slice(0, 3).map((a) => "@" + a).join(", ")}`}
            className="campo"
          />
        </Formulario>
      )}
      <ol className="relative space-y-3 border-l border-borde pl-4">
        {comentarios.map((c) => {
          const sistema = c.texto.startsWith("▸");
          return (
            <li key={c.id} className="relative">
              <span className={`absolute top-1.5 -left-[21px] h-2 w-2 rounded-full ${sistema ? "bg-marca" : "bg-slate-400"}`} />
              <p className="text-xs text-tenue">
                <span className="font-medium text-slate-700">{c.autor?.nombre ?? "—"}</span> · {fechaHora(c.creado_en)}
                {c.referencia && <span className="codigo ml-1 text-slate-600">{c.referencia.codigo}</span>}
              </p>
              <p className={`text-sm whitespace-pre-wrap ${sistema ? "text-marca" : ""}`}>{conMenciones(c.texto)}</p>
            </li>
          );
        })}
        {comentarios.length === 0 && <li className="text-sm text-tenue">Sin comentarios todavía.</li>}
      </ol>
    </div>
  );
}
