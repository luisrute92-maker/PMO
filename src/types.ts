// ---------- Catálogo ----------
export type ReglaPrecio = 'tarifa_dto_margen' | 'neto_margen' | 'tarifa_coef';

export const REGLAS: Record<ReglaPrecio, string> = {
  tarifa_dto_margen: 'Tarifa − % dto. compra + % margen',
  neto_margen: 'Precio neto + % margen',
  tarifa_coef: 'Tarifa × coeficiente',
};

export interface Marca {
  id?: number;
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  web: string;
  condiciones: string; // condiciones comerciales
  plazoSemanas: number; // plazo de fabricación habitual
  regla: ReglaPrecio;
  dtoCompra: number; // % (reglas a y c)
  margen: number; // % markup sobre coste (reglas a y b)
  coeficiente: number; // regla c
  notas: string;
  demo?: boolean;
}

export interface OpcionAcabado {
  nombre: string;
  suplemento: number; // € sobre el precio base (misma base: tarifa o neto)
}
export interface GrupoAcabado {
  nombre: string; // p. ej. "Tapizado"
  opciones: OpcionAcabado[];
}

export interface Producto {
  id?: number;
  marcaId: number;
  referencia: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  coleccion: string;
  ancho?: number;
  fondo?: number;
  alto?: number;
  altoAsiento?: number;
  peso?: number;
  volumen?: number;
  acabados: GrupoAcabado[];
  precio: number; // tarifa o neto según la regla de la marca
  unidad: string;
  plazoSemanas?: number;
  certificaciones: string;
  exterior: boolean;
  imagen?: string; // dataURL JPEG
  fichaUrl: string;
  notas: string;
  demo?: boolean;
}

// ---------- Proyectos ----------
export type Fase =
  | 'prescripcion'
  | 'oferta'
  | 'aprobacion'
  | 'pedido'
  | 'fabricacion'
  | 'transporte'
  | 'instalacion'
  | 'entrega';

export const FASES: Fase[] = [
  'prescripcion',
  'oferta',
  'aprobacion',
  'pedido',
  'fabricacion',
  'transporte',
  'instalacion',
  'entrega',
];

export const FASE_LABEL: Record<Fase, string> = {
  prescripcion: 'Prescripción',
  oferta: 'Oferta',
  aprobacion: 'Aprobación / muestras',
  pedido: 'Pedido',
  fabricacion: 'Fabricación',
  transporte: 'Transporte',
  instalacion: 'Instalación',
  entrega: 'Entrega',
};

export interface FaseInfo {
  fase: Fase;
  inicioPrev?: string; // ISO yyyy-mm-dd
  finPrev?: string;
  inicioReal?: string;
  finReal?: string;
  notas: string;
}

export type TipoInstalacion = 'propio' | 'subcontrata' | 'marca' | 'ninguna';
export const TIPO_INSTALACION: Record<TipoInstalacion, string> = {
  ninguna: 'Sin instalación',
  propio: 'Equipo propio',
  subcontrata: 'Subcontrata',
  marca: 'La marca',
};

export interface Instalacion {
  tipo: TipoInstalacion;
  proveedor: string;
  coste: number;
  venta: number;
  notas: string;
}

export interface Proyecto {
  id?: number;
  codigo: string; // 2026-001
  nombre: string;
  cliente: string; // hotel
  cadena: string;
  ubicacion: string;
  direccionEntrega: string;
  contactoNombre: string;
  contactoEmail: string;
  contactoTelefono: string;
  interiorista: string;
  origen: 'propia' | 'recibida';
  fechaAlta: string;
  fechaApertura?: string; // apertura del hotel
  fechaEntregaObra?: string; // entrega comprometida en obra
  faseActual: Fase;
  cerrado: boolean;
  iva: number; // %
  descuento: number; // % descuento global al cliente
  fases: FaseInfo[];
  instalacion: Instalacion;
  notas: string;
  demo?: boolean;
}

export interface Partida {
  id?: number;
  proyectoId: number;
  productoId?: number; // vacío = producto a medida
  marcaId: number;
  orden: number;
  zona: string;
  referencia: string;
  nombre: string;
  descripcion: string;
  medidas: string;
  acabado: string;
  cantidad: number;
  unidad: string;
  precioBase: number; // tarifa o neto (sin suplementos)
  suplemento: number; // suplemento acabados por unidad (misma base)
  costeUnit: number;
  costeManual: boolean;
  pvpUnit: number;
  pvpManual: boolean;
  imagen?: string;
  notas: string;
  demo?: boolean;
}

