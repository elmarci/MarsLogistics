import type { LucideIcon } from "lucide-react";

export function Seccion({
  id,
  titulo,
  icono: Icono,
  extra,
  children,
}: {
  id?: string;
  titulo: string;
  icono?: LucideIcon;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="tarjeta min-w-0 scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="titulo-seccion mb-0">
          {Icono && <Icono className="h-3.5 w-3.5 text-marca" strokeWidth={2} />}
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

// Índice de secciones de una ficha larga: en celular se desliza horizontal.
export function Indice({ items }: { items: [string, string][] }) {
  return (
    <nav className="sticky top-[57px] z-10 -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-borde bg-fondo/90 px-4 py-2 backdrop-blur md:top-0 md:mx-0 md:rounded-lg md:border md:px-2">
      {items.map(([id, t]) => (
        <a key={id} href={`#${id}`} className="rounded px-2.5 py-1 text-xs whitespace-nowrap text-tenue hover:bg-panel-2 hover:text-marca">
          {t}
        </a>
      ))}
    </nav>
  );
}
