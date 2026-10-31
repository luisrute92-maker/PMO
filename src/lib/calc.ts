import type { CosteAdicional, Instalacion, Marca, Partida } from '../types';

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type ReglaMarca = Pick<Marca, 'regla' | 'dtoCompra' | 'margen' | 'coeficiente'>;

/**
 * Calcula coste y PVP unitarios a partir del precio base (tarifa o neto, ya con suplementos)
 *  a) tarifa − dto + margen:  coste = tarifa·(1−dto)   PVP = coste·(1+margen)
 *  b) neto + margen:          coste = neto             PVP = neto·(1+margen)
 *  c) tarifa × coeficiente:   coste = tarifa·(1−dto)   PVP = tarifa·coef
 * El margen es markup sobre coste.
 */
export function calcularPrecio(base: number, m: ReglaMarca): { coste: number; pvp: number } {
  const b = base || 0;
  switch (m.regla) {
    case 'tarifa_dto_margen': {
      const coste = b * (1 - (m.dtoCompra || 0) / 100);
      return { coste: r2(coste), pvp: r2(coste * (1 + (m.margen || 0) / 100)) };
    }
    case 'neto_margen':
      return { coste: r2(b), pvp: r2(b * (1 + (m.margen || 0) / 100)) };
    case 'tarifa_coef':
      return {
        coste: r2(b * (1 - (m.dtoCompra || 0) / 100)),
        pvp: r2(b * (m.coeficiente || 0)),
      };
  }
}

/** Recalcula los importes no manuales de una partida según su marca */
export function recalcularPartida<T extends Partida>(p: T, m: ReglaMarca | undefined): T {
  if (!m) return p;
  const { coste, pvp } = calcularPrecio((p.precioBase || 0) + (p.suplemento || 0), m);
  return {
    ...p,
    costeUnit: p.costeManual ? p.costeUnit : coste,
    pvpUnit: p.pvpManual ? p.pvpUnit : pvp,
  };
}

export interface Totales {
  ventaPartidas: number;
  costePartidas: number;
  ventaCostes: number; // costes adicionales repercutidos
  costeCostes: number;
  ventaInstalacion: number;
  costeInstalacion: number;
  subtotal: number; // antes de descuento
  descuentoImporte: number;
  base: number; // base imponible
  ivaImporte: number;
  total: number; // con IVA
  coste: number;
  margen: number;
  margenPct: number; // % sobre venta (base)
}

export function calcularTotales(
  partidas: Partida[],
  costes: CosteAdicional[],
  instalacion: Instalacion | undefined,
  descuento: number,
  iva: number,
): Totales {
  const ventaPartidas = r2(partidas.reduce((s, p) => s + p.pvpUnit * p.cantidad, 0));
  const costePartidas = r2(partidas.reduce((s, p) => s + p.costeUnit * p.cantidad, 0));
  const ventaCostes = r2(costes.filter((c) => c.visible).reduce((s, c) => s + (c.venta || 0), 0));
  const costeCostes = r2(costes.reduce((s, c) => s + (c.coste || 0), 0));
  const inst = instalacion && instalacion.tipo !== 'ninguna' ? instalacion : undefined;
  const ventaInstalacion = r2(inst?.venta || 0);
  const costeInstalacion = r2(inst?.coste || 0);
  const subtotal = r2(ventaPartidas + ventaCostes + ventaInstalacion);
  const descuentoImporte = r2((subtotal * (descuento || 0)) / 100);
  const base = r2(subtotal - descuentoImporte);
  const ivaImporte = r2((base * (iva || 0)) / 100);
  const total = r2(base + ivaImporte);
  const coste = r2(costePartidas + costeCostes + costeInstalacion);
  const margen = r2(base - coste);
  const margenPct = base ? (margen / base) * 100 : 0;
  return {
    ventaPartidas,
    costePartidas,
    ventaCostes,
    costeCostes,
    ventaInstalacion,
    costeInstalacion,
    subtotal,
    descuentoImporte,
    base,
    ivaImporte,
    total,
    coste,
    margen,
    margenPct,
  };
}

/** Coste adicional asignado a una partida concreta */
export function costesDePartida(partidaId: number | undefined, costes: CosteAdicional[]) {
  return costes.filter((c) => c.partidaId === partidaId);
}
