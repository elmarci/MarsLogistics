import Link from "next/link";
import { Formulario } from "@/components/Formulario";
import { AreaTexto, Campo, Encabezado, Rejilla, Selector } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { TIPOS_COMPROBANTE } from "@/lib/tipos";
import { crearComprobante } from "../../actions";

export const metadata = { title: "Nuevo comprobante" };

export default async function NuevoComprobantePage({
  searchParams,
}: {
  searchParams: Promise<{ sentido?: string; expediente?: string; ref?: string; tipo?: string }>;
}) {
  await exigirInterno(["admin", "finanzas", "operaciones", "aduanas"]);
  const sp = await searchParams;
  const supabase = await crearClienteServidor();
  const { data: origen } = sp.ref
    ? await supabase.from("comprobante").select("id, sentido, tipo, serie, numero, cliente_id, proveedor_id, expediente_id, moneda, tipo_cambio").eq("id", Number(sp.ref)).maybeSingle()
    : { data: null };
  const sentido = origen?.sentido ?? (sp.sentido === "RECIBIDO" ? "RECIBIDO" : "EMITIDO");
  const tipo = sp.tipo ?? (origen ? "NOTA_CREDITO" : "FACTURA");
  const [c, { data: series }, { data: detracciones }, { data: expedientes }] = await Promise.all([
    catalogos(),
    supabase.from("serie_comprobante").select("tipo, serie").eq("activo", true).order("serie"),
    supabase.from("detraccion_tipo").select("codigo, descripcion, porcentaje").eq("activo", true).order("codigo"),
    supabase.from("expediente").select("id, codigo, cliente:cliente_id(nombre_comercial, razon_social)").neq("estado", "anulado").order("creado_en", { ascending: false }).limit(300),
  ]);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const opcionesExp = (expedientes ?? []).map((e) => {
    const cl = e.cliente as unknown as { nombre_comercial: string | null; razon_social: string } | null;
    return { value: e.id, label: `${e.codigo} · ${cl?.nombre_comercial ?? cl?.razon_social ?? ""}` };
  });

  return (
    <>
      <Encabezado
        etiqueta="Finanzas"
        titulo={origen ? `Nota sobre ${origen.serie}-${origen.numero}` : "Nuevo comprobante"}
        detalle="Primero la cabecera; luego agregas las líneas y el sistema calcula IGV, ISC, detracción y total."
      />
      {!origen && (
        <div className="mb-4 flex gap-1">
          {[
            ["EMITIDO", "Venta: emitir a un cliente"],
            ["RECIBIDO", "Compra: registrar de un proveedor"],
          ].map(([v, l]) => (
            <Link
              key={v}
              href={`/finanzas/comprobantes/nuevo?sentido=${v}${sp.expediente ? `&expediente=${sp.expediente}` : ""}`}
              className={`rounded-md border px-3 py-1.5 text-xs ${sentido === v ? "border-marca bg-marca-claro text-marca" : "border-borde text-tenue"}`}
            >
              {l}
            </Link>
          ))}
        </div>
      )}
      <Formulario accion={crearComprobante} textoBoton="Crear y agregar líneas" className="tarjeta max-w-4xl">
        <input type="hidden" name="sentido" value={sentido} />
        {origen && <input type="hidden" name="comprobante_ref_id" value={origen.id} />}
        <Rejilla columnas={4}>
          <Selector
            name="tipo"
            label="Tipo"
            vacio={false}
            defaultValue={tipo}
            opciones={Object.entries(TIPOS_COMPROBANTE)
              .filter(([k]) => (origen ? k === "NOTA_CREDITO" || k === "NOTA_DEBITO" : sentido === "EMITIDO" ? ["FACTURA", "BOLETA"].includes(k) : true))
              .map(([value, label]) => ({ value, label }))}
          />
          {sentido === "EMITIDO" ? (
            <Selector
              name="serie"
              label="Serie"
              vacio={false}
              opciones={(series ?? []).map((s) => ({ value: s.serie, label: `${s.serie} (${TIPOS_COMPROBANTE[s.tipo as keyof typeof TIPOS_COMPROBANTE]})` }))}
            />
          ) : (
            <>
              <Campo name="serie" label="Serie" required placeholder="F001" />
              <Campo name="numero" label="Número" required />
            </>
          )}
          <Campo name="fecha_emision" label="Emisión" type="date" defaultValue={hoy} required />
          <Campo name="fecha_vencimiento" label="Vencimiento" type="date" />
        </Rejilla>
        <Rejilla columnas={2}>
          {sentido === "EMITIDO" ? (
            <Selector name="cliente_id" label="Cliente" opciones={c.clientes} defaultValue={origen?.cliente_id} required />
          ) : (
            <Selector name="proveedor_id" label="Proveedor" opciones={c.proveedores} defaultValue={origen?.proveedor_id} required />
          )}
          <Selector name="expediente_id" label="Expediente (imputación principal)" opciones={opcionesExp} defaultValue={origen?.expediente_id ?? sp.expediente} />
        </Rejilla>
        <Rejilla columnas={4}>
          <Selector name="moneda" label="Moneda" vacio={false} opciones={[{ value: "USD", label: "USD" }, { value: "PEN", label: "PEN" }]} defaultValue={origen?.moneda ?? "USD"} />
          <Campo name="tipo_cambio" label="Tipo de cambio (S/ por US$)" type="number" step="0.0001" defaultValue={origen?.tipo_cambio ?? 1} />
          <Campo name="igv_porcentaje" label="IGV %" type="number" step="0.01" defaultValue={18} />
          <Selector name="forma_pago" label="Forma de pago" vacio={false} opciones={[{ value: "CREDITO", label: "Crédito" }, { value: "CONTADO", label: "Contado" }]} />
        </Rejilla>
        <Rejilla columnas={4}>
          <Selector
            name="detraccion_codigo"
            label="Detracción"
            vacio="Sin detracción"
            opciones={(detracciones ?? []).map((d) => ({ value: d.codigo, label: `${d.codigo} · ${d.descripcion} (${d.porcentaje}%)` }))}
          />
          <Campo name="retencion_monto" label="Retención" type="number" step="0.01" />
          <Campo name="percepcion_monto" label="Percepción" type="number" step="0.01" />
          <Campo name="otros_tributos" label="Otros tributos" type="number" step="0.01" />
        </Rejilla>
        {origen && <Campo name="motivo_nota" label="Motivo de la nota" required />}
        <AreaTexto name="observacion" label="Observación" filas={2} />
      </Formulario>
    </>
  );
}
