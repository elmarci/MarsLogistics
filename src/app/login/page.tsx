import Link from "next/link";
import { FormularioAuth } from "@/components/FormularioAuth";
import { PantallaAuth } from "@/components/PantallaAuth";
import { iniciarSesion } from "./actions";

export const metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <PantallaAuth titulo="MarsLogistics">
      <FormularioAuth
        accion={iniciarSesion}
        textoBoton="Ingresar"
        campos={[
          { name: "email", label: "Correo", type: "email", autoComplete: "email" },
          { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="mt-4 text-center text-sm">
        <Link href="/auth/recuperar" className="text-marca hover:underline">
          Olvidé mi contraseña
        </Link>
      </p>
    </PantallaAuth>
  );
}
