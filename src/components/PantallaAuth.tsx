import { Logo } from "@/components/Logo";

export function PantallaAuth({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo grande />
          <h1 className="text-lg font-medium text-slate-700">{titulo}</h1>
        </div>
        <div className="tarjeta shadow-[0_0_60px_-20px_rgb(34_211_238/0.35)]">{children}</div>
        <p className="codigo mt-6 text-center text-[10px] tracking-[0.3em] text-slate-400 uppercase">Control logístico · Callao</p>
      </div>
    </main>
  );
}
