import { Download } from "lucide-react";
import { Encabezado, Vacio, dinero, fecha } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Registro de compras y ventas" };

type Fila = {
  id: number;
  sentido: string;
  fecha_emision: string;
  tipo_sunat: string;
  serie: string | null;
  numero: string | null;
  ruc_contraparte: string | null;
  razon_social_contraparte: string | null;
  moneda: "USD" | "PEN";
  tipo_cambio: number;
  base_gravada: number;
  no_gravado: number;
  isc: number;
  igv: number;
  total: number;
  detraccion_monto_pen: number;
  detraccion_constancia: string | null;
  expediente: string | null;
  estado: string;
};

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ periodo?: string; sentido?: string }> }) {
  await exigirInterno(["admin", "finanzas", "operaciones", "aduanas"]);
  const sp = await searchParams;
  const periodo = sp.periodo ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }).slice(0, 7);
  const sentido = sp.sentido === "RECIBIDO" ? "RECIBIDO" : "EMITIDO";
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("v_registro_contable")
    .select("*")
    .eq("periodo", periodo)
    .eq("sentido", sentido)
    .order("fecha_emision")
    .order("serie")
    .order("numero");
  const filas = (data ?? []) as Fila[];
  const pen = (f: Fila, v: number) => Number(v) * (f.moneda === "USD" ? Number(f.tipo_cambio) : 1);
  const tot = (k: keyof Fila) => filas.filter((f) => f.estado !== "anulado").reduce((a, f) => a + pen(f, f[k] as number), 0);

  return (
    <>
      <Encabezado etiqueta="Finanzas" titulo={sentido === "EMITIDO" ? "Registro de ventas" : "Registro de compras"} detalle="Montos convertidos a soles con el tipo de cambio de cada comprobante. Los anulados figuran en cero.">
        <a href={`/finanzas/registro/csv?periodo=${periodo}&sentido=${sentido}`} className="boton-secundario">
          <Download className="h-4 w-4" /> Exportar CSV
        </a>
      </Encabezado>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <select name="sentido" defaultValue={sentido} className="campo w-auto py-1 text-xs">
          <option value="EMITIDO">Ventas</option>
          <option value="RECIBIDO">Compras</option>
        </select>
        <input type="month" name="periodo" defaultValue={periodo} className="campo w-auto py-1 text-xs" />
        <button className="boton-mini">Ver</button>
      </form>
      {filas.length === 0 ? (
        <Vacio>Sin comprobantes en {periodo}.</Vacio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde bg-panel">
          <table className="w-full min-w-[60rem] text-xs">
            <thead className="text-[10px] tracking-wider text-tenue uppercase">
              <tr className="border-b border-borde">
                {["Fecha", "Tipo", "Serie-número", "RUC", "Razón social", "Base S/", "No grav. S/", "ISC S/", "IGV S/", "Total S/", "Detracción", "Exp."].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="codigo">
              {filas.map((f) => {
                const anul = f.estado === "anulado";
                const v = (x: number) => (anul ? "0.00" : pen(f, x).toFixed(2));
                return (
                  <tr key={f.id} className={`border-t border-borde/60 ${anul ? "text-slate-400 line-through" : ""}`}>
                    <td className="px-2 py-1.5">{fecha(f.fecha_emision)}</td>
                    <td className="px-2 py-1.5">{f.tipo_sunat}</td>
                    <td className="px-2 py-1.5">
                      <a href={`/finanzas/comprobantes/${f.id}`} className="text-marca">
                        {f.serie}-{f.numero}
                      </a>
                    </td>
                    <td className="px-2 py-1.5">{f.ruc_contraparte}</td>
                    <td className="max-w-48 truncate px-2 py-1.5 font-sans">{f.razon_social_contraparte}</td>
                    <td className="px-2 py-1.5 text-right">{v(f.base_gravada)}</td>
                    <td className="px-2 py-1.5 text-right">{v(f.no_gravado)}</td>
                    <td className="px-2 py-1.5 text-right">{v(f.isc)}</td>
                    <td className="px-2 py-1.5 text-right">{v(f.igv)}</td>
                    <td className="px-2 py-1.5 text-right">{v(f.total)}</td>
                    <td className="px-2 py-1.5">{Number(f.detraccion_monto_pen) ? `${f.detraccion_monto_pen} ${f.detraccion_constancia ?? "pend."}` : ""}</td>
                    <td className="px-2 py-1.5">{f.expediente}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="codigo font-semibold">
              <tr className="border-t border-borde-fuerte">
                <td colSpan={5} className="px-2 py-2 text-right font-sans text-tenue">
                  Totales
                </td>
                {(["base_gravada", "no_gravado", "isc", "igv", "total"] as const).map((k) => (
                  <td key={k} className="px-2 py-2 text-right">
                    {dinero(tot(k), "PEN")}
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
