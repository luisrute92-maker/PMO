import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { db, getAjustes } from '../db';
import type { Ajustes, Proyecto } from '../types';
import {
  ESTADO_INCIDENCIA,
  ESTADO_OFERTA,
  ESTADO_PEDIDO,
  FASE_LABEL,
  TIPO_COSTE,
  TIPO_INSTALACION,
} from '../types';
import { addDays, eur, fecha, hoy, num, pct } from './format';
import { calcularTotales } from './calc';
import { totalPedido } from './ops';

const vfsAny: any = (pdfFonts as any).default ?? pdfFonts;
(pdfMake as any).vfs = vfsAny.pdfMake?.vfs ?? vfsAny.vfs ?? vfsAny;

const GRIS = '#555555';
const LINEA = '#cccccc';

const tablaLayout = {
  hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.3),
  vLineWidth: () => 0,
  hLineColor: () => LINEA,
  paddingTop: () => 4,
  paddingBottom: () => 4,
  paddingLeft: () => 4,
  paddingRight: () => 4,
};

const th = (t: string, align: 'left' | 'right' | 'center' = 'left'): TableCell => ({
  text: t,
  bold: true,
  fontSize: 8,
  color: GRIS,
  alignment: align,
});
const tdR = (t: string, extra: object = {}): TableCell => ({ text: t, alignment: 'right', ...extra });

function cabecera(aj: Ajustes, titulo: string, subtitulo: string): Content {
  return {
    columns: [
      {
        width: '*',
        stack: [
          aj.empresaNombre ? { text: aj.empresaNombre, bold: true, fontSize: 11 } : { text: '' },
          aj.empresaDatos ? { text: aj.empresaDatos, fontSize: 8, color: GRIS } : { text: '' },
        ],
      },
      {
        width: 'auto',
        stack: [
          { text: titulo, fontSize: 16, bold: true, alignment: 'right' },
          { text: subtitulo, fontSize: 9, color: GRIS, alignment: 'right' },
        ],
      },
    ],
    margin: [0, 0, 0, 12],
  };
}

const separador: Content = {
  table: { widths: ['*'], body: [[{ text: '', fontSize: 1 }]] },
  layout: { hLineWidth: (i: number) => (i === 1 ? 0.8 : 0), vLineWidth: () => 0, hLineColor: () => LINEA, paddingTop: () => 0, paddingBottom: () => 0 },
  margin: [0, 0, 0, 10],
};

const acab = (a: string) => (/^acabado/i.test(a) ? a : `Acabado: ${a}`);

function bloqueDatos(pares: [string, string | undefined][]): Content {
  return {
    table: {
      widths: [110, '*'],
      body: pares
        .filter(([, v]) => v)
        .map(([k, v]) => [
          { text: k, color: GRIS, fontSize: 8 },
          { text: v!, fontSize: 9 },
        ]),
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 10],
  };
}

function titulo(t: string): Content {
  return { text: t.toUpperCase(), bold: true, fontSize: 9, color: GRIS, margin: [0, 10, 0, 4] };
}

function docBase(content: Content[], nombreDoc: string): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 9, lineHeight: 1.15 },
    info: { title: nombreDoc },
    footer: (page, pages) => ({
      columns: [
        { text: nombreDoc, fontSize: 7, color: GRIS },
        { text: `Página ${page} de ${pages}`, fontSize: 7, color: GRIS, alignment: 'right' },
      ],
      margin: [40, 20, 40, 0],
    }),
    content,
  };
}

function abrir(doc: TDocumentDefinitions, archivo: string) {
  pdfMake.createPdf(doc).download(archivo);
}

function datosCliente(p: Proyecto): [string, string | undefined][] {
  return [
    ['Cliente', p.cliente],
    ['Cadena / grupo', p.cadena],
    ['Ubicación', p.ubicacion],
    ['Contacto', [p.contactoNombre, p.contactoEmail, p.contactoTelefono].filter(Boolean).join(' · ')],
    ['Interiorista', p.interiorista],
    ['Proyecto', `${p.codigo} — ${p.nombre}`],
  ];
}

