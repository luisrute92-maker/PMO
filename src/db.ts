import Dexie, { type Table } from 'dexie';
import type {
  Ajustes,
  ChecklistItem,
  Cobro,
  CosteAdicional,
  Incidencia,
  Marca,
  Oferta,
  Pago,
  Partida,
  PedidoMarca,
  Producto,
  Proyecto,
} from './types';

export class FfeDB extends Dexie {
  ajustes!: Table<Ajustes, string>;
  marcas!: Table<Marca, number>;
  productos!: Table<Producto, number>;
  proyectos!: Table<Proyecto, number>;
  partidas!: Table<Partida, number>;
  costes!: Table<CosteAdicional, number>;
  ofertas!: Table<Oferta, number>;
  pedidos!: Table<PedidoMarca, number>;
  cobros!: Table<Cobro, number>;
  pagos!: Table<Pago, number>;
  checklist!: Table<ChecklistItem, number>;
  incidencias!: Table<Incidencia, number>;

  constructor() {
    super('ffe-pmo');
    this.version(1).stores({
      ajustes: 'id',
      marcas: '++id, nombre',
      productos: '++id, marcaId, referencia, categoria',
      proyectos: '++id, codigo, faseActual',
      partidas: '++id, proyectoId, marcaId, productoId',
      costes: '++id, proyectoId, partidaId',
      ofertas: '++id, proyectoId, estado',
      pedidos: '++id, proyectoId, marcaId, estado',
      cobros: '++id, proyectoId',
      pagos: '++id, proyectoId, marcaId, pedidoId',
      checklist: '++id, proyectoId',
      incidencias: '++id, proyectoId, estado',
    });
  }
}

export const db = new FfeDB();

export const TABLAS = [
  'ajustes',
  'marcas',
  'productos',
  'proyectos',
  'partidas',
  'costes',
  'ofertas',
  'pedidos',
  'cobros',
  'pagos',
  'checklist',
  'incidencias',
] as const;

export const TABLAS_PROYECTO = [
  'partidas',
  'costes',
  'ofertas',
  'pedidos',
  'cobros',
  'pagos',
  'checklist',
  'incidencias',
] as const;

export const AJUSTES_DEFECTO: Ajustes = {
  id: 'main',
  ivaDefecto: 21,
  diasAviso: 7,
  empresaNombre: '',
  empresaDatos: '',
  validezDias: 30,
  condicionesOferta:
    'Plazo de entrega: según plazo de fabricación de cada marca, a contar desde la aprobación de muestras y recepción del anticipo.\n' +
    'Forma de pago: 40% a la aceptación, 50% antes de expedición, 10% a la entrega.\n' +
    'Portes: incluidos hasta obra salvo indicación contraria. Descarga a pie de camión.\n' +
    'Precios sin IVA salvo indicación expresa.',
  condicionesPedido:
    'Rogamos confirmación del pedido indicando fecha de entrega.\n' +
    'Indicar referencia de pedido en albarán y factura.',
  checklistPlantilla: [
    'Recepción y verificación de mercancía en obra',
    'Revisión de cantidades contra pedido',
    'Revisión de acabados contra muestras aprobadas',
    'Montaje e instalación completados',
    'Limpieza y retirada de embalajes',
    'Revisión final con el cliente / interiorista',
    'Entrega de fichas técnicas y certificados (ignifugación)',
    'Instrucciones de mantenimiento y garantías entregadas',
    'Acta de entrega firmada',
  ].join('\n'),
  seeded: false,
};

export async function getAjustes(): Promise<Ajustes> {
  const a = await db.ajustes.get('main');
  return { ...AJUSTES_DEFECTO, ...(a ?? {}) };
}

/** Borra un proyecto y todos sus registros dependientes */
export async function borrarProyecto(id: number) {
  await db.transaction('rw', [db.proyectos, ...TABLAS_PROYECTO.map((t) => db[t])], async () => {
    for (const t of TABLAS_PROYECTO) {
      await (db[t] as Table<any, number>).where('proyectoId').equals(id).delete();
    }
    await db.proyectos.delete(id);
  });
}
