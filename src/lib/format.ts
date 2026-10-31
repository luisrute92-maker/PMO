const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
} as unknown as Intl.NumberFormatOptions);
const numFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);

export const eur = (n: number | undefined) => eurFmt.format(n || 0);
export const num = (n: number | undefined) => numFmt.format(n || 0);
export const pct = (n: number | undefined) => `${numFmt.format(n || 0)} %`;

export const hoy = () => toISO(new Date());

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function fecha(iso?: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Días desde hoy hasta la fecha (negativo = vencida) */
export function diasHasta(iso: string) {
  const a = new Date(hoy() + 'T00:00:00').getTime();
  const b = new Date(iso + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function medidasTexto(p: { ancho?: number; fondo?: number; alto?: number; altoAsiento?: number }) {
  const parts: string[] = [];
  if (p.ancho) parts.push(`An ${num(p.ancho)}`);
  if (p.fondo) parts.push(`F ${num(p.fondo)}`);
  if (p.alto) parts.push(`Al ${num(p.alto)}`);
  let s = parts.join(' × ');
  if (s) s += ' cm';
  if (p.altoAsiento) s += ` (asiento ${num(p.altoAsiento)})`;
  return s;
}
