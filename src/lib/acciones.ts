import { z } from "zod";

export type ResultadoAccion = { error?: string; ok?: string };

// Convierte FormData en objeto: "" pasa a null y las casillas marcadas a true.
export function leerFormulario(formData: FormData): Record<string, unknown> {
  const datos: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("$ACTION")) continue;
    const texto = typeof v === "string" ? v.trim() : v;
    datos[k] = texto === "" ? null : texto === "on" ? true : texto;
  }
  return datos;
}

export function validar<T extends z.ZodTypeAny>(
  esquema: T,
  formData: FormData,
): { datos: z.infer<T>; error: null } | { datos: null; error: string } {
  const r = esquema.safeParse(leerFormulario(formData));
  if (!r.success) {
    const p = r.error.issues[0];
    return { datos: null, error: `Revisa el campo "${p.path.join(".")}": ${p.message}` };
  }
  return { datos: r.data, error: null };
}

export function mensajeError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Ya existe un registro con ese código o RUC.";
  if (error.code === "42501") return "No tienes permiso para esta acción.";
  if (error.code === "23503") return "El registro está relacionado con otros datos y no se puede eliminar.";
  return `No se pudo guardar: ${error.message}`;
}

// Esquemas reutilizables
export const texto = z.string().nullable().optional();
export const textoRequerido = z.string({ required_error: "es obligatorio" }).min(1, "es obligatorio");
// Ojo: z.coerce convierte null en 0, por eso los vacíos se tratan antes.
const vacioANull = (v: unknown) => (v === null || v === undefined || v === "" ? null : v);
export const numero = z.preprocess(vacioANull, z.coerce.number({ invalid_type_error: "debe ser un número" }).nullable());
export const entero = z.preprocess(vacioANull, z.coerce.number().int("debe ser entero").nullable());
export const id = z.preprocess(vacioANull, z.coerce.number().int().positive().nullable());
export const idRequerido = z.coerce.number({ invalid_type_error: "es obligatorio" }).int().positive("es obligatorio");
export const casilla = z.preprocess((v) => v === true, z.boolean());
