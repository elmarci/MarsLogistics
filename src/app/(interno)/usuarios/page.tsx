import { Formulario } from "@/components/Formulario";
import { Campo, Casilla, Encabezado, Rejilla, Selector } from "@/components/ui";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_ROL, type Perfil, type Rol } from "@/lib/tipos";
import { actualizarPerfil, invitarUsuario } from "./actions";

export const metadata = { title: "Usuarios" };

const opcionesRol = (Object.keys(ETIQUETA_ROL) as Rol[]).map((r) => ({ value: r, label: ETIQUETA_ROL[r] }));

export default async function UsuariosPage() {
  await exigirInterno(["admin"]);
  const supabase = await crearClienteServidor();
  const [{ data: perfiles }, { data: clientes }] = await Promise.all([
    supabase.from("perfil").select("id, nombre, email, rol, cliente_id, activo").order("nombre"),
    supabase.from("cliente").select("id, razon_social").order("razon_social"),
  ]);
  const opcionesCliente = (clientes ?? []).map((c) => ({ value: c.id, label: c.razon_social }));

  return (
    <>
      <Encabezado titulo="Usuarios" detalle="Equipo interno y usuarios del portal de clientes." />

      <section className="tarjeta mb-6">
        <h2 className="mb-3 font-medium">Invitar usuario</h2>
        <p className="mb-4 text-sm text-slate-500">
          Le llegará un correo para crear su contraseña. Para el portal elige el rol &quot;Cliente&quot; y su empresa.
        </p>
        <Formulario accion={invitarUsuario} textoBoton="Enviar invitación">
          <Rejilla>
            <Campo name="nombre" label="Nombre" required />
            <Campo name="email" label="Correo" type="email" required />
            <Selector name="rol" label="Rol" opciones={opcionesRol} vacio={false} defaultValue="operaciones" />
            <Selector name="cliente_id" label="Cliente (solo para portal)" opciones={opcionesCliente} />
          </Rejilla>
        </Formulario>
      </section>

      <div className="space-y-3">
        {((perfiles ?? []) as Perfil[]).map((p) => (
          <details key={p.id} className="tarjeta">
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">{p.nombre}</span> · {p.email} · {ETIQUETA_ROL[p.rol]}
              {!p.activo && <span className="ml-2 text-aviso">(inactivo)</span>}
            </summary>
            <div className="mt-4">
              <Formulario accion={actualizarPerfil.bind(null, p.id)}>
                <Rejilla>
                  <Selector name="rol" label="Rol" opciones={opcionesRol} vacio={false} defaultValue={p.rol} />
                  <Selector name="cliente_id" label="Cliente (solo para portal)" opciones={opcionesCliente} defaultValue={p.cliente_id} />
                </Rejilla>
                <Casilla name="activo" label="Usuario activo" defaultChecked={p.activo} />
              </Formulario>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
