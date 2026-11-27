import { FormularioAuth } from "@/components/FormularioAuth";
import { PantallaAuth } from "@/components/PantallaAuth";
import { definirClave } from "@/app/login/actions";

export const metadata = { title: "Crear contraseña" };

export default function DefinirClavePage() {
  return (
    <PantallaAuth titulo="Crea tu contraseña">
      <FormularioAuth
        accion={definirClave}
        textoBoton="Guardar y entrar"
        campos={[
          { name: "password", label: "Nueva contraseña", type: "password", autoComplete: "new-password" },
          { name: "confirmacion", label: "Repite la contraseña", type: "password", autoComplete: "new-password" },
        ]}
      />
    </PantallaAuth>
  );
}
