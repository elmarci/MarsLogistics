import { Navegacion, type ItemNav } from "@/components/Navegacion";
import { cerrarSesion } from "@/app/login/actions";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_ROL } from "@/lib/tipos";

export default async function LayoutInterno({ children }: { children: React.ReactNode }) {
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  const [{ count: noLeidas }, { count: tareas }, { count: pagos }] = await Promise.all([
    supabase.from("notificacion").select("id", { count: "exact", head: true }).eq("leida", false),
    supabase
      .from("tarea")
      .select("id", { count: "exact", head: true })
      .eq("asignado_a", perfil.id)
      .in("estado", ["pendiente", "en_proceso"]),
    perfil.rol === "finanzas"
      ? supabase.from("solicitud_pago").select("id", { count: "exact", head: true }).eq("estado", "solicitada")
      : Promise.resolve({ count: 0 }),
  ]);

  const items: ItemNav[] = [
    { href: "/", label: "Torre de control", icono: "radar", grupo: "Operación" },
    { href: "/expedientes", label: "Expedientes", icono: "expedientes", grupo: "Operación" },
    { href: "/referencias", label: "Referencias", icono: "referencias", grupo: "Operación" },
    { href: "/tareas", label: "Mis tareas", icono: "tareas", contador: tareas ?? 0, grupo: "Operación" },
    { href: "/pagos", label: "Pagos", icono: "pagos", contador: pagos ?? 0, grupo: "Operación" },
    { href: "/notificaciones", label: "Avisos", icono: "notificaciones", contador: noLeidas ?? 0, grupo: "Operación" },
    ...(["admin", "finanzas", "operaciones", "aduanas"].includes(perfil.rol)
      ? [{ href: "/finanzas", label: "Finanzas", icono: "finanzas", grupo: "Administración" } as ItemNav]
      : []),
    { href: "/clientes", label: "Clientes", icono: "clientes", grupo: "Maestros" },
    { href: "/proveedores", label: "Proveedores", icono: "proveedores", grupo: "Maestros" },
    { href: "/productos", label: "Productos", icono: "productos", grupo: "Maestros" },
  ];
  if (perfil.rol === "admin") items.push({ href: "/usuarios", label: "Usuarios", icono: "usuarios", grupo: "Maestros" });

  return (
    <div className="min-h-screen md:flex">
      <Navegacion items={items} nombre={perfil.nombre} rol={ETIQUETA_ROL[perfil.rol]} cerrar={cerrarSesion} />
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