// ======================= OFERTA =======================
export async function pdfOferta(ofertaId: number) {
  const o = await db.ofertas.get(ofertaId);
  if (!o) throw new Error('Oferta no encontrada');
  const [p, aj] = await Promise.all([db.proyectos.get(o.proyectoId), getAjustes()]);
  if (!p) throw new Error('Proyecto no encontrado');
  const t = calcularTotales(o.partidas, o.costes, o.instalacion, o.descuento, o.iva);

  const body: TableCell[][] = [
    [th(''), th('Referencia / descripción'), th('Zona'), th('Cant.', 'right'), th('Precio ud.', 'right'), th('Importe', 'right')],
  ];
  const partidas = [...o.partidas].sort((a, b) => a.orden - b.orden);
  for (const x of partidas) {
    body.push([
      x.imagen ? { image: x.imagen, fit: [60, 50] } : { text: '' },
      {
        stack: [
          { text: `${x.referencia}  ${x.nombre}`, bold: true },
          x.descripcion ? { text: x.descripcion, fontSize: 8 } : { text: '' },
          x.medidas ? { text: x.medidas, fontSize: 8, color: GRIS } : { text: '' },
          x.acabado ? { text: acab(x.acabado), fontSize: 8, color: GRIS } : { text: '' },
        ],
      },
      { text: x.zona, fontSize: 8 },
      tdR(`${num(x.cantidad)} ${x.unidad}`),
      tdR(eur(x.pvpUnit)),
      tdR(eur(x.pvpUnit * x.cantidad)),
    ]);
  }
  for (const c of o.costes.filter((c) => c.visible && c.venta)) {
    body.push([
      { text: '' },
      { text: `${TIPO_COSTE[c.tipo]}${c.descripcion ? ' — ' + c.descripcion : ''}` },
      { text: '' },
      tdR('1'),
      tdR(eur(c.venta)),
      tdR(eur(c.venta)),
    ]);
  }
  if (o.instalacion.tipo !== 'ninguna' && o.instalacion.venta) {
    body.push([
      { text: '' },
      { text: 'Instalación y montaje en obra' },
      { text: '' },
      tdR('1'),
      tdR(eur(o.instalacion.venta)),
      tdR(eur(o.instalacion.venta)),
    ]);
  }

  const totales: TableCell[][] = [[{ text: 'Subtotal' }, tdR(eur(t.subtotal))]];
  if (o.descuento) totales.push([{ text: `Descuento ${pct(o.descuento)}` }, tdR('−' + eur(t.descuentoImporte))]);
  totales.push([{ text: 'Base imponible', bold: true }, tdR(eur(t.base), { bold: true })]);
  totales.push([{ text: `IVA ${pct(o.iva)}` }, tdR(eur(t.ivaImporte))]);
  totales.push([{ text: 'TOTAL', bold: true, fontSize: 11 }, tdR(eur(t.total), { bold: true, fontSize: 11 })]);

  const content: Content[] = [
    cabecera(aj, 'OFERTA', `${o.numero} · ${fecha(o.fecha)}`),
    separador,
    bloqueDatos([
      ...datosCliente(p),
      ['Validez', `${aj.validezDias} días (hasta ${fecha(addDays(o.fecha, aj.validezDias))})`],
    ]),
    {
      table: { headerRows: 1, widths: [62, '*', 70, 45, 60, 65], body, dontBreakRows: true },
      layout: tablaLayout,
    },
    {
      columns: [
        { width: '*', text: '' },
        { width: 220, table: { widths: ['*', 90], body: totales }, layout: tablaLayout },
      ],
      margin: [0, 10, 0, 0],
    },
  ];
  if (o.notas) content.push(titulo('Observaciones'), { text: o.notas });
  if (aj.condicionesOferta) content.push(titulo('Condiciones'), { text: aj.condicionesOferta, fontSize: 8 });
  abrir(docBase(content, o.numero), `${o.numero}.pdf`);
}

