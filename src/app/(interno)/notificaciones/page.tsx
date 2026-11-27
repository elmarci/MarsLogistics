import Link from "next/link";
import { Bell } from "lucide-react";
import { BotonAccion } from "@/components/Formulario";
import { Encabezado, Vacio, fechaHora } from "@/components/ui";
import { marcarLeidas } from "@/app/(interno)/colaboracion";
import { exigirInterno } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Avisos" };

export default async function NotificacionesPage() {
  await exigirInterno();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("notificacion").select("*").order("creado_en", { ascending: false }).limit(100);
  const lista = data ?? [];
  return (
    <>
      <Encabezado etiqueta="Operación" titulo="Avisos" detalle="Asignaciones, menciones, documentos observados, pagos y levantes.">
        {lista.some((n) => !n.leida) && <BotonAccion accion={marcarLeidas.bind(null, "todas")} clase="boton-secundario">Marcar todo como leído</BotonAccion>}
      </Encabezado>
      {lista.length === 0 ? (
        <Vacio>No tienes avisos.</Vacio>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde bg-panel">
          {lista.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 p-3 ${n.leida ? "opacity-60" : ""}`}>
              <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.leida ? "text-tenue" : "text-marca"}`} strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                {n.enlace ? (
                  <Link href={n.enlace} className="text-sm font-medium hover:text-marca">
                    {n.titulo}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{n.titulo}</p>
                )}
                {n.cuerpo && <p className="text-xs text-tenue">{n.cuerpo}</p>}
                <p className="codigo mt-0.5 text-[11px] text-slate-400">{fechaHora(n.creado_en)}</p>
              </div>
              {!n.leida && <BotonAccion accion={marcarLeidas.bind(null, [n.id])}>Leído</BotonAccion>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
