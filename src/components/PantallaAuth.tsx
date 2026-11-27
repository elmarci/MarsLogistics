export function PantallaAuth({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-marca text-lg font-bold text-white">
            ML
          </div>
          <h1 className="text-xl font-semibold">{titulo}</h1>
        </div>
        <div className="tarjeta">{children}</div>
      </div>
    </main>
  );
}