// ======================= PEDIDO =======================
export async function pdfPedido(pedidoId: number) {
  const ped = await db.pedidos.get(pedidoId);
  if (!ped) throw new Error('Pedido no encontrado');
  const [p, m, aj] = await Promise.all([db.proyectos.get(ped.proyectoId), db.marcas.get(ped.marcaId), getAjustes()]);
  const body: TableCell[][] = [
    [th(''), th('Referencia'), th('Descripción / acabado'), th('Cant.', 'right'), th('Precio neto', 'right'), th('Importe', 'right')],
  ];
  for (const l of ped.lineas) {
    body.push([
      l.imagen ? { image: l.imagen, fit: [45, 38] } : { text: '' },
      { text: l.referencia, bold: true },
      {
        stack: [
          { text: l.descripcion },
          l.acabado ? { text: acab(l.acabado), fontSize: 8, color: GRIS } : { text: '' },
          l.zona ? { text: `Zona: ${l.zona}`, fontSize: 8, color: GRIS } : { text: '' },
        ],
      },
      tdR(`${num(l.cantidad)} ${l.unidad}`),
      tdR(eur(l.costeUnit)),
      tdR(eur(l.costeUnit * l.cantidad)),
    ]);
  }
  const content: Content[] = [
    cabecera(aj, 'PEDIDO', `${ped.numero} · ${fecha(ped.fecha)}`),
    separador,
    bloqueDatos([
      ['Proveedor', m?.nombre],
      ['Contacto', [m?.contacto, m?.email, m?.telefono].filter(Boolean).join(' · ')],
      ['Ref. proyecto', p ? `${p.codigo} — ${p.cliente}` : undefined],
      ['Entrega solicitada', ped.fechaEntregaPrevista ? fecha(ped.fechaEntregaPrevista) : undefined],
      ['Dirección de entrega', ped.direccionEntrega],
    ]),
    { table: { headerRows: 1, widths: [48, 70, '*', 45, 60, 65], body, dontBreakRows: true }, layout: tablaLayout },
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 220,
          table: { widths: ['*', 90], body: [[{ text: 'TOTAL NETO (sin IVA)', bold: true }, tdR(eur(totalPedido(ped)), { bold: true })]] },
          layout: tablaLayout,
        },
      ],
      margin: [0, 10, 0, 0],
    },
  ];
  if (ped.notas) content.push(titulo('Observaciones'), { text: ped.notas });
  if (aj.condicionesPedido) content.push(titulo('Condiciones'), { text: aj.condicionesPedido, fontSize: 8 });
  abrir(docBase(content, ped.numero), `${ped.numero}.pdf`);
}

