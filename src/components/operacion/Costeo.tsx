import { BotonAccion, Formulario } from "@/components/Formulario";
import { Vacio, dinero } from "@/components/ui";
import { anularCosteo, registrarCosteo } from "@/app/(interno)/colaboracion";

export type LineaCosteo = {
  id: number;
  tipo: "COSTO" | "VENTA" | "VENTA_EXTRA" | "SOBRECOSTO" | "REEMBOLSO";
  cantidad: number;
  valor_unitario: number;
  moneda: "USD" | "PEN";
  tipo_cambio: number;
  sobrecosto_asume: string | null;
  estado: string;
  concepto: { nombre: string } | null;
  proveedor: { nombre_corto: string | null; razon_social: string } | null;
  referencia?: { codigo: string } | null;
};

export type Resumen = {
  costo_proyectado_usd: number;
  venta_proyectada_usd: number;
  costo_real_usd: number;
  venta_real_usd: number;
  margen_proyectado_usd: number;
  margen_real_usd: number;
};

const ETIQUETA = { COSTO: "Costo", VENTA: "Venta", VENTA_EXTRA: "Venta extra", SOBRECOSTO: "Sobrecosto", REEMBOLSO: "Reembolso" };

// Proyectado (cotizado) contra real (comprobantes), en USD sin IGV.
export function ResumenCosteo({ r }: { r: Resumen | null }) {
  const v = r ?? { costo_proyectado_usd: 0, venta_proyectada_usd: 0, costo_real_usd: 0, venta_real_usd: 0, margen_proyectado_usd: 0, margen_real_usd: 0 };
  const pct = (m: number, venta: number) => (venta ? `${((m / venta) * 100).toFixed(1)}%` : "—");
  const fila = (t: string, p: number, real: number, fuerte = false) => {
    const desvio = real - p;
    return (
      <tr className={`border-t border-borde ${fuerte ? "font-semibold" : ""}`}>
        <td className="py-2 pr-3 text-tenue">{t}</td>
        <td className="codigo py-2 pr-3 text-right">{dinero(p)}</td>
        <td className="codigo py-2 pr-3 text-right">{dinero(real)}</td>
        <td className={`codigo py-2 text-right text-xs ${real && p && Math.abs(desvio) > 0.005 ? "text-slate-600" : "text-slate-400"}`}>
          {real && p ? `${desvio > 0 ? "+" : ""}${dinero(desvio)}` : "—"}
        </td>
      </tr>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-96 text-sm">
        <thead className="text-[11px] tracking-wider text-tenue uppercase">
          <tr>
            <th className="pb-2 text-left font-medium">USD sin IGV</th>
            <th className="pb-2 text-right font-medium">Proyectado</th>
            <th className="pb-2 text-right font-medium">Real</th>
            <th className="pb-2 text-right font-medium">Desvío</th>
          </tr>
        </thead>
        <tbody>
          {fila("Venta", v.venta_proyectada_usd, v.venta_real_usd)}
          {fila("Costo", v.costo_proyectado_usd, v.costo_real_usd)}
          {fila("Margen", v.margen_proyectado_usd, v.margen_real_usd, true)}
          <tr className="text-xs text-tenue">
            <td className="pt-1">Margen %</td>
            <td className="codigo pt-1 text-right">{pct(v.margen_proyectado_usd, v.venta_proyectada_usd)}</td>
            <td className="codigo pt-1 text-right">{pct(v.margen_real_usd, v.venta_real_usd)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function TablaCosteo({ lineas, puedeEscribir }: { lineas: LineaCosteo[]; puedeEscribir: boolean }) {
  const vivas = lineas.filter((l) => l.estado !== "anulado");
  if (vivas.length === 0) return <Vacio>Sin costeo proyectado. Agrega lo cotizado por concepto.</Vacio>;
  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full min-w-[36rem] text-sm">
        <tbody>
          {vivas.map((l) => {
            const total = l.cantidad * l.valor_unitario;
            const usd = l.moneda === "PEN" ? total / l.tipo_cambio : total;
            const salida = l.tipo === "COSTO" || l.tipo === "SOBRECOSTO";
            return (
              <tr key={l.id} className="border-t border-borde first:border-0">
                <td className="px-3 py-2">
                  <p>{l.concepto?.nombre}</p>
                  <p className="text-xs text-tenue">
                    {ETIQUETA[l.tipo]}
                    {l.sobrecosto_asume && ` · asume ${l.sobrecosto_asume}`}
                    {l.proveedor && ` · ${l.proveedor.nombre_corto ?? l.proveedor.razon_social}`}
                    {l.referencia && <span className="codigo ml-1">{l.referencia.codigo}</span>}
                  </p>
                </td>
                <td className="codigo px-3 py-2 text-right text-xs text-tenue">
                  {l.cantidad} × {dinero(l.valor_unitario, l.moneda)}
                </td>
                <td className={`codigo px-3 py-2 text-right ${salida ? "text-slate-600" : "text-marca"}`}>
                  {salida ? "−" : "+"}
                  {dinero(usd)}
                </td>
                <td className="w-8 px-2">
                  {puedeEscribir && (
                    <BotonAccion accion={anularCosteo.bind(null, l.id)} confirmar="¿Anular esta línea?" titulo="Anular">
                      ×
                    </BotonAccion>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NuevoCosteo({
  expedienteId,
  referenciaId,
  conceptos,
  proveedores,
}: {
  expedienteId: number;
  referenciaId: number | null;
  conceptos: { value: number; label: string; tipo: string }[];
  proveedores: { value: number; label: string }[];
}) {
  return (
    <details className="rounded-lg border border-borde p-3">
      <summary className="cursor-pointer text-sm font-medium text-marca">Agregar línea de costeo</summary>
      <Formulario accion={registrarCosteo.bind(null, expedienteId, referenciaId)} textoBoton="Agregar" limpiar className="mt-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <select name="concepto_id" required className="campo" defaultValue="">
            <option value="" disabled>
              Concepto
            </option>
            {conceptos.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select name="tipo" className="campo" defaultValue="COSTO">
            {Object.entries(ETIQUETA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="proveedor_id" className="campo" defaultValue="">
            <option value="">Proveedor…</option>
            {proveedores.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <input name="cantidad" type="number" step="0.001" defaultValue={1} className="campo" title="Cantidad" />
          <input name="valor_unitario" type="number" step="0.0001" required placeholder="Valor unit. sin IGV" className="campo" />
          <select name="moneda" className="campo" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="PEN">PEN</option>
          </select>
          <input name="tipo_cambio" type="number" step="0.0001" defaultValue={1} className="campo" title="Tipo de cambio (soles por dólar)" />
          <select name="sobrecosto_asume" className="campo" defaultValue="">
            <option value="">Sobrecosto lo asume…</option>
            <option value="CLIENTE">Cliente</option>
            <option value="MAC">MAC</option>
          </select>
        </div>
      </Formulario>
    </details>
  );
}
