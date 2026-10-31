import { db, getAjustes, TABLAS } from '../db';
import type { Table } from 'dexie';
import type { Fase, FaseInfo, Marca, Partida, Producto, Proyecto } from '../types';
import { FASES } from '../types';
import { addDays, hoy, medidasTexto } from './format';
import { recalcularPartida } from './calc';
import { crearProyecto, crearVersionOferta, generarPedidos } from './ops';
import { imagenEjemplo } from './imagen';

const d = (n: number) => addDays(hoy(), n);

const MARCAS: Marca[] = [
  {
    nombre: 'Nordvik Contract',
    contacto: 'Marta Soler (export manager)',
    email: 'pedidos@nordvik-contract.example',
    telefono: '+34 600 000 001',
    web: 'https://nordvik-contract.example',
    condiciones: 'Dto. distribuidor 40% s/tarifa. Portes pagados > 3.000 € neto. Pago 30% pedido, 70% antes de expedición.',
    plazoSemanas: 8,
    regla: 'tarifa_dto_margen',
    dtoCompra: 40,
    margen: 35,
    coeficiente: 0,
    notas: 'Sillería y mesas de madera maciza.',
    demo: true,
  },
  {
    nombre: 'Atelier Lumen',
    contacto: 'Jordi Pastor',
    email: 'contract@atelierlumen.example',
    telefono: '+34 600 000 002',
    web: 'https://atelierlumen.example',
    condiciones: 'Precios netos distribuidor. Pago a 30 días fecha factura. Portes 3% del pedido.',
    plazoSemanas: 6,
    regla: 'neto_margen',
    dtoCompra: 0,
    margen: 30,
    coeficiente: 0,
    notas: 'Iluminación decorativa. Todas las referencias con marcado CE.',
    demo: true,
  },
  {
    nombre: 'Tapicerías Valdés',
    contacto: 'Lucía Valdés',
    email: 'oficina@tapiceriasvaldes.example',
    telefono: '+34 600 000 003',
    web: 'https://tapiceriasvaldes.example',
    condiciones: 'Dto. 45% s/tarifa. PVP recomendado contract: tarifa × 0,85. Pago 50% pedido, 50% a 30 días.',
    plazoSemanas: 10,
    regla: 'tarifa_coef',
    dtoCompra: 45,
    margen: 0,
    coeficiente: 0.85,
    notas: 'Tapizados, cabeceros y sofás. Telas ignífugas según UNE-EN 1021-1/2.',
    demo: true,
  },
];

type P = Omit<Producto, 'marcaId' | 'demo' | 'imagen'> & { m: number; color: string };
const tapizado = (supB: number, supC: number) => ({
  nombre: 'Tapizado',
  opciones: [
    { nombre: 'Grupo A', suplemento: 0 },
    { nombre: 'Grupo B', suplemento: supB },
    { nombre: 'Grupo C', suplemento: supC },
  ],
});
const madera = { nombre: 'Madera', opciones: [{ nombre: 'Roble natural', suplemento: 0 }, { nombre: 'Roble teñido nogal', suplemento: 25 }, { nombre: 'Fresno negro', suplemento: 35 }] };
const base = { coleccion: '', certificaciones: '', exterior: false, fichaUrl: '', notas: '', unidad: 'ud' };

