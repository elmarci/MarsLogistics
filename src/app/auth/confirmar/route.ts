import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Destino de los correos de invitación y recuperación (plantillas de Supabase con token_hash).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const destino = type === "invite" || type === "recovery" ? "/auth/definir-clave" : "/";
      return NextResponse.redirect(new URL(destino, request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?error=enlace", request.url));
}
