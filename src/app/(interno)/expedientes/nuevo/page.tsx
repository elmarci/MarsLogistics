import { Formulario } from "@/components/Formulario";
import { IconoTipo, Encabezado } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { catalogos } from "@/lib/catalogos";
import { equipo } from "@/lib/operacion";
import { INFO_TIPO, TIPOS_REFERENCIA } from "@/lib/tipos";
import { crearExpediente } from "../actions";
import { CamposExpediente } from "../CamposExpediente";

export const metadata = { title: "Nuevo expediente" };

export default async function NuevoExpedientePage() {
  const perfil = await exigirInterno(["admin", "operaciones", "aduanas", "almacen", "transporte", "finanzas"]);
  const [c, gente] = await Promise.all([catalogos(), equipo()]);
  return (
    <>
      <Encabezado etiqueta="Expediente" titulo="Nuevo expediente" detalle="El código EXP se asigna solo. Marca los servicios que incluye y sus referencias nacen ya amarradas." />
      <Formulario accion={crearExpediente} textoBoton="Crear expediente" className="tarjeta max-w-4xl">
        <CamposExpediente c={c} equipo={gente} valores={{ responsable_id: perfil.id }} />
        <div>
          <p className="etiqueta">Servicios del expediente</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {TIPOS_REFERENCIA.map((t) => (
              <label
                key={t}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-borde-fuerte p-3 text-sm has-[:checked]:border-marca has-[:checked]:bg-marca-claro has-[:checked]:text-marca"
              >
                <input type="checkbox" name={`ref_${t}`} className="sr-only" defaultChecked={t === "CARGA_MARITIMA" || t === "ADUANA"} />
                <IconoTipo tipo={t} />
                <span>
                  {INFO_TIPO[t].corto}
                  <span className="codigo block text-[10px] opacity-70">{INFO_TIPO[t].prefijo}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-tenue">Podrás agregar más referencias después (por ejemplo, un transporte por cada despacho).</p>
        </div>
      </Formulario>
    </>
  );
}
