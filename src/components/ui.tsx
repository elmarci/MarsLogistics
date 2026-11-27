import Link from "next/link";

export function Encabezado({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        {detalle && <p className="text-sm text-slate-500">{detalle}</p>}
      </div>
      {accion && (
        <Link href={accion.href} className="boton">
          {accion.label}
        </Link>
      )}
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
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="etiqueta">
        {label}
        {required && " *"}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
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
        {required && " *"}
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

export function AreaTexto({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <div>
      <label htmlFor={name} className="etiqueta">
        {label}
      </label>
      <textarea id={name} name={name} rows={3} defaultValue={defaultValue ?? undefined} className="campo" />
    </div>
  );
}

export function Casilla({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

export function Rejilla({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
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
  if (filas.length === 0) return <p className="tarjeta text-sm text-slate-500">{vacio}</p>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} className="px-4 py-2 font-medium">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={claveFila(f)} className="border-t border-slate-100 hover:bg-slate-50">
                {columnas.map((c, i) => (
                  <td key={c.titulo} className="px-4 py-2">
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
                  <dt className="text-slate-500">{c.titulo}</dt>
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

const COLORES_ESTADO: Record<string, string> = {
  abierta: "bg-slate-100 text-slate-700",
  en_transito: "bg-sky-100 text-sky-800",
  en_aduana: "bg-amber-100 text-amber-800",
  en_puerto: "bg-indigo-100 text-indigo-800",
  en_almacen: "bg-violet-100 text-violet-800",
  en_despacho: "bg-teal-100 text-teal-800",
  liquidacion: "bg-orange-100 text-orange-800",
  cerrada: "bg-green-100 text-green-800",
  anulada: "bg-red-100 text-red-700",
};

export function Insignia({ valor, texto }: { valor: string; texto: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLORES_ESTADO[valor] ?? "bg-slate-100"}`}>
      {texto}
    </span>
  );
}

export function Dato({ titulo, valor }: { titulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{titulo}</dt>
      <dd className="text-sm">{valor ?? "—"}</dd>
    </div>
  );
}

export const fecha = (v: string | null | undefined) =>
  v ? new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("es-PE", { timeZone: "America/Lima" }) : "—";

export const fechaHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }) : "—";

// Valor para <input type="datetime-local"> en hora de Lima.
export const aInputFechaHora = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(new Date(v).getTime() - 5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
};
