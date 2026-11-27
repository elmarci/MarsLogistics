export type Rol =
  | "admin"
  | "operaciones"
  | "aduanas"
  | "almacen"
  | "transporte"
  | "finanzas"
  | "consulta"
  | "cliente";

export type Perfil = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  cliente_id: number | null;
  activo: boolean;
};

export const ESTADOS_ORDEN = [
  "abierta",
  "en_transito",
  "en_aduana",
  "en_puerto",
  "en_almacen",
  "en_despacho",
  "liquidacion",
  "cerrada",
  "anulada",
] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  abierta: "Abierta",
  en_transito: "En tránsito",
  en_aduana: "En aduana",
  en_puerto: "En puerto",
  en_almacen: "En almacén",
  en_despacho: "En despacho",
  liquidacion: "Liquidación",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const TIPOS_PROVEEDOR = [
  "naviera",
  "agente_aduanas",
  "almacen",
  "terminal",
  "deposito_vacios",
  "transporte_local",
  "transporte_destino",
  "otro",
] as const;

export const ETIQUETA_TIPO_PROVEEDOR: Record<(typeof TIPOS_PROVEEDOR)[number], string> = {
  naviera: "Naviera",
  agente_aduanas: "Agente de aduanas",
  almacen: "Almacén",
  terminal: "Terminal portuario",
  deposito_vacios: "Depósito de vacíos",
  transporte_local: "Transporte local",
  transporte_destino: "Transporte a destino",
  otro: "Otro",
};

export const ROLES_INTERNOS: Rol[] = [
  "admin",
  "operaciones",
  "aduanas",
  "almacen",
  "transporte",
  "finanzas",
  "consulta",
];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  operaciones: "Operaciones",
  aduanas: "Aduanas",
  almacen: "Almacén",
  transporte: "Transporte",
  finanzas: "Finanzas",
  consulta: "Solo consulta",
  cliente: "Cliente (portal)",
};
