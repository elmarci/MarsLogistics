"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ResultadoAccion } from "@/lib/acciones";

export function Formulario({
  accion,
  children,
  textoBoton = "Guardar",
  className = "",
  soloLectura = false,
  limpiar = false,
  boton = "boton",
}: {
  accion: (estado: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>;
  children: React.ReactNode;
  textoBoton?: string;
  className?: string;
  soloLectura?: boolean;
  limpiar?: boolean; // vacía el formulario después de guardar (comentarios, tareas, altas rápidas)
  boton?: "boton" | "boton-secundario" | "boton-mini";
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (limpiar && estado.ok) ref.current?.reset();
  }, [estado, limpiar]);
  return (
    <form ref={ref} action={enviar} className={`space-y-4 ${className}`}>
      <fieldset disabled={soloLectura} className="space-y-4">
        {children}
      </fieldset>
      {estado.error && <p className="text-sm text-alerta">{estado.error}</p>}
      {estado.ok && <p className="text-sm text-marca">{estado.ok}</p>}
      {!soloLectura && (
        <button type="submit" disabled={pendiente} className={boton}>
          {pendiente ? "Guardando…" : textoBoton}
        </button>
      )}
    </form>
  );
}

// Un botón que ejecuta una acción del servidor (cambiar etapa, validar, aprobar...).
export function BotonAccion({
  accion,
  children,
  clase = "boton-mini",
  confirmar,
  titulo,
}: {
  accion: (estado: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>;
  children: React.ReactNode;
  clase?: string;
  confirmar?: string;
  titulo?: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form
      action={enviar}
      className="inline"
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      <button type="submit" disabled={pendiente} className={clase} title={estado.error ?? titulo}>
        {pendiente ? "…" : children}
      </button>
      {estado.error && <span className="ml-2 text-xs text-alerta">{estado.error}</span>}
    </form>
  );
}