const PRODUCTOS: P[] = [
  // Nordvik
  { ...base, m: 0, color: '#8a6a4a', referencia: 'NV-S01', nombre: 'Silla Fiord', categoria: 'Silla', coleccion: 'Fiord', descripcion: 'Silla de comedor en madera maciza con asiento tapizado.', ancho: 48, fondo: 52, alto: 80, altoAsiento: 46, peso: 5.2, volumen: 0.18, acabados: [madera, tapizado(18, 32)], precio: 395, certificaciones: 'UNE-EN 1021-1/2 (tapizado)' },
  { ...base, m: 0, color: '#8a6a4a', referencia: 'NV-S02', nombre: 'Silla Fiord con brazos', categoria: 'Silla', coleccion: 'Fiord', descripcion: 'Versión con brazos de la silla Fiord.', ancho: 56, fondo: 54, alto: 80, altoAsiento: 46, peso: 6.4, volumen: 0.22, acabados: [madera, tapizado(20, 36)], precio: 465, certificaciones: 'UNE-EN 1021-1/2 (tapizado)' },
  { ...base, m: 0, color: '#8a6a4a', referencia: 'NV-T01', nombre: 'Taburete alto Fiord', categoria: 'Taburete', coleccion: 'Fiord', descripcion: 'Taburete de barra, reposapiés metálico.', ancho: 44, fondo: 48, alto: 98, altoAsiento: 76, peso: 6, volumen: 0.2, acabados: [madera, tapizado(15, 28)], precio: 440 },
  { ...base, m: 0, color: '#6e5a45', referencia: 'NV-M80', nombre: 'Mesa comedor Brygge 80×80', categoria: 'Mesa', coleccion: 'Brygge', descripcion: 'Mesa de comedor con sobre de compacto fenólico y pie central de fundición.', ancho: 80, fondo: 80, alto: 75, peso: 28, volumen: 0.3, acabados: [{ nombre: 'Sobre', opciones: [{ nombre: 'Compacto blanco', suplemento: 0 }, { nombre: 'Roble chapado', suplemento: 60 }] }], precio: 520 },
  { ...base, m: 0, color: '#6e5a45', referencia: 'NV-M120', nombre: 'Mesa comedor Brygge Ø120', categoria: 'Mesa', coleccion: 'Brygge', descripcion: 'Mesa redonda Ø120 con pie central.', ancho: 120, fondo: 120, alto: 75, peso: 38, volumen: 0.45, acabados: [{ nombre: 'Sobre', opciones: [{ nombre: 'Compacto blanco', suplemento: 0 }, { nombre: 'Roble chapado', suplemento: 95 }] }], precio: 780 },
  { ...base, m: 0, color: '#5c5c5c', referencia: 'NV-X10', nombre: 'Silla exterior Kai', categoria: 'Silla', coleccion: 'Kai', descripcion: 'Silla apilable de aluminio lacado para terraza.', ancho: 52, fondo: 55, alto: 79, altoAsiento: 45, peso: 3.1, volumen: 0.2, acabados: [{ nombre: 'Lacado', opciones: [{ nombre: 'Arena', suplemento: 0 }, { nombre: 'Antracita', suplemento: 0 }, { nombre: 'Verde salvia', suplemento: 12 }] }], precio: 285, exterior: true },
  // Atelier Lumen
  { ...base, m: 1, color: '#c19a3b', referencia: 'AL-SOB-22', nombre: 'Lámpara sobremesa Halo', categoria: 'Iluminación', coleccion: 'Halo', descripcion: 'Lámpara de mesilla con pantalla textil y base de latón. Interruptor en cable.', ancho: 22, fondo: 22, alto: 45, peso: 1.8, volumen: 0.03, acabados: [{ nombre: 'Base', opciones: [{ nombre: 'Latón satinado', suplemento: 0 }, { nombre: 'Negro mate', suplemento: 0 }] }, { nombre: 'Pantalla', opciones: [{ nombre: 'Lino crudo', suplemento: 0 }, { nombre: 'Lino gris', suplemento: 0 }] }], precio: 118, certificaciones: 'CE' },
  { ...base, m: 1, color: '#c19a3b', referencia: 'AL-PIE-160', nombre: 'Lámpara de pie Halo', categoria: 'Iluminación', coleccion: 'Halo', descripcion: 'Lámpara de pie para zona de lectura, regulable.', ancho: 40, fondo: 40, alto: 160, peso: 6.5, volumen: 0.09, acabados: [{ nombre: 'Base', opciones: [{ nombre: 'Latón satinado', suplemento: 0 }, { nombre: 'Negro mate', suplemento: 0 }] }], precio: 265, certificaciones: 'CE' },
  { ...base, m: 1, color: '#c19a3b', referencia: 'AL-APL-12', nombre: 'Aplique lectura Arco', categoria: 'Iluminación', coleccion: 'Arco', descripcion: 'Aplique de cabecero LED 3W con brazo orientable y puerto USB-C.', ancho: 12, fondo: 35, alto: 18, peso: 0.9, volumen: 0.01, acabados: [{ nombre: 'Acabado', opciones: [{ nombre: 'Latón satinado', suplemento: 0 }, { nombre: 'Negro mate', suplemento: 0 }, { nombre: 'Blanco', suplemento: 0 }] }], precio: 96, certificaciones: 'CE' },
  { ...base, m: 1, color: '#c19a3b', referencia: 'AL-SUS-60', nombre: 'Suspensión Orbe Ø60', categoria: 'Iluminación', coleccion: 'Orbe', descripcion: 'Lámpara de suspensión en vidrio soplado opal para zonas comunes.', ancho: 60, fondo: 60, alto: 45, peso: 4.2, volumen: 0.25, acabados: [{ nombre: 'Florón', opciones: [{ nombre: 'Latón', suplemento: 0 }, { nombre: 'Negro', suplemento: 0 }] }], precio: 340, certificaciones: 'CE' },
  // Tapicerías Valdés
  { ...base, m: 2, color: '#4f6d7a', referencia: 'TV-CAB-160', nombre: 'Cabecero Duna 160', categoria: 'Cabecero', coleccion: 'Duna', descripcion: 'Cabecero tapizado de pared con canales verticales, para cama de 160.', ancho: 180, fondo: 8, alto: 120, peso: 18, volumen: 0.2, acabados: [tapizado(45, 85)], precio: 690, certificaciones: 'UNE-EN 1021-1/2' },
  { ...base, m: 2, color: '#4f6d7a', referencia: 'TV-CAB-090', nombre: 'Cabecero Duna 90', categoria: 'Cabecero', coleccion: 'Duna', descripcion: 'Cabecero tapizado de pared para cama de 90.', ancho: 100, fondo: 8, alto: 120, peso: 11, volumen: 0.12, acabados: [tapizado(30, 55)], precio: 455, certificaciones: 'UNE-EN 1021-1/2' },
  { ...base, m: 2, color: '#4f6d7a', referencia: 'TV-BUT-01', nombre: 'Butaca Alba', categoria: 'Butaca', coleccion: 'Alba', descripcion: 'Butaca de habitación con patas de madera y respaldo envolvente.', ancho: 72, fondo: 78, alto: 82, altoAsiento: 44, peso: 16, volumen: 0.55, acabados: [tapizado(60, 110), madera], precio: 980, certificaciones: 'UNE-EN 1021-1/2' },
  { ...base, m: 2, color: '#4f6d7a', referencia: 'TV-SOF-3P', nombre: 'Sofá Alba 3 plazas', categoria: 'Sofá', coleccion: 'Alba', descripcion: 'Sofá de 3 plazas para lobby, asiento de espuma HR alta densidad.', ancho: 220, fondo: 90, alto: 82, altoAsiento: 44, peso: 52, volumen: 1.7, acabados: [tapizado(160, 290)], precio: 2650, certificaciones: 'UNE-EN 1021-1/2, BS 5852 crib 5' },
  { ...base, m: 2, color: '#4f6d7a', referencia: 'TV-BAN-140', nombre: 'Banqueta pie de cama Duna', categoria: 'Banqueta', coleccion: 'Duna', descripcion: 'Banqueta tapizada pie de cama, 140 cm.', ancho: 140, fondo: 42, alto: 45, peso: 12, volumen: 0.27, acabados: [tapizado(35, 60)], precio: 520, certificaciones: 'UNE-EN 1021-1/2' },
];

