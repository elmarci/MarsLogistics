import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/Formulario";
import { LineaEtapas } from "@/components/LineaEtapas";
import { Campo, Encabezado, Rejilla, Selector, Tabla, aInputFechaHora, fecha, fechaHora } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ESTADOS_ORDEN, ETIQUETA_ESTADO, type EstadoOrden } from "@/lib/tipos";
import { CamposOrden } from "../CamposOrden";
import { actualizarOrden, agregarContenedores, guardarAduana, guardarEmbarque, registrarDudaRazonable } from "../actions";

const ETIQUETA_CONTENEDOR: Record<string, string> = {
  en_transito: "En tránsito",
  en_puerto: "En puerto",
  retirado: "Retirado",
  en_almacen: "En almacén",
  vaciado: "Vaciado",
  devuelto: "Vacío devuelto",
};

type Contenedor = {
  id: number;
  numero: string;
  tamano: string;
  precinto: string | null;
  bultos: number | null;
  hora_retiro: string | null;
  fecha_devolucion_vacio: string | null;
  estado: string;
};

function Seccion({ titulo, children, abierta = false }: { titulo: string; children: React.ReactNode; abierta?: boolean }) {
  return (
    <details open={abierta} className="tarjeta mb-4">
      <summary className="cursor-pointer font-medium">{titulo}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await exigirInterno();
  const editable = puedeEscribir(perfil);
  const supabase = await crearClienteServidor();

  const { data: orden } = await supabase.from("orden").select("*, cliente:cliente_id(razon_social)").eq("id", id).single();
  if (!orden) notFound();

  const [{ data: embarques }, { data: aduanas }, c] = await Promise.all([
    supabase.from("embarque").select("*, contenedor(id, numero, tamano, precinto, bultos, hora_retiro, fecha_devolucion_vacio, estado)").eq("orden_id", id).order("id"),
    supabase.from("despacho_aduanero").select("*, duda_razonable(*)").eq("orden_id", id).order("id"),
    catalogos(),
  ]);
  const embarque = embarques?.[0] ?? null;
  const aduana = aduanas?.[0] ?? null;
  const contenedores = ((embarque?.contenedor ?? []) as Contenedor[]).sort((a, b) => a.numero.localeCompare(b.numero));

  return (
    <>
      <Link href="/ordenes" className="text-sm text-marca hover:underline">
        ← Órdenes
      </Link>
      <Encabezado titulo={orden.codigo} detalle={(orden.cliente as { razon_social: string } | null)?.razon_social} />
      <div className="mb-6">
        <LineaEtapas estado={orden.estado as EstadoOrden} />
      </div>

      <Seccion titulo="Datos de la orden" abierta={!embarque}>
        {editable ? (
          <Formulario accion={actualizarOrden.bind(null, orden.id)}>
            <CamposOrden o={orden} clientes={c.clientes} sedes={c.sedes} productos={c.productos} />
            <Rejilla>
              <Selector
                name="estado"
                label="Estado"
                vacio={false}
                defaultValue={orden.estado}
                opciones={ESTADOS_ORDEN.map((e) => ({ value: e, label: ETIQUETA_ESTADO[e] }))}
              />
              <Campo name="fecha_cierre" label="Fecha de cierre" type="date" defaultValue={orden.fecha_cierre} />
            </Rejilla>
          </Formulario>
        ) : (
          <CamposOrden o={orden} clientes={c.clientes} sedes={c.sedes} productos={c.productos} />
        )}
      </Seccion>

      <Seccion titulo="Tránsito internacional" abierta={!!embarque && !aduana}>
        <Formulario accion={guardarEmbarque.bind(null, orden.id, embarque?.id ?? null)} textoBoton={embarque ? "Guardar embarque" : "Registrar embarque"} soloLectura={!editable}>
          <Rejilla>
            <Selector name="naviera_id" label="Naviera" opciones={c.navieras} defaultValue={embarque?.naviera_id} />
            <Campo name="mbl" label="MBL / BL" defaultValue={embarque?.mbl} />
            <Campo name="hbl" label="HBL" defaultValue={embarque?.hbl} />
            <Selector
              name="condicion"
              label="Condición"
              vacio={false}
              defaultValue={embarque?.condicion ?? "FCL"}
              opciones={[
                { value: "FCL", label: "FCL" },
                { value: "LCL", label: "LCL" },
              ]}
            />
            <Campo name="puerto_origen" label="Puerto de origen" defaultValue={embarque?.puerto_origen} />
            <Campo name="puerto_destino" label="Puerto de destino" defaultValue={embarque?.puerto_destino ?? "CALLAO"} />
            <Selector name="terminal_id" label="Terminal" opciones={c.terminales} defaultValue={embarque?.terminal_id} />
            <Campo name="manifiesto" label="Manifiesto" defaultValue={embarque?.manifiesto} />
            <Campo name="etd" label="ETD" type="date" defaultValue={embarque?.etd} />
            <Campo name="eta" label="ETA" type="date" defaultValue={embarque?.eta} />
            <Campo name="fecha_llegada" label="Llegada real" type="date" defaultValue={embarque?.fecha_llegada} />
            <Campo name="dias_libres" label="Días libres (sobrestadía)" type="number" defaultValue={embarque?.dias_libres} />
            <Campo name="vencimiento_memo" label="Vencimiento de memo" type="date" defaultValue={embarque?.vencimiento_memo} />
          </Rejilla>
        </Formulario>

        {embarque && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium">Contenedores ({contenedores.length})</h3>
            <Tabla
              filas={contenedores}
              claveFila={(k) => k.id}
              enlace={(k) => `/ordenes/${orden.id}/contenedores/${k.id}`}
              vacio="Aún no hay contenedores."
              columnas={[
                { titulo: "Contenedor", valor: (k) => k.numero },
                { titulo: "Tamaño", valor: (k) => `${k.tamano}'` },
                { titulo: "Precinto", valor: (k) => k.precinto ?? "—" },
                { titulo: "Bultos", valor: (k) => k.bultos ?? "—" },
                { titulo: "Retiro", valor: (k) => fechaHora(k.hora_retiro) },
                { titulo: "Vacío devuelto", valor: (k) => fechaHora(k.fecha_devolucion_vacio) },
                { titulo: "Estado", valor: (k) => ETIQUETA_CONTENEDOR[k.estado] },
              ]}
            />
            {editable && (
              <div className="mt-4 rounded-md border border-dashed border-slate-300 p-4">
                <Formulario accion={agregarContenedores.bind(null, orden.id, embarque.id)} textoBoton="Agregar contenedores">
                  <div>
                    <label className="etiqueta" htmlFor="numeros">
                      Números de contenedor (uno por línea o separados por coma)
                    </label>
                    <textarea id="numeros" name="numeros" rows={3} className="campo" placeholder={"CAAU2114819\nCAIU6398819"} />
                  </div>
                  <Rejilla>
                    <Campo name="tamano" label="Tamaño (pies)" defaultValue="20" />
                    <Campo name="bultos" label="Bultos por contenedor" type="number" defaultValue={20} />
                  </Rejilla>
                </Formulario>
              </div>
            )}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Aduana" abierta={!!aduana}>
        <Formulario accion={guardarAduana.bind(null, orden.id, aduana?.id ?? null)} textoBoton={aduana ? "Guardar aduana" : "Registrar despacho aduanero"} soloLectura={!editable}>
          <Rejilla>
            <Selector name="agente_id" label="Agente de aduanas" opciones={c.agentes} defaultValue={aduana?.agente_id} />
            <Campo name="dam" label="DAM" defaultValue={aduana?.dam} />
            <Selector
              name="canal"
              label="Canal"
              defaultValue={aduana?.canal}
              opciones={[
                { value: "VERDE", label: "Verde" },
                { value: "NARANJA", label: "Naranja" },
                { value: "ROJO", label: "Rojo" },
              ]}
            />
            <Campo name="fecha_envio_docs" label="Envío de documentos" type="date" defaultValue={aduana?.fecha_envio_docs} />
            <Campo name="fecha_borradores" label="Borradores" type="date" defaultValue={aduana?.fecha_borradores} />
            <Campo name="fecha_numeracion" label="Numeración" type="datetime-local" defaultValue={aInputFechaHora(aduana?.fecha_numeracion)} />
            <Campo name="fecha_pago_derechos" label="Pago de derechos" type="date" defaultValue={aduana?.fecha_pago_derechos} />
            <Campo name="fecha_levante" label="Levante" type="datetime-local" defaultValue={aInputFechaHora(aduana?.fecha_levante)} />
            <Campo name="invoice" label="Factura comercial" defaultValue={aduana?.invoice} />
            <Campo name="valor_fob" label="Valor FOB (USD)" type="number" step="0.01" defaultValue={aduana?.valor_fob} />
            <Campo name="valor_cif" label="Valor CIF (USD)" type="number" step="0.01" defaultValue={aduana?.valor_cif} />
            <Selector
              name="estado"
              label="Estado"
              vacio={false}
              defaultValue={aduana?.estado ?? "pendiente"}
              opciones={[
                { value: "pendiente", label: "Pendiente" },
                { value: "numerado", label: "Numerado" },
                { value: "en_revision", label: "En revisión" },
                { value: "liberado", label: "Liberado (levante)" },
              ]}
            />
          </Rejilla>
        </Formulario>

        {aduana && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium">Dudas razonables</h3>
            <Tabla
              filas={(aduana.duda_razonable ?? []) as { id: number; numero_notificacion: string | null; fecha_emision: string | null; plazo_respuesta: string | null; estado: string }[]}
              claveFila={(d) => d.id}
              vacio="Sin dudas razonables."
              columnas={[
                { titulo: "Notificación", valor: (d) => d.numero_notificacion ?? "—" },
                { titulo: "Emisión", valor: (d) => fecha(d.fecha_emision) },
                { titulo: "Plazo de respuesta", valor: (d) => fecha(d.plazo_respuesta) },
                { titulo: "Estado", valor: (d) => d.estado },
              ]}
            />
            {editable && (
              <div className="mt-4 rounded-md border border-dashed border-slate-300 p-4">
                <Formulario accion={registrarDudaRazonable.bind(null, orden.id, aduana.id)} textoBoton="Registrar duda razonable">
                  <Rejilla>
                    <Campo name="numero_notificacion" label="N° de notificación" />
                    <Campo name="fecha_emision" label="Emisión" type="date" />
                    <Campo name="fecha_recepcion" label="Recepción" type="date" />
                    <Campo name="plazo_respuesta" label="Plazo de respuesta" type="date" />
                    <Campo name="garantia" label="Garantía solicitada" />
                    <Campo name="descripcion" label="Descripción" />
                  </Rejilla>
                </Formulario>
              </div>
            )}
          </div>
        )}
      </Seccion>

      <p className="text-xs text-slate-500">Almacén, despachos a destino y costos de la orden se agregan en la siguiente entrega.</p>
    </>
  );
}
