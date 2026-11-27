import Link from "next/link";
import { FormularioAuth } from "@/components/FormularioAuth";
import { PantallaAuth } from "@/components/PantallaAuth";
import { solicitarRecuperacion } from "@/app/login/actions";

export const metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <PantallaAuth titulo="Recuperar contraseña">
      <FormularioAuth
        accion={solicitarRecuperacion}
        textoBoton="Enviar enlace"
        campos={[{ name: "email", label: "Correo", type: "email", autoComplete: "email" }]}
      />
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-marca hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </PantallaAuth>
  );
}
