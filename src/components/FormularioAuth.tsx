"use client";

import { useActionState } from "react";
import type { EstadoForm } from "@/app/login/actions";

type Campo = { name: string; label: string; type: string; autoComplete?: string };

export function FormularioAuth({
  accion,
  campos,
  textoBoton,
}: {
  accion: (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  campos: Campo[];
  textoBoton: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar} className="space-y-4">
      {campos.map((c) => (
        <div key={c.name}>
          <label className="etiqueta" htmlFor={c.name}>
            {c.label}
          </label>
          <input id={c.name} name={c.name} type={c.type} autoComplete={c.autoComplete} required className="campo" />
        </div>
      ))}
      {estado.error && <p className="text-sm text-alerta">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-marca">{estado.ok}</p>}
      <button type="submit" disabled={pendiente} className="boton w-full">
        {pendiente ? "Procesando…" : textoBoton}
      </button>
    </form>
  );
}
