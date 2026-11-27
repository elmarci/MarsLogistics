import { Download, Eye, EyeOff, FileText } from "lucide-react";
import { BotonAccion, Formulario } from "@/components/Formulario";
import { Insignia, Vacio, fecha, type Tono } from "@/components/ui";
import { alternarVisibleDocumento, revisarDocumento, subirDocumento } from "@/app/(interno)/colaboracion";
import { ETIQUETA_ESTADO_DOCUMENTO, type EstadoDocumento } from "@/lib/tipos";

export type Documento = {
  id: number;
  referencia_id: number | null;
  tipo_documento: string;
  nombre_archivo: string;
  estado: EstadoDocumento;
  observacion: string | null;
  visible_cliente: boolean;
  vencimiento: string | null;
  creado_en: string;
  subido: { nombre: string } | null;
};

export type Requerido = { tipo_documento: string; nombre: string; obligatorio: boolean; desde_orden: number | null };

export const TONO_DOCUMENTO: Record<EstadoDocumento, Tono> = {
  pendiente: "neutro",
  validado: "acento",
  observado: "aviso",
  rechazado: "alerta",
};

export function PanelDocumentos({
  expedienteId,
  referenciaId,
  documentos,
  requeridos = [],
  tipos,
  puedeEscribir,
  codigos,
}: {
  expedienteId: number;
  referenciaId: number | null;
  documentos: Documento[];
  requeridos?: Requerido[];
  tipos: { codigo: string; nombre: string }[];
  puedeEscribir: boolean;
  codigos?: Map<number, string>; // código de referencia, cuando se listan los de todo el expediente
}) {
  const nombreTipo = new Map(tipos.map((t) => [t.codigo, t.nombre]));
  const porTipo = new Map<string, Documento>();
  for (const d of documentos) if (!porTipo.has(d.tipo_documento) || d.estado === "validado") porTipo.set(d.tipo_documento, d);

  return (
    <div className="space-y-4">
      {requeridos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {requeridos.map((r) => {
            const d = porTipo.get(r.tipo_documento);
            return (
              <Insignia key={r.tipo_documento} tono={d ? TONO_DOCUMENTO[d.estado] : r.obligatorio ? "neutro" : "apagado"}>
                {d?.estado === "validado" ? "✓" : d ? "•" : "○"} {r.nombre}
              </Insignia>
            );
          })}
        </div>
      )}

      {documentos.length === 0 ? (
        <Vacio>Aún no hay documentos.</Vacio>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {documentos.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
              <FileText className="h-4 w-4 shrink-0 text-tenue" strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                <a href={`/documentos/${d.id}`} className="flex items-center gap-1.5 truncate text-sm font-medium hover:text-marca">
                  {nombreTipo.get(d.tipo_documento) ?? d.tipo_documento}
                  <Download className="h-3 w-3" />
                </a>
                <p className="truncate text-xs text-tenue">
                  {codigos && d.referencia_id && <span className="codigo mr-1 text-slate-600">{codigos.get(d.referencia_id)}</span>}
                  {d.nombre_archivo} · {d.subido?.nombre ?? "—"} · {fecha(d.creado_en)}
                  {d.vencimiento && <> · vence {fecha(d.vencimiento)}</>}
                </p>
                {d.observacion && d.estado !== "validado" && <p className="mt-1 text-xs text-aviso">{d.observacion}</p>}
              </div>
              <Insignia tono={TONO_DOCUMENTO[d.estado]}>{ETIQUETA_ESTADO_DOCUMENTO[d.estado]}</Insignia>
              {puedeEscribir && (
                <div className="flex items-center gap-1">
                  <BotonAccion
                    accion={alternarVisibleDocumento.bind(null, d.id, !d.visible_cliente)}
                    titulo={d.visible_cliente ? "Visible para el cliente (si está validado)" : "Oculto al cliente"}
                  >
                    {d.visible_cliente ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </BotonAccion>
                  <details className="relative">
                    <summary className="boton-mini cursor-pointer list-none">Revisar</summary>
                    <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-borde-fuerte bg-white p-3 shadow-xl">
                      <Formulario accion={revisarDocumento.bind(null, d.id)} textoBoton="Guardar revisión" boton="boton-mini">
                        <select name="estado" defaultValue="validado" className="campo">
                          <option value="validado">Validar</option>
                          <option value="observado">Observar</option>
                          <option value="rechazado">Rechazar</option>
                          <option value="pendiente">Volver a pendiente</option>
                        </select>
                        <textarea name="observacion" rows={2} placeholder="Qué falta o qué corregir" className="campo" />
                      </Formulario>
                    </div>
                  </details>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeEscribir && (
        <details className="rounded-lg border border-borde p-3">
          <summary className="cursor-pointer text-sm font-medium text-marca">Subir documento</summary>
          <Formulario accion={subirDocumento.bind(null, expedienteId, referenciaId)} textoBoton="Subir" limpiar className="mt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <select name="tipo_documento" required className="campo" defaultValue="">
                <option value="" disabled>
                  Tipo de documento
                </option>
                {tipos.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              <input type="file" name="archivo" required className="campo file:mr-3 file:rounded file:border-0 file:bg-marca-claro file:px-2 file:py-1 file:text-marca" />
              <input type="date" name="vencimiento" className="campo" title="Vencimiento (opcional)" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="visible_cliente" className="h-4 w-4 accent-marca" /> Mostrar al cliente cuando esté validado
            </label>
          </Formulario>
        </details>
      )}
    </div>
  );
}
