import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con service role: salta RLS. Usar solo en el servidor, para invitar usuarios
// y firmar descargas, siempre después de verificar permisos con el cliente de sesión.
export function crearClienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
