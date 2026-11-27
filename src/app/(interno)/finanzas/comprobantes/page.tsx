import Link from "next/link";
import { Encabezado, Insignia, Tabla, dinero, fecha } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ESTADOS_COMPROBANTE, TIPOS_COMPROBANTE, type EstadoComprobante, type TipoComprobante } from "@/lib/tipos";

export const metadata = { title: "Comprobantes" };

type Fila = {
  id: number;
  sentido: string;
  tipo: TipoComprobante;
  serie: string | null;
  numero: string | null;
  fecha_emision: string;
  razon_social_contraparte: string | null;
  moneda: "USD" | "PEN";
  total: number;
  estado: EstadoComprobante;
  expediente: { codigo: string } | null;
};

export default async function ComprobantesPage({ searchParams }: { searchParams: Promise<{ sentido?: string; periodo?: string }> }) {
  await exigirInterno(["admin", "finanzas", "operaciones", "aduanas"]);
  const { sentido = "EMITIDO", periodo } = await searchParams;
  const supabase = await crearClienteServidor();
  let q = supabase
    .from("comprobante")
    .select("id, sentido, tipo, serie, numero, fecha_emision, razon_social_contraparte, moneda, total, estado, expediente:expediente_id(codigo)")
    .eq("sentido", sentido)
    .order("fecha_emision", { ascending: false })
    .order("id", { ascending: false })
    .limit(300);
  if (periodo) q = q.eq("periodo", periodo);
  const { data } = await q;
  return (
    <>
      <Encabezado
        etiqueta="Finanzas"
        titulo="Comprobantes"
        detalle="Emitidos a clientes y recibidos de proveedores, con sus impuestos e imputación por expediente."
        accion={{ href: `/finanzas/comprobantes/nuevo?sentido=${sentido}`, label: "+ Comprobante" }}
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        {[
          ["EMITIDO", "Ventas (emitidos)"],
          ["RECIBIDO", "Compras (recibidos)"],
        ].map(([v, l]) => (
          <Link
            key={v}
            href={`/finanzas/comprobantes?sentido=${v}${periodo ? `&periodo=${periodo}` : ""}`}
            className={`rounded-md border px-3 py-1.5 text-xs ${sentido === v ? "border-marca bg-marca-claro text-marca" : "border-borde text-tenue"}`}
          >
            {l}
          </Link>
        ))}
        <input type="hidden" name="sentido" value={sentido} />
        <input type="month" name="periodo" defaultValue={periodo} className="campo w-auto py-1 text-xs" />
        <button className="boton-mini">Filtrar</button>
      </form>
      <Tabla
        filas={(data ?? []) as unknown as Fila[]}
        claveFila={(f) => f.id}
        enlace={(f) => `/finanzas/comprobantes/${f.id}`}
        vacio="Sin comprobantes."
        columnas={[
          { titulo: "Número", valor: (f) => <span className="codigo">{f.serie ?? "—"}-{f.numero ?? "borrador"}</span> },
          { titulo: "Tipo", valor: (f) => TIPOS_COMPROBANTE[f.tipo] },
          { titulo: "Fecha", valor: (f) => fecha(f.fecha_emision) },
          { titulo: sentido === "EMITIDO" ? "Cliente" : "Proveedor", valor: (f) => f.razon_social_contraparte ?? "—" },
          { titulo: "Expediente", valor: (f) => <span className="codigo">{f.expediente?.codigo ?? "—"}</span> },
          { titulo: "Total", valor: (f) => <span className="codigo">{dinero(f.tipo === "NOTA_CREDITO" ? -f.total : f.total, f.moneda)}</span> },
          {
            titulo: "Estado",
            valor: (f) => (
              <Insignia tono={f.estado === "borrador" ? "aviso" : f.estado === "anulado" || f.estado === "rechazado_sunat" ? "alerta" : "acento"}>
                {ESTADOS_COMPROBANTE[f.estado]}
              </Insignia>
            ),
          },
        ]}
      />
    </>
  );
}
