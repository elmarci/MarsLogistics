import { cerrarSesion } from "@/app/login/actions";
import { exigirCliente } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const perfil = await exigirCliente();
  const supabase = await crearClienteServidor();
  const { data: cliente } = await supabase.from("cliente").select("razon_social").eq("id", perfil.cliente_id!).single();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="font-semibold text-marca">MarsLogistics</p>
            <p className="text-xs text-slate-500">{cliente?.razon_social}</p>
          </div>
          <form action={cerrarSesion} className="text-sm">
            <span className="mr-3 text-slate-600">{perfil.nombre}</span>
            <button className="text-marca hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 md:p-8">{children}</main>
    </div>
  );
}