function fases(actual: Fase, plan: Record<Fase, [number, number]>, hechasHasta: number): FaseInfo[] {
  const idx = FASES.indexOf(actual);
  return FASES.map((f, i) => {
    const [ini, fin] = plan[f];
    const info: FaseInfo = { fase: f, inicioPrev: d(ini), finPrev: d(fin), notas: '' };
    if (i < idx) {
      info.inicioReal = d(ini + (i % 2));
      info.finReal = d(fin + (i % 3) - 1);
    } else if (i === idx) {
      info.inicioReal = d(ini + 1);
    }
    void hechasHasta;
    return info;
  });
}

export async function cargarDatosEjemplo() {
  const marcaIds = await db.marcas.bulkAdd(MARCAS, { allKeys: true });
  const marcas = MARCAS.map((m, i) => ({ ...m, id: marcaIds[i] }));
  const productos: Producto[] = PRODUCTOS.map(({ m, color, ...p }) => ({
    ...p,
    marcaId: marcaIds[m],
    imagen: imagenEjemplo(p.categoria, p.referencia, color),
    demo: true,
  }));
  const prodIds = await db.productos.bulkAdd(productos, { allKeys: true });
  productos.forEach((p, i) => (p.id = prodIds[i]));
  const prod = (ref: string) => productos.find((p) => p.referencia === ref)!;
  const aj = await getAjustes();

  const partida = (proyectoId: number, orden: number, zona: string, ref: string, cantidad: number, acabadoIdx: number[] = []): Partida => {
    const p = prod(ref);
    const marca = marcas.find((m) => m.id === p.marcaId)!;
    const sel = p.acabados.map((g, gi) => ({ g: g.nombre, o: g.opciones[acabadoIdx[gi] ?? 0] }));
    const part: Partida = {
      proyectoId,
      productoId: p.id,
      marcaId: p.marcaId,
      orden,
      zona,
      referencia: p.referencia,
      nombre: p.nombre,
      descripcion: p.descripcion,
      medidas: medidasTexto(p),
      acabado: sel.map((s) => `${s.g}: ${s.o.nombre}`).join(' · '),
      cantidad,
      unidad: p.unidad,
      precioBase: p.precio,
      suplemento: sel.reduce((s, x) => s + x.o.suplemento, 0),
      costeUnit: 0,
      costeManual: false,
      pvpUnit: 0,
      pvpManual: false,
      imagen: p.imagen,
      notas: '',
      demo: true,
    };
    return recalcularPartida(part, marca);
  };

  // ---------- Proyecto 1: en fabricación ----------
  const p1: Proyecto = {
    codigo: 'DEMO-01',
    nombre: 'Reforma habitaciones y restaurante',
    cliente: 'Hotel Mirador del Puerto ****',
    cadena: 'Grupo Litoral Hoteles',
    ubicacion: 'Málaga',
    direccionEntrega: 'Paseo Marítimo 12, 29016 Málaga — acceso por muelle de carga (C/ Pescadores)',
    contactoNombre: 'Andrés Molina (Dir. de Operaciones)',
    contactoEmail: 'amolina@grupolitoral.example',
    contactoTelefono: '+34 600 100 200',
    interiorista: '',
    origen: 'propia',
    fechaAlta: d(-120),
    fechaApertura: d(75),
    fechaEntregaObra: d(45),
    faseActual: 'fabricacion',
    cerrado: false,
    iva: aj.ivaDefecto,
    descuento: 3,
    fases: fases(
      'fabricacion',
      {
        prescripcion: [-120, -100],
        oferta: [-100, -80],
        aprobacion: [-80, -50],
        pedido: [-50, -40],
        fabricacion: [-40, 5],
        transporte: [6, 20],
        instalacion: [21, 40],
        entrega: [41, 45],
      },
      4,
    ),
    instalacion: { tipo: 'subcontrata', proveedor: 'Montajes Costa del Sol S.L.', coste: 6800, venta: 8900, notas: 'Incluye subida a plantas, montaje y retirada de embalajes. 3 operarios × 10 días.' },
    notas: 'Reforma de 60 habitaciones (40 dobles, 20 individuales) y restaurante de 80 cubiertos.',
    demo: true,
  };
  const id1 = await crearProyecto(p1);
  const parts1: Partida[] = [
    partida(id1, 0, 'Habitación doble', 'TV-CAB-160', 40, [1]),
    partida(id1, 1, 'Habitación doble', 'TV-BAN-140', 40, [1]),
    partida(id1, 2, 'Habitación doble', 'TV-BUT-01', 40, [1, 0]),
    partida(id1, 3, 'Habitación doble', 'AL-APL-12', 80, [0]),
    partida(id1, 4, 'Habitación individual', 'TV-CAB-090', 20, [1]),
    partida(id1, 5, 'Habitación individual', 'AL-SOB-22', 20, [0, 0]),
    partida(id1, 6, 'Restaurante', 'NV-S01', 80, [1, 2]),
    partida(id1, 7, 'Restaurante', 'NV-M80', 16, [1]),
    partida(id1, 8, 'Restaurante', 'NV-M120', 4, [1]),
    partida(id1, 9, 'Restaurante', 'AL-SUS-60', 10, [0]),
  ];
  await db.partidas.bulkAdd(parts1);
  await db.costes.bulkAdd([
    { proyectoId: id1, tipo: 'transporte', descripcion: 'Transporte a obra (3 camiones)', proveedor: 'Transportes Andaluces', coste: 2400, venta: 2900, visible: true, demo: true },
    { proyectoId: id1, tipo: 'otro', descripcion: 'Almacenaje temporal 4 semanas', proveedor: 'Logística Málaga', coste: 900, venta: 0, visible: false, demo: true },
  ]);
  // Oferta v1 (perdida → revisada) y v2 ganada
  const of1 = await crearVersionOferta(id1);
  await db.ofertas.update(of1, { estado: 'perdida', fecha: d(-90), fechaEnvio: d(-90), fechaResolucion: d(-75), notas: 'Cliente pidió revisar precio de butacas y cabeceros.' });
  const of2 = await crearVersionOferta(id1);
  await db.ofertas.update(of2, { estado: 'ganada', fecha: d(-72), fechaEnvio: d(-72), fechaResolucion: d(-55) });
  await generarPedidos(id1, 'ganada');
  const peds = await db.pedidos.where('proyectoId').equals(id1).toArray();
  for (const pd of peds) {
    const m = marcas.find((x) => x.id === pd.marcaId)!;
    const estado = m.nombre.startsWith('Atelier') ? 'expedido' : m.nombre.startsWith('Nordvik') ? 'fabricacion' : 'confirmado';
    const entrega = m.nombre.startsWith('Atelier') ? d(3) : m.nombre.startsWith('Nordvik') ? d(-2) : d(12);
    await db.pedidos.update(pd.id!, { estado, fecha: d(-45), fechaEntregaPrevista: entrega, confirmacionRef: `CONF-${pd.id}-26`, demo: true });
  }
  const oferta2 = (await db.ofertas.get(of2))!;
  const { calcularTotales } = await import('./calc');
  const t2 = calcularTotales(oferta2.partidas, oferta2.costes, oferta2.instalacion, oferta2.descuento, oferta2.iva);
  const r = (n: number) => Math.round(n * 100) / 100;
  await db.cobros.bulkAdd([
    { proyectoId: id1, concepto: 'Anticipo 40% a la aceptación', importe: r(t2.total * 0.4), fechaPrevista: d(-50), fechaCobrada: d(-48), notas: '', demo: true },
    { proyectoId: id1, concepto: '50% antes de expedición', importe: r(t2.total * 0.5), fechaPrevista: d(4), notas: '', demo: true },
    { proyectoId: id1, concepto: '10% a la entrega', importe: r(t2.total * 0.1), fechaPrevista: d(50), notas: '', demo: true },
  ]);
  const pedsAct = await db.pedidos.where('proyectoId').equals(id1).toArray();
  const totalP = (pid: number) => r(pedsAct.find((x) => x.id === pid)!.lineas.reduce((s, l) => s + l.cantidad * l.costeUnit, 0) * (1 + aj.ivaDefecto / 100));
  for (const pd of pedsAct) {
    const m = marcas.find((x) => x.id === pd.marcaId)!;
    if (m.nombre.startsWith('Nordvik')) {
      await db.pagos.bulkAdd([
        { proyectoId: id1, marcaId: m.id, pedidoId: pd.id, concepto: '30% a pedido', importe: r(totalP(pd.id!) * 0.3), vencimiento: d(-44), fechaPagada: d(-44), proveedor: '', notas: '', demo: true },
        { proyectoId: id1, marcaId: m.id, pedidoId: pd.id, concepto: '70% antes de expedición', importe: r(totalP(pd.id!) * 0.7), vencimiento: d(-3), proveedor: '', notas: '', demo: true },
      ]);
    } else if (m.nombre.startsWith('Atelier')) {
      await db.pagos.add({ proyectoId: id1, marcaId: m.id, pedidoId: pd.id, concepto: 'Factura a 30 días', importe: totalP(pd.id!), vencimiento: d(33), proveedor: '', notas: '', demo: true });
    } else {
      await db.pagos.bulkAdd([
        { proyectoId: id1, marcaId: m.id, pedidoId: pd.id, concepto: '50% a pedido', importe: r(totalP(pd.id!) * 0.5), vencimiento: d(-44), fechaPagada: d(-43), proveedor: '', notas: '', demo: true },
        { proyectoId: id1, marcaId: m.id, pedidoId: pd.id, concepto: '50% a 30 días', importe: r(totalP(pd.id!) * 0.5), vencimiento: d(6), proveedor: '', notas: '', demo: true },
      ]);
    }
  }
  await db.pagos.add({ proyectoId: id1, proveedor: 'Montajes Costa del Sol S.L.', concepto: 'Instalación (100% a fin de obra)', importe: r(6800 * (1 + aj.ivaDefecto / 100)), vencimiento: d(48), notas: '', demo: true });
  await db.incidencias.add({ proyectoId: id1, descripcion: 'Muestra de tela Grupo B para cabeceros pendiente de validar tono definitivo con dirección', responsable: 'Tapicerías Valdés', estado: 'en_curso', fechaAlta: d(-20), fechaLimite: d(2), notas: '', demo: true });

  // ---------- Proyecto 2: en oferta ----------
  const p2: Proyecto = {
    codigo: 'DEMO-02',
    nombre: 'Hotel boutique — lobby y suites',
    cliente: 'Hotel Casa Alcázar',
    cadena: 'Independiente',
    ubicacion: 'Sevilla',
    direccionEntrega: 'C/ Santa Teresa 5, 41004 Sevilla — calle peatonal, descarga con furgoneta',
    contactoNombre: 'Carmen Ruiz (Propiedad)',
    contactoEmail: 'carmen@casaalcazar.example',
    contactoTelefono: '+34 600 300 400',
    interiorista: 'Estudio Ocre Interiorismo — Pablo Navarro',
    origen: 'recibida',
    fechaAlta: d(-25),
    fechaApertura: d(180),
    fechaEntregaObra: d(150),
    faseActual: 'oferta',
    cerrado: false,
    iva: aj.ivaDefecto,
    descuento: 0,
    fases: fases(
      'oferta',
      {
        prescripcion: [-25, -12],
        oferta: [-11, 5],
        aprobacion: [6, 30],
        pedido: [31, 38],
        fabricacion: [39, 115],
        transporte: [116, 125],
        instalacion: [126, 145],
        entrega: [146, 150],
      },
      1,
    ),
    instalacion: { tipo: 'propio', proveedor: 'Equipo propio', coste: 1800, venta: 2400, notas: '2 operarios × 5 días + dietas.' },
    notas: 'Prescripción recibida del interiorista. Admite alternativas equivalentes en iluminación.',
    demo: true,
  };
  const id2 = await crearProyecto(p2);
  const parts2: Partida[] = [
    partida(id2, 0, 'Lobby', 'TV-SOF-3P', 2, [2]),
    partida(id2, 1, 'Lobby', 'TV-BUT-01', 4, [2, 1]),
    partida(id2, 2, 'Lobby', 'AL-PIE-160', 4, [0]),
    partida(id2, 3, 'Lobby', 'AL-SUS-60', 3, [0]),
    partida(id2, 4, 'Bar', 'NV-T01', 8, [2, 1]),
    partida(id2, 5, 'Suites', 'TV-CAB-160', 12, [2]),
    partida(id2, 6, 'Suites', 'AL-SOB-22', 24, [0, 1]),
  ];
  // Partida a medida (sin producto de catálogo)
  const amedida: Partida = recalcularPartida(
    {
      proyectoId: id2,
      marcaId: marcaIds[0],
      orden: 7,
      zona: 'Recepción',
      referencia: 'NV-ESP-REC',
      nombre: 'Mostrador de recepción a medida',
      descripcion: 'Mostrador en roble y piedra natural según plano EO-REC-03 del interiorista.',
      medidas: 'An 320 × F 80 × Al 110 cm',
      acabado: 'Roble teñido nogal · Encimera mármol Emperador',
      cantidad: 1,
      unidad: 'ud',
      precioBase: 9800,
      suplemento: 0,
      costeUnit: 0,
      costeManual: false,
      pvpUnit: 0,
      pvpManual: false,
      notas: 'Producto a medida, pendiente de planos de taller.',
      demo: true,
    },
    marcas[0],
  );
  await db.partidas.bulkAdd([...parts2, amedida]);
  await db.costes.add({ proyectoId: id2, tipo: 'transporte', descripcion: 'Transporte y transbordo a furgoneta (casco histórico)', proveedor: 'Transportes Andaluces', coste: 950, venta: 1250, visible: true, demo: true });
  const of3 = await crearVersionOferta(id2);
  await db.ofertas.update(of3, { estado: 'enviada', fecha: d(-6), fechaEnvio: d(-6) });
  await db.incidencias.add({ proyectoId: id2, descripcion: 'Enviar muestras de tela Grupo C y acabado nogal al interiorista', responsable: 'Yo', estado: 'abierta', fechaAlta: d(-5), fechaLimite: d(-1), notas: '', demo: true });

  // Marcar demo en checklist / ofertas / pedidos creados por las funciones auxiliares
  for (const t of ['ofertas', 'pedidos', 'checklist'] as const) {
    const tabla = db[t] as Table<any, number>;
    const rows = await tabla.where('proyectoId').anyOf([id1, id2]).toArray();
    await tabla.bulkPut(rows.map((r) => ({ ...r, demo: true })));
  }
  // Checklist del proyecto 1: primeros puntos hechos no aplican (aún en fabricación)
  await db.ajustes.put({ ...aj, seeded: true });
}

