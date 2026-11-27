import { crearClienteServidor } from "@/lib/supabase/server";

// Listas para los selectores de los formularios.
export async function catalogos() {
  const supabase = await crearClienteServidor();
  const [clientes, sedes, productos, proveedores, almacenes, conceptos, tipos] = await Promise.all([
    supabase.from("cliente").select("id, razon_social").eq("activo", true).order("razon_social"),
    supabase.from("sede_cliente").select("id, nombre, cliente_id").eq("activo", true).order("nombre"),
    supabase.from("producto").select("id, descripcion").eq("activo", true).order("descripcion"),
    supabase.from("proveedor").select("id, razon_social, nombre_corto, tipo").eq("activo", true).order("razon_social"),
    supabase.from("almacen").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("concepto").select("id, nombre, tipo").eq("activo", true).order("nombre"),
    supabase.from("tipo_documento").select("codigo, nombre").order("nombre"),
  ]);
  const provs = proveedores.data ?? [];
  const deTipo = (tipo: string) =>
    provs.filter((p) => p.tipo === tipo).map((p) => ({ value: p.id, label: p.nombre_corto ?? p.razon_social }));
  const nombreCliente = new Map((clientes.data ?? []).map((c) => [c.id, c.razon_social]));

  return {
    clientes: (clientes.data ?? []).map((c) => ({ value: c.id, label: c.razon_social })),
    sedes: (sedes.data ?? []).map((s) => ({ value: s.id, label: `${s.nombre} (${nombreCliente.get(s.cliente_id) ?? "—"})` })),
    productos: (productos.data ?? []).map((p) => ({ value: p.id, label: p.descripcion })),
    navieras: deTipo("naviera"),
    terminales: deTipo("terminal"),
    agentes: deTipo("agente_aduanas"),
    transportesLocales: deTipo("transporte_local"),
    depositosVacios: deTipo("deposito_vacios"),
    proveedores: provs.map((p) => ({ value: p.id, label: p.nombre_corto ?? p.razon_social, tipo: p.tipo as string })),
    almacenes: (almacenes.data ?? []).map((a) => ({ value: a.id, label: a.nombre })),
    conceptos: (conceptos.data ?? []).map((c) => ({ value: c.id, label: c.nombre, tipo: c.tipo as string })),
    tiposDocumento: (tipos.data ?? []) as { codigo: string; nombre: string }[],
  };
}
