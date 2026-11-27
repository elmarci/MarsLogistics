import { Formulario } from "@/components/Formulario";
import { Encabezado } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { CamposProveedor } from "../CamposProveedor";
import { crearProveedor } from "../actions";

export const metadata = { title: "Nuevo proveedor" };

export default async function NuevoProveedorPage() {
  await exigirInterno(["admin", "operaciones", "aduanas", "almacen", "transporte", "finanzas"]);
  return (
    <>
      <Encabezado titulo="Nuevo proveedor" />
      <div className="tarjeta">
        <Formulario accion={crearProveedor} textoBoton="Crear proveedor">
          <CamposProveedor />
        </Formulario>
      </div>
    </>
  );
}
