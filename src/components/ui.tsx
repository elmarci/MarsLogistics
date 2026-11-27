import Link from "next/link";
import { Plane, ShieldCheck, Ship, Truck, Warehouse, type LucideIcon } from "lucide-react";
import { INFO_TIPO, type TipoReferencia } from "@/lib/tipos";

export function Encabezado({
  titulo,
  detalle,
  etiqueta,
  accion,
  children,
}: {
  titulo: React.ReactNode;
  detalle?: React.ReactNode;
  etiqueta?: string;
  accion?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-borde pb-4">
      <div className="min-w-0">
        {etiqueta && <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-marca uppercase">{etiqueta}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {detalle && <div className="mt-1 text-sm text-tenue">{detalle}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {accion && (
          <Link href={accion.href} className="boton">
            {accion.label}
          </Link>
        )}
      </div>
    </div>
  );
}

type Opcion = { value: string | number; label: string };

export function Campo({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  placeholder,
  step,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string | number;
}) {
  return (
    <div>
      <label htmlFor={name} className="etiqueta">
        {label}
        {required && <span className="text-marca"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        min={min}
        defaultValue={defaultValue ?? undefined}
        required={required}
        placeholder={placeholder}
        className="campo"
      />
    </div>
  );
}

export function Selector({
  name,
  label,
  opciones,
  defaultValue,
  required,
  vacio = "—",
}: {
  name: string;
  label: string;
  opciones: Opcion[];
  defaultValue?: string | number | null;
  required?: boolean;
  vacio?: string | false;
}) {
  return (
    <div>
      <label htmlFor={name} className="etiqueta">
        {label}
        {required && <span className="text-marca"> *</span>}
      </label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} required={required} className="campo">
        {vacio !== false && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AreaTexto({
  name,
  label,
  defaultValue,
  placeholder,
  filas = 3,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  filas?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="etiqueta">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={filas}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="campo"
      />
    </div>
  );
}

export function Casilla({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-marca" />
      {label}
    </label>
  );
}

export function Rejilla({ children, columnas = 3 }: { children: React.ReactNode; columnas?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columnas];
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>;
}

// Tabla en escritorio; en celular cada fila se muestra como tarjeta.
export function Tabla<T>({
  filas,
  columnas,
  vacio = "No hay registros.",
  claveFila,
  enlace,
}: {
  filas: T[];
  columnas: { titulo: string; valor: (f: T) => React.ReactNode }[];
  vacio?: string;
  claveFila: (f: T) => string | number;
  enlace?: (f: T) => string;
}) {
  if (filas.length === 0) return <Vacio>{vacio}</Vacio>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-borde bg-panel md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borde text-[11px] tracking-wider text-tenue uppercase">
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} className="px-4 py-2.5 font-medium">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={claveFila(f)} className="border-t border-borde/60 transition hover:bg-panel-2">
                {columnas.map((c, i) => (
                  <td key={c.titulo} className="px-4 py-2.5">
                    {i === 0 && enlace ? (
                      <Link href={enlace(f)} className="font-medium text-marca hover:underline">
                        {c.valor(f)}
                      </Link>
                    ) : (
                      c.valor(f)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {filas.map((f) => {
          const contenido = (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {columnas.map((c) => (
                <div key={c.titulo} className="contents">
                  <dt className="text-tenue">{c.titulo}</dt>
                  <dd>{c.valor(f)}</dd>
                </div>
              ))}
            </dl>
          );
          return enlace ? (
            <Link key={claveFila(f)} href={enlace(f)} className="tarjeta block">
              {contenido}
            </Link>
          ) : (
            <div key={claveFila(f)} className="tarjeta">
              {contenido}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-borde-fuerte p-4 text-sm text-tenue">{children}</p>;
}

export type Tono = "neutro" | "acento" | "alerta" | "aviso" | "apagado";
const TONOS: Record<Tono, string> = {
  neutro: "border-borde-fuerte text-slate-700",
  acento: "border-marca/50 bg-marca-claro text-marca",
  alerta: "border-alerta/50 bg-alerta/10 text-alerta",
  aviso: "border-aviso/50 bg-aviso/10 text-aviso",
  apagado: "border-borde text-slate-400",
};

export function Insignia({ tono = "neutro", children }: { tono?: Tono; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONOS[tono]}`}>
      {children}
    </span>
  );
}

export function Dato({ titulo, valor, mono }: { titulo: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-wider text-tenue uppercase">{titulo}</dt>
      <dd className={`truncate text-sm ${mono ? "codigo" : ""}`}>{valor ?? "—"}</dd>
    </div>
  );
}

export function Kpi({
  titulo,
  valor,
  detalle,
  tono = "neutro",
  href,
  icono: Icono,
}: {
  titulo: string;
  valor: React.ReactNode;
  detalle?: string;
  tono?: "neutro" | "alerta" | "acento";
  href?: string;
  icono?: LucideIcon;
}) {
  const color = tono === "alerta" ? "text-alerta" : tono === "acento" ? "text-marca" : "text-texto";
  const contenido = (
    <>
      <div className="flex items-center justify-between text-[11px] tracking-wider text-tenue uppercase">
        {titulo}
        {Icono && <Icono className="h-4 w-4" strokeWidth={1.5} />}
      </div>
      <p className={`codigo mt-2 text-3xl font-semibold ${color}`}>{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tenue">{detalle}</p>}
    </>
  );
  const clase = "tarjeta relative overflow-hidden transition hover:border-marca/60";
  return href ? (
    <Link href={href} className={`${clase} block`}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

export const ICONO_TIPO: Record<TipoReferencia, LucideIcon> = {
  CARGA_MARITIMA: Ship,
  CARGA_AEREA: Plane,
  ADUANA: ShieldCheck,
  TRANSPORTE: Truck,
  ALMACENAJE: Warehouse,
};

export function IconoTipo({ tipo, className = "h-4 w-4" }: { tipo: TipoReferencia; className?: string }) {
  const Icono = ICONO_TIPO[tipo];
  return <Icono className={className} strokeWidth={1.6} aria-label={INFO_TIPO[tipo].nombre} />;
}

// Barra segmentada: un segmento por etapa; las cumplidas en acento, la actual con pulso.
export function BarraEtapas({
  total,
  actual,
  estado = "activa",
  demorada,
}: {
  total: number;
  actual: number;
  estado?: string;
  demorada?: boolean;
}) {
  return (
    <div className="flex h-1.5 w-full gap-0.5" aria-label={`Etapa ${actual} de ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const cerrada = estado === "cerrada";
        const clase =
          estado === "anulada"
            ? "bg-slate-300"
            : cerrada || n < actual
              ? "bg-marca"
              : n === actual
                ? demorada
                  ? "bg-aviso animate-pulse"
                  : "bg-marca/70 animate-pulse"
                : "bg-slate-200";
        return <span key={n} className={`flex-1 rounded-sm ${clase}`} />;
      })}
    </div>
  );
}

export const fecha = (v: string | null | undefined) =>
  v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("es-PE", { timeZone: "America/Lima" }) : "—";

export const fechaHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }) : "—";

export function duracion(horas: number | null | undefined) {
  if (horas === null || horas === undefined) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.round(horas)} h`;
  return `${Math.round(horas / 24)} d`;
}

// Valor para <input type="datetime-local"> en hora de Lima.
export const aInputFechaHora = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(new Date(v).getTime() - 5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
};

export const dinero = (monto: number | null | undefined, moneda = "USD") =>
  monto === null || monto === undefined
    ? "—"
    : `${moneda === "PEN" ? "S/" : "US$"} ${Number(monto).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
