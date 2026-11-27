// Marca: rumbo de avance sobre un cuadro azul.
export function Logo({ grande = false, claro = false }: { grande?: boolean; claro?: boolean }) {
  const t = grande ? "h-10 w-10" : "h-8 w-8";
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex ${t} items-center justify-center rounded-md bg-marca`}>
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] text-white" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 17 L12 5 L20 17" strokeLinejoin="round" />
          <path d="M8 17 L12 11 L16 17" strokeLinejoin="round" opacity="0.6" />
        </svg>
      </span>
      <span className={`leading-tight font-semibold tracking-tight ${grande ? "text-xl" : "text-base"} ${claro ? "text-white" : "text-texto"}`}>
        Mars<span className={claro ? "text-blue-200" : "text-marca"}>Logistics</span>
        {grande && <span className="block text-xs font-normal text-tenue">Control logístico integral</span>}
      </span>
    </span>
  );
}
