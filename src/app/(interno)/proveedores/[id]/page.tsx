import { notFound } from "next/navigation";
import { Formulario } from "@/components/Formulario";
import { Casilla, Encabezado } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_TIPO_PROVEEDOR } from "@/lib/tipos";
import { CamposProveedor } from "../CamposProveedor";
import { actualizarProveedor } from "../actions";

export default async function ProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  const { data: p } = await supabase.from("proveedor").select("*").eq("id", id).single();
  if (!p) notFound();

  return (
    <>
      <Encabezado titulo={p.nombre_corto ?? p.razon_social} detalle={ETIQUETA_TIPO_PROVEEDOR[p.tipo as keyof typeof ETIQUETA_TIPO_PROVEEDOR]} />
      <section className="tarjeta">
        {puedeEscribir(perfil) ? (
          <Formulario accion={actualizarProveedor.bind(null, p.id)}>
            <CamposProveedor p={p} />
            <Casilla name="activo" label="Proveedor activo" defaultChecked={p.activo} />
          </Formulario>
        ) : (
          <CamposProveedor p={p} />
        )}
      </section>
    </>
  );
}
