// Marca: un rumbo (flecha de avance) dentro de un cuadro de radar.
export function Logo({ grande = false }: { grande?: boolean }) {
  const t = grande ? "h-11 w-11" : "h-8 w-8";
  return (
    <span className="flex items-center gap-2.5">
      <span className={`relative flex ${t} items-center justify-center rounded-md border border-marca/60 bg-marca-claro`}>
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] text-marca" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 17 L12 5 L20 17" strokeLinejoin="round" />
          <path d="M8 17 L12 11 L16 17" strokeLinejoin="round" opacity="0.55" />
        </svg>
        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-marca shadow-[0_0_8px_#22d3ee]" />
      </span>
      <span className={`codigo leading-none font-semibold tracking-tight ${grande ? "text-xl" : "text-sm"}`}>
        MARS<span className="text-marca">//</span>LOGISTICS
      </span>
    </span>
  );
}
