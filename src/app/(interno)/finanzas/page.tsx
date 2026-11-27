import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet, Landmark, Receipt } from "lucide-react";
import { Seccion } from "@/components/Seccion";
import { Encabezado, Insignia, Kpi, Vacio, dinero, fecha } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TIPOS_COMPROBANTE, type TipoComprobante } from "@/lib/tipos";

export const metadata = { title: "Finanzas" };

type Saldo = {
  id: number;
  sentido: "EMITIDO" | "RECIBIDO";
  tipo: TipoComprobante;
  serie: string | null;
  numero: string | null;
  fecha_vencimiento: string | null;
  razon_social_contraparte: string | null;
  moneda: "USD" | "PEN";
  saldo: number;
  detraccion_monto_pen: number;
  detraccion_al_dia: boolean;
};

export default async function FinanzasPage() {
  await exigirInterno(["admin", "finanzas", "operaciones", "aduanas"]);
  const supabase = await crearClienteServidor();
  const periodo = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }).slice(0, 7);
  const [{ data: saldos }, { data: registro }] = await Promise.all([
    supabase.from("v_saldo_comprobante").select("*").order("fecha_vencimiento", { nullsFirst: false }).limit(500),
    supabase.from("v_registro_contable").select("sentido, igv, moneda, tipo_cambio, base_gravada").eq("periodo", periodo),
  ]);
  const s = (saldos ?? []) as Saldo[];
  const hoy = new Date().toISOString().slice(0, 10);
  const total = (sentido: string, moneda: string) =>
    s.filter((x) => x.sentido === sentido && x.moneda === moneda && x.saldo > 0.005).reduce((a, x) => a + Number(x.saldo), 0);
  const igvPen = (sentido: string) =>
    (registro ?? []).filter((r) => r.sentido === sentido).reduce((a, r) => a + Number(r.igv) * (r.moneda === "USD" ? Number(r.tipo_cambio) : 1), 0);
  const detPend = s.filter((x) => x.sentido === "RECIBIDO" && !x.detraccion_al_dia);
  const vencidos = s.filter((x) => x.saldo > 0.005 && x.fecha_vencimiento && x.fecha_vencimiento < hoy);

  const lista = (filas: Saldo[]) =>
    filas.length === 0 ? (
      <Vacio>Nada pendiente.</Vacio>
    ) : (
      <ul className="divide-y divide-borde text-sm">
        {filas.slice(0, 12).map((x) => (
          <li key={x.id}>
            <Link href={`/finanzas/comprobantes/${x.id}`} className="flex items-center gap-3 py-2 hover:text-marca">
              <span className="codigo w-32 shrink-0 text-xs">
                {x.serie}-{x.numero}
              </span>
              <span className="min-w-0 flex-1 truncate text-tenue">{x.razon_social_contraparte}</span>
              {x.fecha_vencimiento && (
                <span className={`codigo text-[11px] ${x.fecha_vencimiento < hoy ? "text-alerta" : "text-tenue"}`}>{fecha(x.fecha_vencimiento)}</span>
              )}
              <span className="codigo w-28 text-right">{dinero(x.saldo, x.moneda)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <Encabezado etiqueta="Finanzas" titulo="Contabilidad y administración" detalle={`Periodo ${periodo}`}>
        <Link href="/finanzas/registro" className="boton-secundario">
          <FileSpreadsheet className="h-4 w-4" /> Registro de compras y ventas
        </Link>
        <Link href="/finanzas/comprobantes" className="boton-secundario">
          <Receipt className="h-4 w-4" /> Comprobantes
        </Link>
        <Link href="/finanzas/comprobantes/nuevo" className="boton">
          + Comprobante
        </Link>
      </Encabezado>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Por cobrar USD" valor={dinero(total("EMITIDO", "USD"))} icono={ArrowDownLeft} tono="acento" detalle={`PEN ${dinero(total("EMITIDO", "PEN"), "PEN")}`} />
        <Kpi titulo="Por pagar USD" valor={dinero(total("RECIBIDO", "USD"))} icono={ArrowUpRight} detalle={`PEN ${dinero(total("RECIBIDO", "PEN"), "PEN")}`} />
        <Kpi titulo="IGV del periodo" valor={dinero(igvPen("EMITIDO") - igvPen("RECIBIDO"), "PEN")} icono={Landmark} detalle={`débito ${dinero(igvPen("EMITIDO"), "PEN")} − crédito ${dinero(igvPen("RECIBIDO"), "PEN")}`} />
        <Kpi titulo="Detracciones por depositar" valor={detPend.length} tono={detPend.length ? "alerta" : "neutro"} detalle={dinero(detPend.reduce((a, x) => a + Number(x.detraccion_monto_pen), 0), "PEN")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Cuentas por cobrar" icono={ArrowDownLeft}>
          {lista(s.filter((x) => x.sentido === "EMITIDO" && x.saldo > 0.005))}
        </Seccion>
        <Seccion titulo="Cuentas por pagar" icono={ArrowUpRight}>
          {lista(s.filter((x) => x.sentido === "RECIBIDO" && x.saldo > 0.005))}
        </Seccion>
        {vencidos.length > 0 && (
          <Seccion titulo={`Vencidos (${vencidos.length})`}>
            {lista(vencidos)}
          </Seccion>
        )}
        {detPend.length > 0 && (
          <Seccion titulo="Detracciones pendientes de depósito">
            <ul className="divide-y divide-borde text-sm">
              {detPend.map((x) => (
                <li key={x.id}>
                  <Link href={`/finanzas/comprobantes/${x.id}`} className="flex items-center gap-3 py-2 hover:text-marca">
                    <Insignia tono="aviso">{TIPOS_COMPROBANTE[x.tipo]}</Insignia>
                    <span className="codigo text-xs">
                      {x.serie}-{x.numero}
                    </span>
                    <span className="flex-1 truncate text-tenue">{x.razon_social_contraparte}</span>
                    <span className="codigo">{dinero(x.detraccion_monto_pen, "PEN")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Seccion>
        )}
      </div>
    </>
  );
}
