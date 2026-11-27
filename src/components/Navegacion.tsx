"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type ItemNav = { href: string; label: string };

export function Navegacion({ items, nombre, rol, cerrar }: { items: ItemNav[]; nombre: string; rol: string; cerrar: () => Promise<void> }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const enlaces = (
    <nav className="flex flex-col gap-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setAbierto(false)}
          className={`rounded-md px-3 py-2 text-sm ${
            activo(i.href) ? "bg-marca-claro font-medium text-marca" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );

  const pie = (
    <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
      <p className="font-medium text-slate-700">{nombre}</p>
      <p>{rol}</p>
      <form action={cerrar} className="mt-2">
        <button className="text-marca hover:underline">Cerrar sesión</button>
      </form>
    </div>
  );

  return (
    <>
      {/* Móvil: barra superior con menú desplegable */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-semibold text-marca">MarsLogistics</span>
        <button aria-label="Menú" onClick={() => setAbierto(!abierto)} className="rounded-md border border-slate-300 px-3 py-1 text-sm">
          {abierto ? "Cerrar" : "Menú"}
        </button>
      </header>
      {abierto && (
        <div className="fixed inset-x-0 top-[53px] z-10 space-y-3 border-b border-slate-200 bg-white p-4 shadow md:hidden">
          {enlaces}
          {pie}
        </div>
      )}

      {/* Escritorio: barra lateral */}
      <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 md:flex">
        <div>
          <p className="mb-6 px-3 text-lg font-semibold text-marca">MarsLogistics</p>
          {enlaces}
        </div>
        {pie}
      </aside>
    </>
  );
}
