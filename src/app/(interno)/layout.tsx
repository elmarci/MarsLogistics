import { Navegacion, type ItemNav } from "@/components/Navegacion";
import { cerrarSesion } from "@/app/login/actions";
import { exigirInterno } from "@/lib/auth";
import { ETIQUETA_ROL } from "@/lib/tipos";

export default async function LayoutInterno({ children }: { children: React.ReactNode }) {
  const perfil = await exigirInterno();
  const items: ItemNav[] = [
    { href: "/", label: "Inicio" },
    { href: "/ordenes", label: "Órdenes" },
    { href: "/clientes", label: "Clientes" },
    { href: "/proveedores", label: "Proveedores" },
    { href: "/productos", label: "Productos" },
  ];
  if (perfil.rol === "admin") items.push({ href: "/usuarios", label: "Usuarios" });

  return (
    <div className="min-h-screen md:flex">
      <Navegacion items={items} nombre={perfil.nombre} rol={ETIQUETA_ROL[perfil.rol]} cerrar={cerrarSesion} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
