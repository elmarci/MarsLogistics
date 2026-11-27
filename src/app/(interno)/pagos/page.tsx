import Link from "next/link";
import { ListaPagos, type SolicitudPago } from "@/components/operacion/Pagos";
import { Encabezado, Kpi, dinero } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Pagos" };

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const perfil = await exigirInterno();
  const { estado = "solicitada" } = await searchParams;
  const supabase = await crearClienteServidor();
  let q = supabase
    .from("solicitud_pago")
    .select("id, concepto, monto, moneda, estado, fecha_limite, creado_en, observacion, proveedor:proveedor_id(nombre_corto, razon_social), solicitante:solicitado_por(nombre), referencia:referencia_id(id, codigo), expediente:expediente_id(id, codigo)")
    .order("fecha_limite", { nullsFirst: false })
    .limit(200);
  if (estado !== "todas") q = q.eq("estado", estado);
  const [{ data }, { data: abiertas }] = await Promise.all([
    q,
    supabase.from("solicitud_pago").select("monto, moneda, estado").in("estado", ["solicitada", "aprobada"]),
  ]);
  const suma = (e: string, m: string) => (abiertas ?? []).filter((x) => x.estado === e && x.moneda === m).reduce((s, x) => s + Number(x.monto), 0);
  const filtros = [
    ["solicitada", "Por aprobar"],
    ["aprobada", "Aprobadas por pagar"],
    ["pagada", "Pagadas"],
    ["rechazada", "Rechazadas"],
    ["todas", "Todas"],
  ];
  return (
    <>
      <Encabezado
        etiqueta="Finanzas"
        titulo="Solicitudes de pago"
        detalle={perfil.rol === "finanzas" ? "Apruebas, rechazas y marcas como pagadas." : "Las aprueba Finanzas. Aquí ves el estado de las tuyas y del equipo."}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Por aprobar USD" valor={dinero(suma("solicitada", "USD"))} tono="acento" />
        <Kpi titulo="Por aprobar PEN" valor={dinero(suma("solicitada", "PEN"), "PEN")} tono="acento" />
        <Kpi titulo="Por pagar USD" valor={dinero(suma("aprobada", "USD"))} />
        <Kpi titulo="Por pagar PEN" valor={dinero(suma("aprobada", "PEN"), "PEN")} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {filtros.map(([v, l]) => (
          <Link
            key={v}
            href={`/pagos?estado=${v}`}
            className={`rounded-md border px-3 py-1.5 text-xs ${estado === v ? "border-marca bg-marca-claro text-marca" : "border-borde text-tenue"}`}
          >
            {l}
          </Link>
        ))}
      </div>
      <ListaPagos pagos={(data ?? []) as unknown as SolicitudPago[]} aprueba={perfil.rol === "finanzas"} contexto />
    </>
  );
}