// ======================= INFORME DE ESTADO =======================
export async function pdfInforme(proyectoId: number) {
  const p = await db.proyectos.get(proyectoId);
  if (!p) throw new Error('Proyecto no encontrado');
  const [aj, partidas, costes, pedidos, cobros, pagos, incidencias, marcas, ofertas] = await Promise.all([
    getAjustes(),
    db.partidas.where('proyectoId').equals(proyectoId).toArray(),
    db.costes.where('proyectoId').equals(proyectoId).toArray(),
    db.pedidos.where('proyectoId').equals(proyectoId).toArray(),
    db.cobros.where('proyectoId').equals(proyectoId).toArray(),
    db.pagos.where('proyectoId').equals(proyectoId).toArray(),
    db.incidencias.where('proyectoId').equals(proyectoId).toArray(),
    db.marcas.toArray(),
    db.ofertas.where('proyectoId').equals(proyectoId).toArray(),
  ]);
  const mName = (id?: number) => marcas.find((m) => m.id === id)?.nombre ?? '';
  const t = calcularTotales(partidas, costes, p.instalacion, p.descuento, p.iva);
  const cobrado = cobros.filter((c) => c.fechaCobrada).reduce((s, c) => s + c.importe, 0);
  const pendCobro = cobros.filter((c) => !c.fechaCobrada).reduce((s, c) => s + c.importe, 0);
  const pagado = pagos.filter((c) => c.fechaPagada).reduce((s, c) => s + c.importe, 0);
  const pendPago = pagos.filter((c) => !c.fechaPagada).reduce((s, c) => s + c.importe, 0);

  const fasesBody: TableCell[][] = [
    [th('Fase'), th('Inicio prev.'), th('Fin prev.'), th('Inicio real'), th('Fin real'), th('Estado')],
    ...p.fases.map((f) => {
      const actual = f.fase === p.faseActual;
      const estado = f.finReal ? 'Completada' : actual ? 'En curso' : f.inicioReal ? 'Iniciada' : 'Pendiente';
      return [
        { text: FASE_LABEL[f.fase], bold: actual },
        fecha(f.inicioPrev),
        fecha(f.finPrev),
        fecha(f.inicioReal),
        fecha(f.finReal),
        { text: estado, bold: actual },
      ] as TableCell[];
    }),
  ];

  const content: Content[] = [
    cabecera(aj, 'INFORME DE ESTADO', `${p.codigo} · ${fecha(hoy())}`),
    separador,
    bloqueDatos([
      ...datosCliente(p),
      ['Fase actual', FASE_LABEL[p.faseActual]],
      ['Apertura hotel', p.fechaApertura ? fecha(p.fechaApertura) : undefined],
      ['Entrega en obra', p.fechaEntregaObra ? fecha(p.fechaEntregaObra) : undefined],
      ['Instalación', `${TIPO_INSTALACION[p.instalacion.tipo]}${p.instalacion.proveedor ? ' — ' + p.instalacion.proveedor : ''}`],
    ]),
    titulo('Planificación'),
    { table: { headerRows: 1, widths: ['*', 60, 60, 60, 60, 60], body: fasesBody }, layout: tablaLayout },
    titulo('Resumen económico'),
    {
      table: {
        widths: ['*', 90, '*', 90],
        body: [
          ['Venta (base imponible)', tdR(eur(t.base)), 'Cobrado', tdR(eur(cobrado))],
          ['Coste total', tdR(eur(t.coste)), 'Pendiente de cobro', tdR(eur(pendCobro))],
          ['Margen', tdR(`${eur(t.margen)} (${pct(t.margenPct)})`), 'Pagado', tdR(eur(pagado))],
          ['Total con IVA', tdR(eur(t.total)), 'Pendiente de pago', tdR(eur(pendPago))],
        ],
      },
      layout: tablaLayout,
    },
  ];
  if (ofertas.length) {
    content.push(titulo('Ofertas'), {
      table: {
        headerRows: 1,
        widths: ['*', 70, 70, 90],
        body: [
          [th('Número'), th('Fecha'), th('Estado'), th('Base imponible', 'right')],
          ...ofertas
            .sort((a, b) => a.version - b.version)
            .map((o) => [
              o.numero,
              fecha(o.fecha),
              ESTADO_OFERTA[o.estado],
              tdR(eur(calcularTotales(o.partidas, o.costes, o.instalacion, o.descuento, o.iva).base)),
            ]),
        ],
      },
      layout: tablaLayout,
    });
  }
  if (pedidos.length) {
    content.push(titulo('Pedidos a marcas'), {
      table: {
        headerRows: 1,
        widths: ['*', 90, 70, 70, 80],
        body: [
          [th('Pedido'), th('Marca'), th('Estado'), th('Entrega prev.'), th('Importe neto', 'right')],
          ...pedidos.map((x) => [x.numero, mName(x.marcaId), ESTADO_PEDIDO[x.estado], fecha(x.fechaEntregaPrevista), tdR(eur(totalPedido(x)))]),
        ],
      },
      layout: tablaLayout,
    });
  }
  const abiertas = incidencias.filter((i) => i.estado !== 'resuelta');
  if (abiertas.length) {
    content.push(titulo('Incidencias abiertas'), {
      table: {
        headerRows: 1,
        widths: ['*', 90, 60, 60],
        body: [
          [th('Descripción'), th('Responsable'), th('Estado'), th('Fecha límite')],
          ...abiertas.map((i) => [i.descripcion, i.responsable, ESTADO_INCIDENCIA[i.estado], fecha(i.fechaLimite)]),
        ],
      },
      layout: tablaLayout,
    });
  }
  if (p.notas) content.push(titulo('Notas'), { text: p.notas });
  abrir(docBase(content, `Informe ${p.codigo}`), `Informe-${p.codigo}-${hoy()}.pdf`);
}

