"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { casilla, id, mensajeError, textoRequerido, validar, type ResultadoAccion } from "@/lib/acciones";
import { exigirInterno } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

const ROLES = ["admin", "operaciones", "aduanas", "almacen", "transporte", "finanzas", "consulta", "cliente"] as const;

const esquemaInvitacion = z
  .object({
    email: z.string().email("correo no válido"),
    nombre: textoRequerido,
    rol: z.enum(ROLES),
    cliente_id: id,
  })
  .refine((d) => (d.rol === "cliente") === (d.cliente_id != null), {
    message: "los usuarios de portal deben tener un cliente, y solo ellos",
    path: ["cliente_id"],
  });

export async function invitarUsuario(_: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  await exigirInterno(["admin"]);
  const v = validar(esquemaInvitacion, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  const d = datos;

  const admin = crearClienteAdmin();
  const { data, error: e } = await admin.auth.admin.inviteUserByEmail(d.email, {
    data: { nombre: d.nombre },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/definir-clave`,
  });
  if (e) return { error: `No se pudo invitar: ${e.message}` };

  // El trigger creó el perfil como 'consulta' inactivo; aquí se le asigna el rol real.
  const { error: e2 } = await admin
    .from("perfil")
    .update({ nombre: d.nombre, rol: d.rol, cliente_id: d.rol === "cliente" ? d.cliente_id : null, activo: true })
    .eq("id", data.user.id);
  if (e2) return { error: mensajeError(e2) };

  revalidatePath("/usuarios");
  return { ok: `Invitación enviada a ${d.email}.` };
}

const esquemaPerfil = z
  .object({ rol: z.enum(ROLES), cliente_id: id, activo: casilla })
  .refine((d) => (d.rol === "cliente") === (d.cliente_id != null), {
    message: "los usuarios de portal deben tener un cliente, y solo ellos",
    path: ["cliente_id"],
  });

export async function actualizarPerfil(perfilId: string, _: ResultadoAccion, formData: FormData): Promise<ResultadoAccion> {
  const yo = await exigirInterno(["admin"]);
  const v = validar(esquemaPerfil, formData);
  if (v.error !== null) return { error: v.error };
  const datos = v.datos;
  if (perfilId === yo.id && (datos.rol !== "admin" || !datos.activo)) {
    return { error: "No puedes quitarte el rol de administrador ni desactivarte a ti mismo." };
  }
  // Con la sesión del admin: la política RLS de perfil exige rol admin.
  const supabase = await crearClienteServidor();
  const { error: e } = await supabase.from("perfil").update(datos).eq("id", perfilId);
  if (e) return { error: mensajeError(e) };
  revalidatePath("/usuarios");
  return { ok: "Usuario actualizado." };
}
