import Link from "next/link";
import { BarraEtapas, IconoTipo, duracion } from "@/components/ui";
import { demorada, type Avance } from "@/lib/operacion";

// Una fila por referencia: código, etapa actual y barra de avance. Es la "línea de tiempo" del expediente.
export function LineaReferencias({ refs, compacta = false, base = "/referencias" }: { refs: Avance[]; compacta?: boolean; base?: string | null }) {
  return (
    <ul className={compacta ? "space-y-1.5" : "divide-y divide-borde"}>
      {refs.map((r) => {
        const tarde = demorada(r);
        return (
          <li key={r.id}>
            <Fila
              href={base ? `${base}/${r.id}` : null}
              className={`group grid grid-cols-[auto_6.5rem_1fr] items-center gap-3 ${compacta ? "" : "py-3"} ${r.estado === "anulada" ? "opacity-40" : ""}`}
            >
              <IconoTipo tipo={r.tipo} className="h-4 w-4 text-tenue group-hover:text-marca" />
              <span className="codigo text-sm group-hover:text-marca">{r.codigo}</span>
              <span className="min-w-0 space-y-1">
                <BarraEtapas total={r.total_etapas} actual={r.etapa_orden ?? 0} estado={r.estado} demorada={tarde} />
                {!compacta && (
                  <span className="flex justify-between gap-2 text-xs text-tenue">
                    <span className="truncate">{r.estado === "anulada" ? "Anulada" : r.etapa}</span>
                    {r.estado === "activa" && (
                      <span className={`codigo shrink-0 ${tarde ? "text-aviso" : ""}`}>{duracion(r.horas_en_etapa)}</span>
                    )}
                  </span>
                )}
              </span>
            </Fila>
          </li>
        );
      })}
    </ul>
  );
}

function Fila({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
