import { Formulario } from "@/components/Formulario";
import { Campo, Casilla, Encabezado, Rejilla, Tabla } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearProducto } from "./actions";

export const metadata = { title: "Productos" };

type Fila = {
  id: number;
  codigo: string | null;
  descripcion: string;
  partida_arancelaria: string | null;
  es_matpel: boolean;
  numero_onu: string | null;
  unidad_bulto: string;
  peso_bulto_kg: number | null;
};

export default async function ProductosPage() {
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("producto")
    .select("id, codigo, descripcion, partida_arancelaria, es_matpel, numero_onu, unidad_bulto, peso_bulto_kg")
    .order("descripcion");

  return (
    <>
      <Encabezado titulo="Productos" detalle="Mercancías que se importan, con su partida y si son materiales peligrosos." />
      <Tabla
        filas={(data ?? []) as Fila[]}
        claveFila={(f) => f.id}
        columnas={[
          { titulo: "Descripción", valor: (f) => f.descripcion },
          { titulo: "Código", valor: (f) => f.codigo ?? "—" },
          { titulo: "Partida", valor: (f) => f.partida_arancelaria ?? "—" },
          { titulo: "MATPEL", valor: (f) => (f.es_matpel ? `Sí ${f.numero_onu ?? ""}` : "No") },
          { titulo: "Bulto", valor: (f) => `${f.unidad_bulto}${f.peso_bulto_kg ? ` · ${f.peso_bulto_kg} kg` : ""}` },
        ]}
      />
      {puedeEscribir(perfil) && (
        <div className="tarjeta mt-6">
          <h2 className="mb-3 font-medium">Nuevo producto</h2>
          <Formulario accion={crearProducto} textoBoton="Crear producto">
            <Rejilla>
              <Campo name="descripcion" label="Descripción" required />
              <Campo name="codigo" label="Código" />
              <Campo name="partida_arancelaria" label="Partida arancelaria" />
              <Campo name="clase_onu" label="Clase ONU" placeholder="6.1" />
              <Campo name="numero_onu" label="Número ONU" placeholder="UN1689" />
              <Campo name="unidad_medida" label="Unidad de medida" defaultValue="TM" />
              <Campo name="unidad_bulto" label="Tipo de bulto" defaultValue="CAJA" />
              <Campo name="peso_bulto_kg" label="Peso por bulto (kg)" type="number" step="0.001" />
            </Rejilla>
            <Casilla name="es_matpel" label="Es material peligroso (MATPEL)" />
          </Formulario>
        </div>
      )}
    </>
  );
}
