"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Building2,
  Columns3,
  FolderKanban,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Radar,
  Receipt,
  Truck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const ICONOS = {
  radar: Radar,
  expedientes: FolderKanban,
  referencias: Columns3,
  tareas: ListChecks,
  pagos: Wallet,
  finanzas: Receipt,
  notificaciones: Bell,
  clientes: Building2,
  proveedores: Truck,
  productos: Package,
  usuarios: Users,
} satisfies Record<string, LucideIcon>;

const CORTO: Record<string, string> = { "/": "Torre", "/tareas": "Tareas", "/notificaciones": "Avisos" };

export type ItemNav = { href: string; label: string; icono: keyof typeof ICONOS; contador?: number; grupo?: string };

export function Navegacion({
  items,
  nombre,
  rol,
  cerrar,
}: {
  items: ItemNav[];
  nombre: string;
  rol: string;
  cerrar: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const enlace = (i: ItemNav) => {
    const Icono = ICONOS[i.icono];
    const on = activo(i.href);
    return (
      <Link
        key={i.href}
        href={i.href}
        onClick={() => setAbierto(false)}
        className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
          on ? "bg-marca-claro text-marca" : "text-slate-600 hover:bg-panel-2 hover:text-texto"
        }`}
      >
        {on && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded bg-marca" />}
        <Icono className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        <span className="flex-1">{i.label}</span>
        {!!i.contador && (
          <span className="codigo rounded bg-marca px-1.5 text-[10px] font-bold text-white">{i.contador}</span>
        )}
      </Link>
    );
  };

  const grupos = Array.from(new Set(items.map((i) => i.grupo ?? "")));
  const enlaces = (
    <nav className="flex flex-col gap-4">
      {grupos.map((g) => (
        <div key={g} className="flex flex-col gap-0.5">
          {g && <p className="mb-1 px-3 text-xs font-semibold text-slate-500">{g}</p>}
          {items.filter((i) => (i.grupo ?? "") === g).map(enlace)}
        </div>
      ))}
    </nav>
  );

  const pie = (
    <div className="flex items-center justify-between gap-2 border-t border-borde pt-3">
      <div className="min-w-0 text-xs">
        <p className="truncate font-medium text-texto">{nombre}</p>
        <p className="text-tenue">{rol}</p>
      </div>
      <form action={cerrar}>
        <button className="rounded p-2 text-tenue hover:bg-panel-2 hover:text-marca" title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  const barraMovil = items.filter((i) => ["/", "/expedientes", "/referencias", "/tareas", "/notificaciones"].includes(i.href));

  return (
    <>
      {/* Celular: barra superior + barra inferior de accesos rápidos */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borde bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button aria-label="Menú" onClick={() => setAbierto(!abierto)} className="rounded-md border border-borde-fuerte p-2">
          {abierto ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </header>
      {abierto && (
        <div className="fixed inset-x-0 top-[57px] bottom-0 z-30 space-y-4 overflow-y-auto bg-white/95 p-4 backdrop-blur md:hidden">
          {enlaces}
          {pie}
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-borde bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {barraMovil.map((i) => {
          const Icono = ICONOS[i.icono];
          const on = activo(i.href);
          return (
            <Link key={i.href} href={i.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] ${on ? "text-marca" : "text-tenue"}`}>
              <Icono className="h-5 w-5" strokeWidth={1.6} />
              {CORTO[i.href] ?? i.label}
              {!!i.contador && <span className="absolute top-1 right-[30%] h-2 w-2 rounded-full bg-marca" />}
            </Link>
          );
        })}
      </nav>

      {/* Escritorio: barra lateral */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-borde bg-white p-4 backdrop-blur md:flex">
        <div className="space-y-6 overflow-y-auto">
          <div className="px-1 pt-1">
            <Logo />
          </div>
          {enlaces}
        </div>
        {pie}
      </aside>
    </>
  );
}
