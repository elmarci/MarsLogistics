import { Encabezado, Tabla } from "@/components/ui";
import { exigirInterno, puedeEscribir } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Clientes" };

type Fila = { id: number; razon_social: string; ruc: string | null; grupo: string | null; activo: boolean; sede_cliente: { count: number }[] };

export default async function ClientesPage() {
  const perfil = await exigirInterno();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("cliente")
    .select("id, razon_social, ruc, grupo, activo, sede_cliente(count)")
    .order("razon_social");

  return (
    <>
      <Encabezado
        titulo="Clientes"
        detalle="Empresas a las que se presta el servicio y sus puntos de entrega."
        accion={puedeEscribir(perfil) ? { href: "/clientes/nuevo", label: "Nuevo cliente" } : undefined}
      />
      <Tabla
        filas={(data ?? []) as Fila[]}
        claveFila={(f) => f.id}
        enlace={(f) => `/clientes/${f.id}`}
        columnas={[
          { titulo: "Razón social", valor: (f) => f.razon_social },
          { titulo: "RUC", valor: (f) => f.ruc ?? "—" },
          { titulo: "Grupo", valor: (f) => f.grupo ?? "—" },
          { titulo: "Sedes", valor: (f) => f.sede_cliente[0]?.count ?? 0 },
          { titulo: "Estado", valor: (f) => (f.activo ? "Activo" : "Inactivo") },
        ]}
      />
    </>
  );
}
