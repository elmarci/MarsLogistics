import { Formulario } from "@/components/Formulario";
import { Encabezado } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { CamposCliente } from "../CamposCliente";
import { crearCliente } from "../actions";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoClientePage() {
  await exigirInterno(["admin", "operaciones", "aduanas", "almacen", "transporte", "finanzas"]);
  return (
    <>
      <Encabezado titulo="Nuevo cliente" />
      <div className="tarjeta">
        <Formulario accion={crearCliente} textoBoton="Crear cliente">
          <CamposCliente />
        </Formulario>
      </div>
    </>
  );
}
