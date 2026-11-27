import { PantallaAuth } from "@/components/PantallaAuth";
import { cerrarSesion } from "@/app/login/actions";

export const metadata = { title: "Cuenta pendiente" };

export default function PendientePage() {
  return (
    <PantallaAuth titulo="Cuenta pendiente de habilitación">
      <p className="text-sm text-slate-600">
        Tu cuenta existe pero aún no tiene acceso. Pide a un administrador que la habilite.
      </p>
      <form action={cerrarSesion} className="mt-4">
        <button className="boton-secundario w-full">Cerrar sesión</button>
      </form>
    </PantallaAuth>
  );
}
