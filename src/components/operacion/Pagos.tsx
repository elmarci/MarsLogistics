import { BotonAccion, Formulario } from "@/components/Formulario";
import { Insignia, Vacio, dinero, fecha, type Tono } from "@/components/ui";
import { cambiarEstadoPago, solicitarPago } from "@/app/(interno)/colaboracion";
import { ETIQUETA_ESTADO_PAGO, type EstadoPago } from "@/lib/tipos";

export type SolicitudPago = {
  id: number;
  concepto: string;
  monto: number;
  moneda: "USD" | "PEN";
  estado: EstadoPago;
  fecha_limite: string | null;
  creado_en: string;
  observacion: string | null;
  proveedor: { nombre_corto: string | null; razon_social: string } | null;
  solicitante: { nombre: string } | null;
  referencia?: { id: number; codigo: string } | null;
  expediente?: { id: number; codigo: string } | null;
};

export const TONO_PAGO: Record<EstadoPago, Tono> = { solicitada: "aviso", aprobada: "acento", rechazada: "alerta", pagada: "apagado" };

export function ListaPagos({ pagos, aprueba, contexto }: { pagos: SolicitudPago[]; aprueba: boolean; contexto?: boolean }) {
  if (pagos.length === 0) return <Vacio>Sin solicitudes de pago.</Vacio>;
  return (
    <ul className="divide-y divide-borde rounded-lg border border-borde">
      {pagos.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {p.concepto}
              {contexto && (p.referencia ?? p.expediente) && (
                <a
                  href={p.referencia ? `/referencias/${p.referencia.id}` : `/expedientes/${p.expediente!.id}`}
                  className="codigo ml-2 text-xs text-marca hover:underline"
                >
                  {p.referencia?.codigo ?? p.expediente?.codigo}
                </a>
              )}
            </p>
            <p className="text-xs text-tenue">
              {p.proveedor ? (p.proveedor.nombre_corto ?? p.proveedor.razon_social) : "Sin proveedor"} · pidió {p.solicitante?.nombre ?? "—"} ·{" "}
              {fecha(p.creado_en)}
              {p.fecha_limite && <> · pagar antes del {fecha(p.fecha_limite)}</>}
            </p>
            {p.observacion && <p className="text-xs text-slate-600">{p.observacion}</p>}
          </div>
          <span className="codigo text-sm font-semibold">{dinero(p.monto, p.moneda)}</span>
          <Insignia tono={TONO_PAGO[p.estado]}>{ETIQUETA_ESTADO_PAGO[p.estado]}</Insignia>
          {aprueba && p.estado === "solicitada" && (
            <span className="flex gap-1">
              <BotonAccion accion={cambiarEstadoPago.bind(null, p.id, "aprobada")} clase="boton-mini border-marca/60 text-marca">
                Aprobar
              </BotonAccion>
              <BotonAccion accion={cambiarEstadoPago.bind(null, p.id, "rechazada")} confirmar="¿Rechazar esta solicitud?">
                Rechazar
              </BotonAccion>
            </span>
          )}
          {aprueba && p.estado === "aprobada" && (
            <BotonAccion accion={cambiarEstadoPago.bind(null, p.id, "pagada")} confirmar="¿Confirmas que ya se pagó?">
              Marcar pagada
            </BotonAccion>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NuevaSolicitud({
  expedienteId,
  referenciaId,
  proveedores,
  documentos,
}: {
  expedienteId: number;
  referenciaId: number | null;
  proveedores: { value: number; label: string }[];
  documentos: { value: number; label: string }[];
}) {
  return (
    <details className="rounded-lg border border-borde p-3">
      <summary className="cursor-pointer text-sm font-medium text-marca">Solicitar pago</summary>
      <Formulario accion={solicitarPago.bind(null, expedienteId, referenciaId)} textoBoton="Enviar a Finanzas" limpiar className="mt-3">
        <input name="concepto" required placeholder="Concepto (p. ej. derechos de aduana, THC)" className="campo" />
        <div className="grid gap-3 sm:grid-cols-4">
          <select name="proveedor_id" className="campo" defaultValue="">
            <option value="">Proveedor…</option>
            {proveedores.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input name="monto" type="number" step="0.01" min="0.01" required placeholder="Monto" className="campo" />
          <select name="moneda" className="campo" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="PEN">PEN</option>
          </select>
          <input name="fecha_limite" type="date" className="campo" title="Pagar antes de" />
        </div>
        <select name="documento_id" className="campo" defaultValue="">
          <option value="">Sustento (documento ya subido)…</option>
          {documentos.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <textarea name="observacion" rows={2} placeholder="Comentario para Finanzas" className="campo" />
      </Formulario>
    </details>
  );
}
