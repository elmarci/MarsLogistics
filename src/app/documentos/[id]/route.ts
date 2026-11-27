import { NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

// Descarga de un documento. Primero se lee la fila con la sesión del usuario (RLS decide si
// puede verla: interno, o cliente con documento validado y visible); solo entonces se firma
// una URL temporal del archivo.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const { data: doc } = await supabase.from("documento").select("ruta_storage, nombre_archivo").eq("id", Number(id)).maybeSingle();
  if (!doc) return new NextResponse("Documento no encontrado", { status: 404 });
  const { data, error } = await crearClienteAdmin()
    .storage.from("documentos")
    .createSignedUrl(doc.ruta_storage, 120, { download: doc.nombre_archivo });
  if (error || !data) return new NextResponse("No se pudo generar la descarga", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