// ======================= ACTA DE ENTREGA =======================
export async function pdfActa(proyectoId: number) {
  const p = await db.proyectos.get(proyectoId);
  if (!p) throw new Error('Proyecto no encontrado');
  const [aj, partidas, checklist, incidencias] = await Promise.all([
    getAjustes(),
    db.partidas.where('proyectoId').equals(proyectoId).sortBy('orden'),
    db.checklist.where('proyectoId').equals(proyectoId).sortBy('orden'),
    db.incidencias.where('proyectoId').equals(proyectoId).toArray(),
  ]);
  const entregaReal = p.fases.find((f) => f.fase === 'entrega')?.finReal;
  const content: Content[] = [
    cabecera(aj, 'ACTA DE ENTREGA', `${p.codigo} · ${fecha(entregaReal ?? hoy())}`),
    separador,
    bloqueDatos([...datosCliente(p), ['Lugar de entrega', p.direccionEntrega || p.ubicacion]]),
    {
      text: 'Por la presente se hace constar la entrega en obra del mobiliario y equipamiento relacionado a continuación, en las condiciones indicadas.',
      margin: [0, 0, 0, 6],
    },
    titulo('Relación de partidas entregadas'),
    {
      table: {
        headerRows: 1,
        widths: [80, 70, '*', 50],
        body: [
          [th('Zona'), th('Referencia'), th('Descripción / acabado'), th('Cant.', 'right')],
          ...partidas.map((x) => [
            x.zona,
            x.referencia,
            { stack: [x.nombre, x.acabado ? { text: x.acabado, fontSize: 8, color: GRIS } : ''] },
            tdR(`${num(x.cantidad)} ${x.unidad}`),
          ]),
        ],
      },
      layout: tablaLayout,
    },
    titulo('Comprobaciones'),
    {
      table: {
        headerRows: 1,
        widths: [20, '*', 60],
        body: [
          [th('Hecho'), th('Comprobación'), th('Fecha')],
          ...checklist.map((c) => [c.hecho ? 'Sí' : 'No', c.texto + (c.notas ? ` — ${c.notas}` : ''), fecha(c.fecha)]),
        ],
      },
      layout: tablaLayout,
    },
  ];
  const pend = incidencias.filter((i) => i.estado !== 'resuelta');
  content.push(titulo('Reservas / incidencias pendientes'));
  if (pend.length) {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 90, 60],
        body: [
          [th('Descripción'), th('Responsable'), th('Fecha límite')],
          ...pend.map((i) => [i.descripcion, i.responsable, fecha(i.fechaLimite)]),
        ],
      },
      layout: tablaLayout,
    });
  } else {
    content.push({ text: 'Sin reservas.' });
  }
  content.push({
    margin: [0, 40, 0, 0],
    columns: [
      { stack: [{ text: 'Por el proveedor', color: GRIS }, { text: '\n\n\n______________________________' }, { text: 'Nombre, firma y fecha', fontSize: 7, color: GRIS }] },
      { stack: [{ text: 'Por el cliente', color: GRIS }, { text: '\n\n\n______________________________' }, { text: 'Nombre, firma y fecha', fontSize: 7, color: GRIS }] },
    ],
    unbreakable: true,
  } as Content);
  abrir(docBase(content, `Acta de entrega ${p.codigo}`), `Acta-entrega-${p.codigo}.pdf`);
}
