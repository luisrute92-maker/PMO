import { Badge, Table, TextInput, Text, Stack, Radio } from '@mantine/core';
import type { FaseInfo } from '../../types';
import { FASE_LABEL, FASES } from '../../types';
import { DateIn } from '../../components/ui';
import { diasHasta } from '../../lib/format';
import type { TabProps } from './ProyectoPage';

function desviacion(f: FaseInfo) {
  if (!f.finPrev) return null;
  if (f.finReal) {
    const d = -diasHasta(f.finReal) + diasHasta(f.finPrev);
    const retraso = -d;
    if (retraso > 0) return <Badge color="red" variant="light">+{retraso} d</Badge>;
    if (retraso < 0) return <Badge color="green" variant="light">{retraso} d</Badge>;
    return <Badge color="green" variant="light">En plazo</Badge>;
  }
  const d = diasHasta(f.finPrev);
  if (d < 0) return <Badge color="red">Vencida {-d} d</Badge>;
  return null;
}

export default function TabFases({ p, upd }: TabProps) {
  const set = (i: number, c: Partial<FaseInfo>) => upd({ fases: p.fases.map((f, j) => (j === i ? { ...f, ...c } : f)) });
  const iActual = FASES.indexOf(p.faseActual);
  return (
    <Stack>
      <Text size="sm" c="dimmed">Los cambios se guardan automáticamente. La fase actual también se puede cambiar desde la cabecera.</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={60}>Actual</Table.Th>
            <Table.Th>Fase</Table.Th>
            <Table.Th>Inicio previsto</Table.Th>
            <Table.Th>Fin previsto</Table.Th>
            <Table.Th>Inicio real</Table.Th>
            <Table.Th>Fin real</Table.Th>
            <Table.Th>Desviación</Table.Th>
            <Table.Th>Notas</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {p.fases.map((f, i) => (
            <Table.Tr key={f.fase} bg={i === iActual ? 'blue.0' : undefined}>
              <Table.Td><Radio checked={i === iActual} onChange={() => upd({ faseActual: f.fase })} /></Table.Td>
              <Table.Td fw={i === iActual ? 700 : 500}>{i + 1}. {FASE_LABEL[f.fase]}</Table.Td>
              <Table.Td><DateIn size="xs" value={f.inicioPrev} onChange={(v) => set(i, { inicioPrev: v })} /></Table.Td>
              <Table.Td><DateIn size="xs" value={f.finPrev} onChange={(v) => set(i, { finPrev: v })} /></Table.Td>
              <Table.Td><DateIn size="xs" value={f.inicioReal} onChange={(v) => set(i, { inicioReal: v })} /></Table.Td>
              <Table.Td><DateIn size="xs" value={f.finReal} onChange={(v) => set(i, { finReal: v })} /></Table.Td>
              <Table.Td>{desviacion(f)}</Table.Td>
              <Table.Td><TextInput size="xs" defaultValue={f.notas} onBlur={(e) => e.currentTarget.value !== f.notas && set(i, { notas: e.currentTarget.value })} /></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
