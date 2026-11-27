import { ESTADOS_ORDEN, ETIQUETA_ESTADO, type EstadoOrden } from "@/lib/tipos";

const ETAPAS = ESTADOS_ORDEN.filter((e) => e !== "anulada");

// Muestra en qué etapa va la orden. Se usa en la vista interna y en el portal de clientes.
export function LineaEtapas({ estado }: { estado: EstadoOrden }) {
  if (estado === "anulada") return <p className="text-sm font-medium text-red-700">Orden anulada</p>;
  const actual = ETAPAS.indexOf(estado);
  return (
    <ol className="flex flex-wrap gap-1 text-xs">
      {ETAPAS.map((e, i) => (
        <li
          key={e}
          className={`rounded px-2 py-1 ${
            i < actual ? "bg-marca-claro text-marca" : i === actual ? "bg-marca font-medium text-white" : "bg-slate-100 text-slate-400"
          }`}
        >
          {ETIQUETA_ESTADO[e]}
        </li>
      ))}
    </ol>
  );
}
