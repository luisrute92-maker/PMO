import { describe, expect, it } from 'vitest';
import { calcularPrecio, calcularTotales, recalcularPartida } from './calc';
import type { Partida } from '../types';

describe('calcularPrecio', () => {
  it('a) tarifa − dto + margen (markup)', () => {
    const r = calcularPrecio(1000, { regla: 'tarifa_dto_margen', dtoCompra: 40, margen: 30, coeficiente: 0 });
    expect(r.coste).toBe(600);
    expect(r.pvp).toBe(780);
  });
  it('b) neto + margen', () => {
    const r = calcularPrecio(500, { regla: 'neto_margen', dtoCompra: 0, margen: 35, coeficiente: 0 });
    expect(r.coste).toBe(500);
    expect(r.pvp).toBe(675);
  });
  it('c) tarifa × coeficiente con dto compra', () => {
    const r = calcularPrecio(1000, { regla: 'tarifa_coef', dtoCompra: 45, margen: 0, coeficiente: 0.8 });
    expect(r.coste).toBe(550);
    expect(r.pvp).toBe(800);
  });
});

const base: Partida = {
  proyectoId: 1, marcaId: 1, orden: 0, zona: '', referencia: 'X', nombre: '', descripcion: '',
  medidas: '', acabado: '', cantidad: 10, unidad: 'ud', precioBase: 100, suplemento: 20,
  costeUnit: 0, costeManual: false, pvpUnit: 999, pvpManual: true, notas: '',
};

describe('recalcularPartida', () => {
  it('respeta PVP manual y recalcula coste con suplemento', () => {
    const p = recalcularPartida(base, { regla: 'tarifa_dto_margen', dtoCompra: 50, margen: 30, coeficiente: 0 });
    expect(p.costeUnit).toBe(60);
    expect(p.pvpUnit).toBe(999);
  });
});

describe('calcularTotales', () => {
  it('suma partidas, costes visibles, instalación, descuento e IVA', () => {
    const p = { ...base, costeUnit: 60, pvpUnit: 100, pvpManual: false };
    const t = calcularTotales(
      [p],
      [
        { proyectoId: 1, tipo: 'transporte', descripcion: '', proveedor: '', coste: 100, venta: 150, visible: true },
        { proyectoId: 1, tipo: 'aranceles', descripcion: '', proveedor: '', coste: 50, venta: 0, visible: false },
      ],
      { tipo: 'subcontrata', proveedor: '', coste: 200, venta: 250, notas: '' },
      10,
      21,
    );
    expect(t.ventaPartidas).toBe(1000);
    expect(t.subtotal).toBe(1400);
    expect(t.descuentoImporte).toBe(140);
    expect(t.base).toBe(1260);
    expect(t.ivaImporte).toBe(264.6);
    expect(t.total).toBe(1524.6);
    expect(t.coste).toBe(950);
    expect(t.margen).toBe(310);
  });
});
