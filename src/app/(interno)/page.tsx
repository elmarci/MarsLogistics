import Link from "next/link";
import { Activity, AlertTriangle, Boxes, FolderKanban, ListChecks, Ship } from "lucide-react";
import { Seccion } from "@/components/Seccion";
import { ListaTareas, type Tarea } from "@/components/operacion/Tareas";
import { Encabezado, IconoTipo, Kpi, Vacio, fecha } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { demorada, etapasPorTipo, type Avance } from "@/lib/operacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { INFO_TIPO, TIPOS_REFERENCIA } from "@/lib/tipos";

export const metadata = { title: "Torre de control" };

type Alerta = { tipo: string; severidad: "alta" | "media"; mensaje: string; enlace: string; usuario_id: string | null; fecha: string | null };

export default async function TorreDeControl() {
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  const hoy = new Date().toISOString().slice(0, 10);
  const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [{ count: expedientes }, { data: avances }, { data: alertas }, { data: tareas }, { data: stock }, { data: arribos }, etapas] =
    await Promise.all([
      supabase.from("expediente").select("id", { count: "exact", head: true }).in("estado", ["abierto", "en_curso"]),
      supabase.from("v_referencia_avance").select("*").eq("estado", "activa").limit(3000),
      supabase.from("v_alerta").select("tipo, severidad, mensaje, enlace, usuario_id, fecha").order("fecha").limit(200),
      supabase
        .from("tarea")
        .select("id, titulo, descripcion, vence_en, estado, asignado:asignado_a(nombre), referencia:referencia_id(id, codigo), expediente:expediente_id(id, codigo)")
        .eq("asignado_a", perfil.id)
        .in("estado", ["pendiente", "en_proceso"])
        .order("vence_en", { nullsFirst: false })
        .limit(8),
      supabase.from("v_stock_almacenaje").select("stock_actual").gt("stock_actual", 0),
      supabase
        .from("ref_carga")
        .select("eta, mbl, referencia:referencia_id(id, codigo, estado, expediente:expediente_id(cliente:cliente_id(nombre_comercial, razon_social)))")
        .gte("eta", hoy)
        .lte("eta", en7)
        .order("eta"),
      etapasPorTipo(),
    ]);

  const refs = (avances ?? []) as Avance[];
  const todas = (alertas ?? []) as Alerta[];
  const mias = todas.filter((a) => a.usuario_id === perfil.id);
  const altas = todas.filter((a) => a.severidad === "alta");
  const bultos = (stock ?? []).reduce((s, x) => s + (x.stock_actual ?? 0), 0);
  const demoradas = refs.filter(demorada).length;
  type Arribo = { eta: string; mbl: string | null; referencia: { id: number; codigo: string; estado: string; expediente: { cliente: { nombre_comercial: string | null; razon_social: string } | null } | null } | null };
  const proximos = ((arribos ?? []) as unknown as Arribo[]).filter((a) => a.referencia?.estado === "activa");

  return (
    <>
      <Encabezado
        etiqueta="Torre de control"
        titulo={`Hola, ${perfil.nombre.split(" ")[0]}`}
        detalle={new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" })}
        accion={puedeEscribir(perfil) ? { href: "/expedientes/nuevo", label: "+ Nuevo expediente" } : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi titulo="Expedientes activos" valor={expedientes ?? 0} icono={FolderKanban} href="/expedientes" />
        <Kpi titulo="Referencias en curso" valor={refs.length} icono={Activity} href="/referencias" />
        <Kpi titulo="Fuera de estándar" valor={demoradas} icono={AlertTriangle} tono={demoradas ? "alerta" : "neutro"} detalle="etapas que superan su tiempo" />
        <Kpi titulo="Mis tareas" valor={tareas?.length ?? 0} icono={ListChecks} tono="acento" href="/tareas" />
        <Kpi titulo="Bultos en almacén" valor={bultos.toLocaleString("es-PE")} icono={Boxes} detalle={`${stock?.length ?? 0} lotes con stock`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Seccion titulo="Flujo por tipo de referencia" icono={Activity}>
            <div className="space-y-4">
              {TIPOS_REFERENCIA.map((t) => {
                const deTipo = refs.filter((r) => r.tipo === t);
                const cols = etapas[t].filter((e) => !e.es_final);
                const max = Math.max(1, ...cols.map((e) => deTipo.filter((r) => r.etapa_id === e.id).length));
                return (
                  <Link key={t} href={`/referencias?tipo=${t}`} className="group block">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium group-hover:text-marca">
                        <IconoTipo tipo={t} /> {INFO_TIPO[t].nombre}
                      </span>
                      <span className="codigo text-tenue">{deTipo.length}</span>
                    </div>
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                      {cols.map((e) => {
                        const n = deTipo.filter((r) => r.etapa_id === e.id).length;
                        const tarde = deTipo.some((r) => r.etapa_id === e.id && demorada(r));
                        return (
                          <div key={e.id} title={`${e.nombre}: ${n}`} className="min-w-0">
                            <div className="relative h-8 overflow-hidden rounded-sm border border-borde bg-fondo">
                              <div
                                className={`absolute inset-x-0 bottom-0 ${tarde ? "bg-aviso/70" : "bg-marca/70"}`}
                                style={{ height: `${(n / max) * 100}%` }}
                              />
                              <span className="codigo absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-texto">
                                {n || ""}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[9px] text-slate-400">{e.nombre}</p>
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Seccion>

          <Seccion titulo="Lo que me toca hoy" icono={ListChecks}>
            <div className="space-y-3">
              <ListaTareas tareas={(tareas ?? []) as unknown as Tarea[]} puedeEscribir={puedeEscribir(perfil)} contexto />
              {mias.length > 0 && <ListaAlertas alertas={mias} />}
            </div>
          </Seccion>
        </div>

        <aside className="min-w-0 space-y-4">
          <Seccion titulo={`Alertas (${todas.length})`} icono={AlertTriangle} extra={altas.length ? <span className="codigo text-xs text-alerta">{altas.length} urgentes</span> : null}>
            {todas.length ? <ListaAlertas alertas={todas.slice(0, 25)} /> : <Vacio>Sin alertas. Todo en tiempo.</Vacio>}
          </Seccion>
          <Seccion titulo="Arribos próximos 7 días" icono={Ship}>
            {proximos.length === 0 ? (
              <Vacio>Sin arribos programados.</Vacio>
            ) : (
              <ul className="space-y-2 text-sm">
                {proximos.map((a) => (
                  <li key={a.referencia!.id}>
                    <Link href={`/referencias/${a.referencia!.id}`} className="flex items-center justify-between gap-2 hover:text-marca">
                      <span className="min-w-0">
                        <span className="codigo">{a.referencia!.codigo}</span>
                        <span className="block truncate text-xs text-tenue">
                          {a.referencia!.expediente?.cliente?.nombre_comercial ?? a.referencia!.expediente?.cliente?.razon_social}
                        </span>
                      </span>
                      <span className="codigo text-xs text-marca">{fecha(a.eta)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </aside>
      </div>
    </>
  );
}

function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  return (
    <ul className="space-y-1.5">
      {alertas.map((a, i) => (
        <li key={i}>
          <Link
            href={a.enlace}
            className={`flex items-start gap-2 rounded-md border-l-2 bg-panel-2 px-3 py-2 text-xs hover:bg-marca-claro ${
              a.severidad === "alta" ? "border-alerta" : "border-aviso"
            }`}
          >
            <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${a.severidad === "alta" ? "text-alerta" : "text-aviso"}`} />
            <span className="text-slate-700">{a.mensaje}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
