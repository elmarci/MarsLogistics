import { Formulario } from "@/components/Formulario";
import { Encabezado } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CamposOrden } from "../CamposOrden";
import { crearOrden } from "../actions";

export const metadata = { title: "Nueva orden" };

// Sugiere el siguiente código con el formato actual: SLI + año (2 dígitos) + correlativo de 4 dígitos.
async function siguienteCodigo() {
  const prefijo = `SLI${String(new Date().getFullYear()).slice(2)}`;
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("orden")
    .select("codigo")
    .like("codigo", `${prefijo}%`)
    .order("codigo", { ascending: false })
    .limit(1);
  const ultimo = Number(data?.[0]?.codigo.slice(prefijo.length)) || 0;
  return `${prefijo}${String(ultimo + 1).padStart(4, "0")}`;
}

export default async function NuevaOrdenPage() {
  await exigirInterno(["admin", "operaciones", "aduanas", "almacen", "transporte", "finanzas"]);
  const [c, codigo] = await Promise.all([catalogos(), siguienteCodigo()]);
  return (
    <>
      <Encabezado titulo="Nueva orden de importación" />
      <div className="tarjeta">
        <Formulario accion={crearOrden} textoBoton="Crear orden">
          <CamposOrden o={{ codigo }} clientes={c.clientes} sedes={c.sedes} productos={c.productos} />
        </Formulario>
      </div>
    </>
  );
}
