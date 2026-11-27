import { NextResponse } from "next/server";
import { obtenerPerfil, puedeVerCostos } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

// Exporta el registro del periodo para el contador (separado por ; y con BOM para Excel).
export async function GET(request: Request) {
  const perfil = await obtenerPerfil();
  if (!perfil?.activo || !puedeVerCostos(perfil)) return new NextResponse("Sin permiso", { status: 403 });
  const url = new URL(request.url);
  const periodo = url.searchParams.get("periodo") ?? "";
  const sentido = url.searchParams.get("sentido") === "RECIBIDO" ? "RECIBIDO" : "EMITIDO";
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("v_registro_contable")
    .select("*")
    .eq("periodo", periodo)
    .eq("sentido", sentido)
    .order("fecha_emision");
  const cols = [
    "periodo", "fecha_emision", "fecha_vencimiento", "tipo_sunat", "serie", "numero", "ruc_contraparte",
    "razon_social_contraparte", "moneda", "tipo_cambio", "base_gravada", "no_gravado", "isc", "igv", "otros_tributos",
    "total", "detraccion_codigo", "detraccion_monto_pen", "detraccion_constancia", "detraccion_fecha", "retencion_monto",
    "percepcion_monto", "ref_tipo", "ref_serie", "ref_numero", "ref_fecha", "expediente", "estado",
  ];
  const celda = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [cols.join(";"), ...(data ?? []).map((f) => cols.map((c) => celda((f as Record<string, unknown>)[c])).join(";"))].join("\r\n");
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registro-${sentido === "EMITIDO" ? "ventas" : "compras"}-${periodo}.csv"`,
    },
  });
}
