import Link from "next/link";
import { Encabezado, Tabla } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_TIPO_PROVEEDOR, TIPOS_PROVEEDOR } from "@/lib/tipos";
import { ETIQUETA_HOMOLOGACION } from "./CamposProveedor";

export const metadata = { title: "Proveedores" };

type Fila = {
  id: number;
  razon_social: string;
  nombre_corto: string | null;
  tipo: (typeof TIPOS_PROVEEDOR)[number];
  estado_homologacion: string;
  activo: boolean;
};

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("proveedor")
    .select("id, razon_social, nombre_corto, tipo, estado_homologacion, activo")
    .order("razon_social");
  if (tipo) consulta = consulta.eq("tipo", tipo);
  const { data } = await consulta;

  return (
    <>
      <Encabezado
        titulo="Proveedores"
        detalle="Navieras, agentes, almacenes, transportistas y demás prestadores."
        accion={puedeEscribir(perfil) ? { href: "/proveedores/nuevo", label: "Nuevo proveedor" } : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/proveedores" className={!tipo ? "font-medium text-marca" : "text-slate-600"}>
          Todos
        </Link>
        {TIPOS_PROVEEDOR.map((t) => (
          <Link key={t} href={`/proveedores?tipo=${t}`} className={tipo === t ? "font-medium text-marca" : "text-slate-600"}>
            {ETIQUETA_TIPO_PROVEEDOR[t]}
          </Link>
        ))}
      </div>
      <Tabla
        filas={(data ?? []) as Fila[]}
        claveFila={(f) => f.id}
        enlace={(f) => `/proveedores/${f.id}`}
        columnas={[
          { titulo: "Proveedor", valor: (f) => f.nombre_corto ?? f.razon_social },
          { titulo: "Razón social", valor: (f) => f.razon_social },
          { titulo: "Tipo", valor: (f) => ETIQUETA_TIPO_PROVEEDOR[f.tipo] },
          { titulo: "Homologación", valor: (f) => ETIQUETA_HOMOLOGACION[f.estado_homologacion] },
          { titulo: "Estado", valor: (f) => (f.activo ? "Activo" : "Inactivo") },
        ]}
      />
    </>
  );
}
