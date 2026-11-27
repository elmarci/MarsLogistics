import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Perfil, Rol } from "@/lib/tipos";

export async function obtenerPerfil(): Promise<Perfil | null> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("perfil")
    .select("id, nombre, email, rol, cliente_id, activo")
    .eq("id", user.id)
    .single();
  return (data as Perfil | null) ?? null;
}

// Para pantallas del equipo interno. Un cliente va a su portal; un usuario inactivo, a esperar habilitación.
export async function exigirInterno(roles?: Rol[]): Promise<Perfil> {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login");
  if (!perfil.activo) redirect("/auth/pendiente");
  if (perfil.rol === "cliente") redirect("/portal");
  if (roles && !roles.includes(perfil.rol)) redirect("/");
  return perfil;
}

export async function exigirCliente(): Promise<Perfil> {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login");
  if (!perfil.activo) redirect("/auth/pendiente");
  if (perfil.rol !== "cliente") redirect("/");
  return perfil;
}

export const puedeEscribir = (p: Perfil) => p.rol !== "consulta" && p.rol !== "cliente";
export const puedeVerCostos = (p: Perfil) => ["admin", "finanzas", "operaciones", "aduanas"].includes(p.rol);
