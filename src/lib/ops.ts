import { db, getAjustes } from '../db';
import type { LineaPedido, Oferta, Partida, PedidoMarca, Proyecto } from '../types';
import { FASES } from '../types';
import { hoy, addDays } from './format';
import { recalcularPartida } from './calc';

export async function siguienteCodigoProyecto(): Promise<string> {
  const year = new Date().getFullYear();
  const todos = await db.proyectos.toArray();
  const n = todos
    .map((p) => p.codigo)
    .filter((c) => c?.startsWith(`${year}-`))
    .map((c) => parseInt(c.split('-')[1], 10) || 0);
  const next = (n.length ? Math.max(...n) : 0) + 1;
  return `${year}-${String(next).padStart(3, '0')}`;
}

export async function nuevoProyectoVacio(): Promise<Proyecto> {
  const aj = await getAjustes();
  return {
    codigo: await siguienteCodigoProyecto(),
    nombre: '',
    cliente: '',
    cadena: '',
    ubicacion: '',
    direccionEntrega: '',
    contactoNombre: '',
    contactoEmail: '',
    contactoTelefono: '',
    interiorista: '',
    origen: 'propia',
    fechaAlta: hoy(),
    faseActual: 'prescripcion',
    cerrado: false,
    iva: aj.ivaDefecto,
    descuento: 0,
    fases: FASES.map((f) => ({ fase: f, notas: '' })),
    instalacion: { tipo: 'ninguna', proveedor: '', coste: 0, venta: 0, notas: '' },
    notas: '',
  };
}

/** Crea el proyecto y su checklist de entrega a partir de la plantilla */
export async function crearProyecto(p: Proyecto): Promise<number> {
  const aj = await getAjustes();
  const id = await db.proyectos.add(p);
  const items = aj.checklistPlantilla
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  await db.checklist.bulkAdd(
    items.map((texto, i) => ({ proyectoId: id, orden: i, texto, hecho: false, notas: '', demo: p.demo })),
  );
  return id;
}

/** Recalcula todas las partidas no manuales de un proyecto (tras cambiar la regla de una marca) */
export async function recalcularProyecto(proyectoId: number) {
  const [partidas, marcas] = await Promise.all([
    db.partidas.where('proyectoId').equals(proyectoId).toArray(),
    db.marcas.toArray(),
  ]);
  const mm = new Map(marcas.map((m) => [m.id!, m]));
  await db.partidas.bulkPut(partidas.map((p) => recalcularPartida(p, mm.get(p.marcaId))));
}

export async function crearVersionOferta(proyectoId: number): Promise<number> {
  const proyecto = await db.proyectos.get(proyectoId);
  if (!proyecto) throw new Error('Proyecto no encontrado');
  const [partidas, costes, previas] = await Promise.all([
    db.partidas.where('proyectoId').equals(proyectoId).sortBy('orden'),
    db.costes.where('proyectoId').equals(proyectoId).toArray(),
    db.ofertas.where('proyectoId').equals(proyectoId).toArray(),
  ]);
  const version = (previas.length ? Math.max(...previas.map((o) => o.version)) : 0) + 1;
  const oferta: Oferta = {
    proyectoId,
    version,
    numero: `OF-${proyecto.codigo}-v${version}`,
    fecha: hoy(),
    estado: 'borrador',
    notas: '',
    partidas: structuredClone(partidas),
    costes: structuredClone(costes),
    instalacion: structuredClone(proyecto.instalacion),
    descuento: proyecto.descuento,
    iva: proyecto.iva,
  };
  return db.ofertas.add(oferta);
}

/** Marca una oferta como ganada y las demás enviadas/borrador del proyecto como perdidas (opcional) */
export async function cambiarEstadoOferta(oferta: Oferta, estado: Oferta['estado']) {
  const cambios: Partial<Oferta> = { estado };
  if (estado === 'enviada' && !oferta.fechaEnvio) cambios.fechaEnvio = hoy();
  if ((estado === 'ganada' || estado === 'perdida') && !oferta.fechaResolucion) cambios.fechaResolucion = hoy();
  await db.ofertas.update(oferta.id!, cambios);
}

function nombreCorto(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);
}

/**
 * Genera un pedido por marca. Fuente: la oferta ganada (si existe) o las partidas actuales.
 * Si ya existe pedido para una marca se omite (se devuelven las marcas omitidas).
 */
export async function generarPedidos(
  proyectoId: number,
  fuente: 'ganada' | 'partidas',
): Promise<{ creados: number; omitidas: string[] }> {
  const proyecto = await db.proyectos.get(proyectoId);
  if (!proyecto) throw new Error('Proyecto no encontrado');
  let partidas: Partida[];
  if (fuente === 'ganada') {
    const ganada = (await db.ofertas.where('proyectoId').equals(proyectoId).toArray())
      .filter((o) => o.estado === 'ganada')
      .sort((a, b) => b.version - a.version)[0];
    if (!ganada) throw new Error('No hay oferta ganada');
    partidas = ganada.partidas;
  } else {
    partidas = await db.partidas.where('proyectoId').equals(proyectoId).sortBy('orden');
  }
  const [marcas, existentes] = await Promise.all([
    db.marcas.toArray(),
    db.pedidos.where('proyectoId').equals(proyectoId).toArray(),
  ]);
  const porMarca = new Map<number, Partida[]>();
  for (const p of partidas) {
    if (!porMarca.has(p.marcaId)) porMarca.set(p.marcaId, []);
    porMarca.get(p.marcaId)!.push(p);
  }
  let creados = 0;
  const omitidas: string[] = [];
  for (const [marcaId, ps] of porMarca) {
    const marca = marcas.find((m) => m.id === marcaId);
    if (existentes.some((e) => e.marcaId === marcaId)) {
      omitidas.push(marca?.nombre ?? `#${marcaId}`);
      continue;
    }
    const lineas: LineaPedido[] = ps.map((p) => ({
      partidaId: p.id,
      zona: p.zona,
      referencia: p.referencia,
      descripcion: [p.nombre, p.descripcion].filter(Boolean).join(' — '),
      acabado: p.acabado,
      cantidad: p.cantidad,
      unidad: p.unidad,
      costeUnit: p.costeUnit,
      imagen: p.imagen,
    }));
    const pedido: PedidoMarca = {
      proyectoId,
      marcaId,
      numero: `PED-${proyecto.codigo}-${nombreCorto(marca?.nombre ?? String(marcaId))}`,
      fecha: hoy(),
      estado: 'borrador',
      fechaEntregaPrevista: marca?.plazoSemanas ? addDays(hoy(), marca.plazoSemanas * 7) : undefined,
      confirmacionRef: '',
      direccionEntrega: proyecto.direccionEntrega || proyecto.ubicacion,
      lineas,
      notas: '',
    };
    await db.pedidos.add(pedido);
    creados++;
  }
  return { creados, omitidas };
}

export const totalPedido = (p: PedidoMarca) => p.lineas.reduce((s, l) => s + l.cantidad * l.costeUnit, 0);
