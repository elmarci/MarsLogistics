import { Logo } from "@/components/Logo";

export function PantallaAuth({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo grande />
          <h1 className="text-lg font-medium text-slate-700">{titulo}</h1>
        </div>
        <div className="tarjeta">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-500">Control logístico · Callao</p>
      </div>
    </main>
  );
}
