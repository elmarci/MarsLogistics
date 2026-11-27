import { Campo, Rejilla } from "@/components/ui";

type Cliente = {
  ruc?: string | null;
  razon_social?: string | null;
  nombre_comercial?: string | null;
  grupo?: string | null;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
};

export function CamposCliente({ c = {} }: { c?: Cliente }) {
  return (
    <Rejilla>
      <Campo name="razon_social" label="Razón social" defaultValue={c.razon_social} required />
      <Campo name="ruc" label="RUC" defaultValue={c.ruc} />
      <Campo name="nombre_comercial" label="Nombre comercial" defaultValue={c.nombre_comercial} />
      <Campo name="grupo" label="Grupo empresarial" defaultValue={c.grupo} placeholder="p. ej. BUENAVENTURA" />
      <Campo name="contacto" label="Contacto" defaultValue={c.contacto} />
      <Campo name="email" label="Correo" type="email" defaultValue={c.email} />
      <Campo name="telefono" label="Teléfono" defaultValue={c.telefono} />
      <Campo name="direccion" label="Dirección" defaultValue={c.direccion} />
    </Rejilla>
  );
}