/** Borra solo los registros marcados como datos de ejemplo */
export async function borrarDatosEjemplo() {
  await db.transaction('rw', TABLAS.filter((t) => t !== 'ajustes').map((t) => db[t]), async () => {
    const demoProj = new Set((await db.proyectos.toArray()).filter((p) => p.demo).map((p) => p.id!));
    for (const t of TABLAS) {
      if (t === 'ajustes') continue;
      const tabla = db[t] as Table<any, number>;
      const ids = (await tabla.toArray())
        .filter((r) => r.demo || (r.proyectoId !== undefined && demoProj.has(r.proyectoId)))
        .map((r) => r.id);
      await tabla.bulkDelete(ids);
    }
  });
}

export async function hayDatosEjemplo() {
  return (await db.marcas.filter((m) => !!m.demo).count()) > 0;
}

/** En el primer arranque carga los datos de ejemplo */
let seeding: Promise<void> | null = null;
export function seedInicial() {
  if (!seeding) seeding = _seedInicial();
  return seeding;
}
async function _seedInicial() {
  const aj = await getAjustes();
  if (aj.seeded) return;
  const vacio = (await db.proyectos.count()) === 0 && (await db.marcas.count()) === 0;
  if (vacio) await cargarDatosEjemplo();
  else await db.ajustes.put({ ...aj, seeded: true });
}
