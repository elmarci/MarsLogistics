import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario } from "@/components/Formulario";
import { Campo, Casilla, Encabezado, Rejilla, Selector, aInputFechaHora } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { actualizarContenedor } from "../../../actions";

export default async function ContenedorPage({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  const { data: k } = await supabase
    .from("contenedor")
    .select("*, embarque:embarque_id(orden_id, orden:orden_id(codigo))")
    .eq("id", cid)
    .single();
  const embarque = k?.embarque as { orden_id: number; orden: { codigo: string } } | null;
  if (!k || String(embarque?.orden_id) !== id) notFound();
  const c = await catalogos();

  return (
    <>
      <Link href={`/ordenes/${id}`} className="text-sm text-marca hover:underline">
        ← Orden {embarque?.orden.codigo}
      </Link>
      <Encabezado titulo={`Contenedor ${k.numero}`} detalle="Retiro del puerto, ingreso al almacén y devolución del vacío." />
      <div className="tarjeta">
        <Formulario accion={actualizarContenedor.bind(null, Number(id), k.id)} soloLectura={!puedeEscribir(perfil)}>
          <h2 className="text-sm font-medium">Datos</h2>
          <Rejilla>
            <Campo name="numero" label="Número" defaultValue={k.numero} required />
            <Campo name="tamano" label="Tamaño (pies)" defaultValue={k.tamano} />
            <Campo name="precinto" label="Precinto" defaultValue={k.precinto} />
            <Campo name="peso_bruto_kg" label="Peso bruto (kg)" type="number" step="0.001" defaultValue={k.peso_bruto_kg} />
            <Campo name="bultos" label="Bultos" type="number" defaultValue={k.bultos} />
            <Selector
              name="estado"
              label="Estado"
              vacio={false}
              defaultValue={k.estado}
              opciones={[
                { value: "en_transito", label: "En tránsito" },
                { value: "en_puerto", label: "En puerto" },
                { value: "retirado", label: "Retirado" },
                { value: "en_almacen", label: "En almacén" },
                { value: "vaciado", label: "Vaciado" },
                { value: "devuelto", label: "Vacío devuelto" },
              ]}
            />
          </Rejilla>

          <h2 className="pt-2 text-sm font-medium">Retiro del puerto</h2>
          <Rejilla>
            <Selector name="transporte_local_id" label="Transporte local" opciones={c.transportesLocales} defaultValue={k.transporte_local_id} />
            <Campo name="hora_descarga" label="Descarga de la nave" type="datetime-local" defaultValue={aInputFechaHora(k.hora_descarga)} />
            <Campo name="hora_cita" label="Cita de retiro" type="datetime-local" defaultValue={aInputFechaHora(k.hora_cita)} />
            <Campo name="hora_retiro" label="Retiro efectivo" type="datetime-local" defaultValue={aInputFechaHora(k.hora_retiro)} />
          </Rejilla>
          <div className="flex flex-wrap gap-6">
            <Casilla name="perdida_cita_puerto" label="Se perdió la cita en puerto" defaultChecked={k.perdida_cita_puerto} />
            <Casilla name="uso_area_puerto" label="Generó uso de área en puerto" defaultChecked={k.uso_area_puerto} />
          </div>

          <h2 className="pt-2 text-sm font-medium">Almacén</h2>
          <Rejilla>
            <Campo name="fecha_ingreso_almacen" label="Ingreso al almacén" type="datetime-local" defaultValue={aInputFechaHora(k.fecha_ingreso_almacen)} />
            <Campo name="fecha_apertura_almacen" label="Apertura / descarga" type="date" defaultValue={k.fecha_apertura_almacen} />
          </Rejilla>

          <h2 className="pt-2 text-sm font-medium">Devolución del vacío</h2>
          <Rejilla>
            <Selector name="deposito_vacio_id" label="Depósito de vacíos" opciones={c.depositosVacios} defaultValue={k.deposito_vacio_id} />
            <Campo name="cita_vacio" label="Cita de devolución" type="datetime-local" defaultValue={aInputFechaHora(k.cita_vacio)} />
            <Campo name="fecha_devolucion_vacio" label="Devolución efectiva" type="datetime-local" defaultValue={aInputFechaHora(k.fecha_devolucion_vacio)} />
          </Rejilla>
          <Casilla name="perdida_cita_vacio" label="Se perdió la cita de devolución" defaultChecked={k.perdida_cita_vacio} />
        </Formulario>
      </div>
    </>
  );
}