export type TipoCoste = 'transporte' | 'montaje' | 'aranceles' | 'otro';
export const TIPO_COSTE: Record<TipoCoste, string> = {
  transporte: 'Transporte',
  montaje: 'Instalación / montaje',
  aranceles: 'Aranceles / aduanas',
  otro: 'Otro',
};

export interface CosteAdicional {
  id?: number;
  proyectoId: number;
  partidaId?: number; // vacío = coste de proyecto
  tipo: TipoCoste;
  descripcion: string;
  proveedor: string;
  coste: number;
  venta: number;
  visible: boolean; // true = línea visible en la oferta; false = coste interno
  demo?: boolean;
}

// ---------- Ofertas ----------
export type EstadoOferta = 'borrador' | 'enviada' | 'ganada' | 'perdida';
export const ESTADO_OFERTA: Record<EstadoOferta, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  ganada: 'Ganada',
  perdida: 'Perdida',
};

export interface Oferta {
  id?: number;
  proyectoId: number;
  version: number;
  numero: string;
  fecha: string;
  estado: EstadoOferta;
  fechaEnvio?: string;
  fechaResolucion?: string;
  notas: string;
  // Copia fija en el momento de crear la versión
  partidas: Partida[];
  costes: CosteAdicional[];
  instalacion: Instalacion;
  descuento: number;
  iva: number;
  demo?: boolean;
}

// ---------- Pedidos ----------
export type EstadoPedido =
  | 'borrador'
  | 'enviado'
  | 'confirmado'
  | 'fabricacion'
  | 'expedido'
  | 'recibido';
export const ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
  fabricacion: 'En fabricación',
  expedido: 'Expedido',
  recibido: 'Recibido',
};

export interface LineaPedido {
  partidaId?: number;
  zona: string;
  referencia: string;
  descripcion: string;
  acabado: string;
  cantidad: number;
  unidad: string;
  costeUnit: number;
  imagen?: string;
}

export interface PedidoMarca {
  id?: number;
  proyectoId: number;
  marcaId: number;
  numero: string;
  fecha: string;
  estado: EstadoPedido;
  fechaEntregaPrevista?: string;
  fechaEntregaReal?: string;
  confirmacionRef: string;
  direccionEntrega: string;
  lineas: LineaPedido[];
  notas: string;
  demo?: boolean;
}

// ---------- Cobros y pagos ----------
export interface Cobro {
  id?: number;
  proyectoId: number;
  concepto: string;
  importe: number; // IVA incluido
  fechaPrevista?: string;
  fechaCobrada?: string;
  notas: string;
  demo?: boolean;
}

export interface Pago {
  id?: number;
  proyectoId: number;
  marcaId?: number;
  proveedor: string; // si no es una marca
  pedidoId?: number;
  concepto: string;
  importe: number; // IVA incluido
  vencimiento?: string;
  fechaPagada?: string;
  notas: string;
  demo?: boolean;
}

// ---------- Entrega ----------
export interface ChecklistItem {
  id?: number;
  proyectoId: number;
  orden: number;
  texto: string;
  hecho: boolean;
  fecha?: string;
  notas: string;
  demo?: boolean;
}

export type EstadoIncidencia = 'abierta' | 'en_curso' | 'resuelta';
export const ESTADO_INCIDENCIA: Record<EstadoIncidencia, string> = {
  abierta: 'Abierta',
  en_curso: 'En curso',
  resuelta: 'Resuelta',
};

export interface Incidencia {
  id?: number;
  proyectoId: number;
  partidaId?: number;
  descripcion: string;
  responsable: string;
  estado: EstadoIncidencia;
  fechaAlta: string;
  fechaLimite?: string;
  fechaResolucion?: string;
  notas: string;
  demo?: boolean;
}

// ---------- Ajustes ----------
export interface Ajustes {
  id: 'main';
  ivaDefecto: number;
  diasAviso: number;
  empresaNombre: string;
  empresaDatos: string;
  validezDias: number;
  condicionesOferta: string;
  condicionesPedido: string;
  checklistPlantilla: string; // una línea por elemento
  seeded: boolean;
}
