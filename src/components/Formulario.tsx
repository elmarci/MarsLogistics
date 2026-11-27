"use client";

import { useActionState } from "react";
import type { ResultadoAccion } from "@/lib/acciones";

export function Formulario({
  accion,
  children,
  textoBoton = "Guardar",
  className = "",
  soloLectura = false,
}: {
  accion: (estado: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>;
  children: React.ReactNode;
  textoBoton?: string;
  className?: string;
  soloLectura?: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar} className={`space-y-4 ${className}`}>
      <fieldset disabled={soloLectura} className="space-y-4">
        {children}
      </fieldset>
      {estado.error && <p className="text-sm text-red-600">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-green-700">{estado.ok}</p>}
      {!soloLectura && (
        <button type="submit" disabled={pendiente} className="boton">
          {pendiente ? "Guardando…" : textoBoton}
        </button>
      )}
    </form>
  );
}
