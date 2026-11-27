import { notFound } from "next/navigation";
import { Formulario } from "@/components/Formulario";
import { Campo, Casilla, Encabezado, Rejilla, Tabla } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CamposCliente } from "../CamposCliente";
import { actualizarCliente, crearSede } from "../actions";

type Sede = { id: number; nombre: string; region: string | null; direccion: string | null; tiempo_estandar_horas: number | null };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await exigirInterno();
  const editable = puedeEscribir(perfil);
  const supabase = await crearClienteServidor();
  const { data: cliente } = await supabase.from("cliente").select("*").eq("id", id).single();
  if (!cliente) notFound();
  const { data: sedes } = await supabase
    .from("sede_cliente")
    .select("id, nombre, region, direccion, tiempo_estandar_horas")
    .eq("cliente_id", id)
    .order("nombre");

  return (
    <>
      <Encabezado titulo={cliente.razon_social} detalle={cliente.ruc ? `RUC ${cliente.ruc}` : undefined} />
      <section className="tarjeta mb-6">
        <h2 className="mb-4 font-medium">Datos del cliente</h2>
        {editable ? (
          <Formulario accion={actualizarCliente.bind(null, cliente.id)}>
            <CamposCliente c={cliente} />
            <Casilla name="activo" label="Cliente activo" defaultChecked={cliente.activo} />
          </Formulario>
        ) : (
          <CamposCliente c={cliente} />
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">Sedes y puntos de entrega</h2>
        <Tabla
          filas={(sedes ?? []) as Sede[]}
          claveFila={(s) => s.id}
          vacio="Aún no hay sedes registradas."
          columnas={[
            { titulo: "Sede", valor: (s) => s.nombre },
            { titulo: "Región", valor: (s) => s.region ?? "—" },
            { titulo: "Dirección", valor: (s) => s.direccion ?? "—" },
            { titulo: "Tiempo estándar (h)", valor: (s) => s.tiempo_estandar_horas ?? "—" },
          ]}
        />
        {editable && (
          <div className="tarjeta mt-4">
            <h3 className="mb-3 text-sm font-medium">Agregar sede</h3>
            <Formulario accion={crearSede.bind(null, cliente.id)} textoBoton="Agregar sede">
              <Rejilla>
                <Campo name="nombre" label="Nombre" required placeholder="p. ej. COIMOLACHE" />
                <Campo name="region" label="Región" />
                <Campo name="direccion" label="Dirección" />
                <Campo name="tiempo_estandar_horas" label="Tiempo estándar de viaje (h)" type="number" step="0.1" />
              </Rejilla>
            </Formulario>
          </div>
        )}
      </section>
    </>
  );
}
