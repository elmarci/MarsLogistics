import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cerrarSesion } from "@/app/login/actions";
import { exigirCliente } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const perfil = await exigirCliente();
  const supabase = await crearClienteServidor();
  const { data: cliente } = await supabase.from("cliente").select("razon_social").eq("id", perfil.cliente_id!).single();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-borde bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <a href="/portal" className="flex items-center gap-3">
            <Logo />
            <span className="hidden border-l border-borde pl-3 text-xs text-tenue sm:block">{cliente?.razon_social}</span>
          </a>
          <form action={cerrarSesion} className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{perfil.nombre}</span>
            <button className="rounded p-2 text-tenue hover:text-marca" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  );
}
