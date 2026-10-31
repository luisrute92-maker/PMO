import { Badge, NumberInput, TextInput, type NumberInputProps, type TextInputProps } from '@mantine/core';
import type { EstadoIncidencia, EstadoOferta, EstadoPedido } from '../types';
import { ESTADO_INCIDENCIA, ESTADO_OFERTA, ESTADO_PEDIDO } from '../types';
import { diasHasta, fecha } from '../lib/format';

export function NumIn(props: Omit<NumberInputProps, 'onChange'> & { onChange: (v: number) => void }) {
  const { onChange, ...rest } = props;
  return (
    <NumberInput
      decimalSeparator=","
      thousandSeparator="."
      decimalScale={2}
      hideControls
      fixedDecimalScale={typeof rest.suffix === 'string' && rest.suffix.includes('€')}
      {...rest}
      onChange={(v) => onChange(typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')) || 0)}
    />
  );
}

export function DateIn(
  props: Omit<TextInputProps, 'value' | 'onChange'> & { value?: string; onChange: (v: string | undefined) => void },
) {
  const { value, onChange, ...rest } = props;
  return <TextInput type="date" {...rest} value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value || undefined)} />;
}

const COLOR_OFERTA: Record<EstadoOferta, string> = { borrador: 'gray', enviada: 'blue', ganada: 'green', perdida: 'red' };
export const BadgeOferta = ({ e }: { e: EstadoOferta }) => (
  <Badge color={COLOR_OFERTA[e]} variant="light">{ESTADO_OFERTA[e]}</Badge>
);

const COLOR_PEDIDO: Record<EstadoPedido, string> = {
  borrador: 'gray', enviado: 'blue', confirmado: 'cyan', fabricacion: 'orange', expedido: 'grape', recibido: 'green',
};
export const BadgePedido = ({ e }: { e: EstadoPedido }) => (
  <Badge color={COLOR_PEDIDO[e]} variant="light">{ESTADO_PEDIDO[e]}</Badge>
);

const COLOR_INC: Record<EstadoIncidencia, string> = { abierta: 'red', en_curso: 'orange', resuelta: 'green' };
export const BadgeIncidencia = ({ e }: { e: EstadoIncidencia }) => (
  <Badge color={COLOR_INC[e]} variant="light">{ESTADO_INCIDENCIA[e]}</Badge>
);

/** Fecha con color según vencimiento (si no está completada) */
export function FechaVenc({ iso, hecho, aviso = 7 }: { iso?: string; hecho?: boolean; aviso?: number }) {
  if (!iso) return <>—</>;
  if (hecho) return <>{fecha(iso)}</>;
  const d = diasHasta(iso);
  const color = d < 0 ? 'var(--mantine-color-red-7)' : d <= aviso ? 'var(--mantine-color-orange-7)' : undefined;
  return <span style={{ color, fontWeight: color ? 600 : undefined }}>{fecha(iso)}</span>;
}

export function textoDias(d: number) {
  if (d < 0) return `Vencido hace ${-d} d`;
  if (d === 0) return 'Hoy';
  return `En ${d} d`;
}
