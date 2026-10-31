import type {
  Cobro,
  Incidencia,
  Pago,
  PedidoMarca,
  Proyecto,
  Marca,
} from '../types';
import { ESTADO_PEDIDO, FASE_LABEL } from '../types';
import { diasHasta, eur } from './format';

export type TipoAlerta = 'fase' | 'pedido' | 'cobro' | 'pago' | 'incidencia';

export interface Alerta {
  tipo: TipoAlerta;
  proyectoId: number;
  proyecto: string;
  texto: string;
  fecha: string;
  dias: number; // negativo = vencido
}

export interface DatosAlertas {
  proyectos: Proyecto[];
  pedidos: PedidoMarca[];
  cobros: Cobro[];
  pagos: Pago[];
  incidencias: Incidencia[];
  marcas: Marca[];
}

export function calcularAlertas(d: DatosAlertas, diasAviso: number): Alerta[] {
  const out: Alerta[] = [];
  const proj = new Map(d.proyectos.map((p) => [p.id!, p]));
  const marca = new Map(d.marcas.map((m) => [m.id!, m.nombre]));
  const activo = (id: number) => {
    const p = proj.get(id);
    return p && !p.cerrado ? p : undefined;
  };
  const push = (a: Omit<Alerta, 'dias' | 'proyecto'>) => {
    const p = proj.get(a.proyectoId);
    const dias = diasHasta(a.fecha);
    if (dias <= diasAviso) out.push({ ...a, dias, proyecto: p ? `${p.codigo} · ${p.nombre}` : '' });
  };

  for (const p of d.proyectos) {
    if (p.cerrado) continue;
    for (const f of p.fases) {
      if (f.finPrev && !f.finReal) {
        push({ tipo: 'fase', proyectoId: p.id!, texto: `Fin de fase «${FASE_LABEL[f.fase]}»`, fecha: f.finPrev });
      } else if (f.inicioPrev && !f.inicioReal && !f.finReal) {
        push({ tipo: 'fase', proyectoId: p.id!, texto: `Inicio de fase «${FASE_LABEL[f.fase]}»`, fecha: f.inicioPrev });
      }
    }
    if (p.fechaEntregaObra && p.faseActual !== 'entrega') {
      push({ tipo: 'fase', proyectoId: p.id!, texto: 'Entrega comprometida en obra', fecha: p.fechaEntregaObra });
    }
  }
  for (const x of d.pedidos) {
    if (!activo(x.proyectoId) || x.estado === 'recibido' || !x.fechaEntregaPrevista) continue;
    push({
      tipo: 'pedido',
      proyectoId: x.proyectoId,
      texto: `Pedido ${x.numero} (${marca.get(x.marcaId) ?? ''}) — ${ESTADO_PEDIDO[x.estado]}`,
      fecha: x.fechaEntregaPrevista,
    });
  }
  for (const c of d.cobros) {
    if (!proj.get(c.proyectoId)) continue;
    if (c.fechaCobrada || !c.fechaPrevista) continue;
    push({ tipo: 'cobro', proyectoId: c.proyectoId, texto: `Cobro «${c.concepto}» ${eur(c.importe)}`, fecha: c.fechaPrevista });
  }
  for (const pg of d.pagos) {
    if (!proj.get(pg.proyectoId)) continue;
    if (pg.fechaPagada || !pg.vencimiento) continue;
    const quien = pg.marcaId ? marca.get(pg.marcaId) : pg.proveedor;
    push({ tipo: 'pago', proyectoId: pg.proyectoId, texto: `Pago a ${quien ?? '—'}: «${pg.concepto}» ${eur(pg.importe)}`, fecha: pg.vencimiento });
  }
  for (const i of d.incidencias) {
    if (!activo(i.proyectoId) || i.estado === 'resuelta' || !i.fechaLimite) continue;
    push({ tipo: 'incidencia', proyectoId: i.proyectoId, texto: `Incidencia: ${i.descripcion}`, fecha: i.fechaLimite });
  }
  return out.sort((a, b) => a.dias - b.dias);
}
