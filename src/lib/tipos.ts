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

export const TIPOS_REFERENCIA = ["CARGA_MARITIMA", "CARGA_AEREA", "ADUANA", "TRANSPORTE", "ALMACENAJE"] as const;
export type TipoReferencia = (typeof TIPOS_REFERENCIA)[number];

export const INFO_TIPO: Record<TipoReferencia, { prefijo: string; nombre: string; corto: string }> = {
  CARGA_MARITIMA: { prefijo: "SEA", nombre: "Carga marítima", corto: "Carga" },
  CARGA_AEREA: { prefijo: "AIR", nombre: "Carga aérea", corto: "Aérea" },
  ADUANA: { prefijo: "ADU", nombre: "Aduana", corto: "Aduana" },
  TRANSPORTE: { prefijo: "TRA", nombre: "Transporte", corto: "Transporte" },
  ALMACENAJE: { prefijo: "ALM", nombre: "Almacenaje", corto: "Almacén" },
};

export type EstadoExpediente = "abierto" | "en_curso" | "cerrado" | "anulado";
export const ETIQUETA_ESTADO_EXPEDIENTE: Record<EstadoExpediente, string> = {
  abierto: "Abierto",
  en_curso: "En curso",
  cerrado: "Cerrado",
  anulado: "Anulado",
};

export type EstadoReferencia = "activa" | "cerrada" | "anulada";

export type Etapa = {
  id: number;
  tipo: TipoReferencia;
  orden: number;
  codigo: string;
  nombre: string;
  horas_estandar: number | null;
  es_final: boolean;
};

export type EstadoDocumento = "pendiente" | "validado" | "observado" | "rechazado";
export const ETIQUETA_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  pendiente: "Por validar",
  validado: "Validado",
  observado: "Observado",
  rechazado: "Rechazado",
};

export type EstadoPago = "solicitada" | "aprobada" | "rechazada" | "pagada";
export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  solicitada: "Por aprobar",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  pagada: "Pagada",
};

export const TIPOS_SERVICIO_TRANSPORTE = {
  RETIRO_PUERTO: "Retiro de puerto",
  TRASLADO_ALMACEN: "Traslado a almacén",
  DISTRIBUCION: "Distribución a destino",
  DEVOLUCION_VACIO: "Devolución de vacío",
  OTRO: "Otro",
} as const;

export const TIPOS_PROVEEDOR = [
  "naviera",
  "aerolinea",
  "agente_carga",
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
  aerolinea: "Aerolínea",
  agente_carga: "Agente de carga",
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
