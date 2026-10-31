import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ActionIcon, Button, Checkbox, Group, Modal, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { db } from '../../db';
import type { Cobro, Pago } from '../../types';
import { DateIn, FechaVenc, NumIn } from '../../components/ui';
import { calcularTotales, r2 } from '../../lib/calc';
import { eur, hoy, pct } from '../../lib/format';
import type { TabProps } from './ProyectoPage';

export default function TabFinanzas({ p }: TabProps) {
  const id = p.id!;
  const cobros = useLiveQuery(() => db.cobros.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const pagos = useLiveQuery(() => db.pagos.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const pedidos = useLiveQuery(() => db.pedidos.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const marcas = useLiveQuery(() => db.marcas.orderBy('nombre').toArray(), []) ?? [];
  const ofertas = useLiveQuery(() => db.ofertas.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const partidas = useLiveQuery(() => db.partidas.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const costes = useLiveQuery(() => db.costes.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [pago, setPago] = useState<Pago | null>(null);
  const [pctCobro, setPctCobro] = useState(0);

  const ganada = ofertas.filter((o) => o.estado === 'ganada').sort((a, b) => b.version - a.version)[0];
  const ref = ganada
    ? { txt: `oferta ganada ${ganada.numero}`, total: calcularTotales(ganada.partidas, ganada.costes, ganada.instalacion, ganada.descuento, ganada.iva).total }
    : { txt: 'partidas actuales', total: calcularTotales(partidas, costes, p.instalacion, p.descuento, p.iva).total };

  const sum = (xs: { importe: number }[]) => xs.reduce((s, x) => s + x.importe, 0);
  const cobrado = sum(cobros.filter((c) => c.fechaCobrada));
  const pendCobro = sum(cobros.filter((c) => !c.fechaCobrada));
  const pagado = sum(pagos.filter((c) => c.fechaPagada));
  const pendPago = sum(pagos.filter((c) => !c.fechaPagada));
  const quien = (x: Pago) => (x.marcaId ? marcas.find((m) => m.id === x.marcaId)?.nombre : x.proveedor) || '—';

  const borrar = (tabla: 'cobros' | 'pagos', rid: number) =>
    modals.openConfirmModal({
      title: 'Eliminar', labels: { confirm: 'Eliminar', cancel: 'Cancelar' }, confirmProps: { color: 'red' },
      onConfirm: () => db[tabla].delete(rid),
    });

  return (
    <Stack>
      <SimpleGrid cols={5}>
        {[
          [`Total ${ref.txt} (IVA incl.)`, eur(ref.total)],
          ['Cobrado', eur(cobrado)],
          ['Pendiente de cobro', eur(pendCobro)],
          ['Pagado', eur(pagado)],
          ['Pendiente de pago', eur(pendPago)],
        ].map(([k, v]) => (
          <Paper key={k} withBorder p="sm" bg="gray.0">
            <Text size="xs" c="dimmed">{k}</Text>
            <Text fw={700}>{v}</Text>
          </Paper>
        ))}
      </SimpleGrid>
      {Math.abs(r2(sum(cobros)) - r2(ref.total)) > 0.01 && cobros.length > 0 && (
        <Text size="sm" c="orange">Los hitos de cobro suman {eur(sum(cobros))}; diferencia con el total: {eur(ref.total - sum(cobros))}.</Text>
      )}

      <Group justify="space-between" mt="sm">
        <Title order={4}>Cobros al cliente</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => { setPctCobro(0); setCobro({ proyectoId: id, concepto: '', importe: 0, notas: '' }); }}>Añadir hito de cobro</Button>
      </Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Concepto</Table.Th>
            <Table.Th className="num">Importe (IVA incl.)</Table.Th>
            <Table.Th className="num">% s/total</Table.Th>
            <Table.Th>Fecha prevista</Table.Th>
            <Table.Th>Cobrado el</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...cobros].sort((a, b) => (a.fechaPrevista ?? '').localeCompare(b.fechaPrevista ?? '')).map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td>{c.concepto}</Table.Td>
              <Table.Td className="num">{eur(c.importe)}</Table.Td>
              <Table.Td className="num">{ref.total ? pct((c.importe / ref.total) * 100) : '—'}</Table.Td>
              <Table.Td><FechaVenc iso={c.fechaPrevista} hecho={!!c.fechaCobrada} /></Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <Checkbox checked={!!c.fechaCobrada} onChange={(e) => db.cobros.update(c.id!, { fechaCobrada: e.currentTarget.checked ? hoy() : undefined })} />
                  {c.fechaCobrada && <DateIn size="xs" value={c.fechaCobrada} onChange={(v) => db.cobros.update(c.id!, { fechaCobrada: v })} />}
                </Group>
              </Table.Td>
              <Table.Td>
                <Group gap={0} wrap="nowrap">
                  <ActionIcon variant="subtle" onClick={() => { setPctCobro(0); setCobro({ ...c }); }}><IconPencil size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => borrar('cobros', c.id!)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!cobros.length && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="sm">Sin hitos de cobro</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Group justify="space-between" mt="md">
        <Title order={4}>Pagos a marcas y proveedores</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setPago({ proyectoId: id, proveedor: '', concepto: '', importe: 0, notas: '' })}>Añadir pago</Button>
      </Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>A</Table.Th>
            <Table.Th>Concepto</Table.Th>
            <Table.Th>Pedido</Table.Th>
            <Table.Th className="num">Importe (IVA incl.)</Table.Th>
            <Table.Th>Vencimiento</Table.Th>
            <Table.Th>Pagado el</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...pagos].sort((a, b) => (a.vencimiento ?? '').localeCompare(b.vencimiento ?? '')).map((x) => (
            <Table.Tr key={x.id}>
              <Table.Td fw={500}>{quien(x)}</Table.Td>
              <Table.Td>{x.concepto}</Table.Td>
              <Table.Td>{pedidos.find((pd) => pd.id === x.pedidoId)?.numero ?? '—'}</Table.Td>
              <Table.Td className="num">{eur(x.importe)}</Table.Td>
              <Table.Td><FechaVenc iso={x.vencimiento} hecho={!!x.fechaPagada} /></Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <Checkbox checked={!!x.fechaPagada} onChange={(e) => db.pagos.update(x.id!, { fechaPagada: e.currentTarget.checked ? hoy() : undefined })} />
                  {x.fechaPagada && <DateIn size="xs" value={x.fechaPagada} onChange={(v) => db.pagos.update(x.id!, { fechaPagada: v })} />}
                </Group>
              </Table.Td>
              <Table.Td>
                <Group gap={0} wrap="nowrap">
                  <ActionIcon variant="subtle" onClick={() => setPago({ ...x })}><IconPencil size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => borrar('pagos', x.id!)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!pagos.length && <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center" py="sm">Sin pagos</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={!!cobro} onClose={() => setCobro(null)} title="Hito de cobro">
        {cobro && (
          <Stack>
            <TextInput label="Concepto" placeholder="Anticipo 40% a la aceptación" value={cobro.concepto} onChange={(e) => setCobro({ ...cobro, concepto: e.currentTarget.value })} />
            <SimpleGrid cols={2}>
              <NumIn label={`% sobre total (${ref.txt})`} value={pctCobro} onChange={(v) => { setPctCobro(v); setCobro({ ...cobro, importe: r2((ref.total * v) / 100) }); }} />
              <NumIn label="Importe (IVA incl.)" suffix=" €" value={cobro.importe} onChange={(v) => setCobro({ ...cobro, importe: v })} />
              <DateIn label="Fecha prevista" value={cobro.fechaPrevista} onChange={(v) => setCobro({ ...cobro, fechaPrevista: v })} />
              <DateIn label="Fecha cobrada" value={cobro.fechaCobrada} onChange={(v) => setCobro({ ...cobro, fechaCobrada: v })} />
            </SimpleGrid>
            <Textarea label="Notas" autosize value={cobro.notas} onChange={(e) => setCobro({ ...cobro, notas: e.currentTarget.value })} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setCobro(null)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!cobro.concepto.trim()) return notifications.show({ color: 'red', message: 'Indica el concepto' });
                await db.cobros.put(cobro); setCobro(null);
              }}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal opened={!!pago} onClose={() => setPago(null)} title="Pago">
        {pago && (
          <Stack>
            <Select label="Marca" placeholder="Otro proveedor (indicar abajo)" clearable value={pago.marcaId ? String(pago.marcaId) : null}
              data={marcas.map((m) => ({ value: String(m.id), label: m.nombre }))}
              onChange={(v) => setPago({ ...pago, marcaId: v ? Number(v) : undefined, pedidoId: undefined })} />
            {!pago.marcaId && <TextInput label="Proveedor" placeholder="Transportista, subcontrata de montaje…" value={pago.proveedor} onChange={(e) => setPago({ ...pago, proveedor: e.currentTarget.value })} />}
            {pago.marcaId && (
              <Select label="Pedido asociado" clearable value={pago.pedidoId ? String(pago.pedidoId) : null}
                data={pedidos.filter((x) => x.marcaId === pago.marcaId).map((x) => ({ value: String(x.id), label: x.numero }))}
                onChange={(v) => setPago({ ...pago, pedidoId: v ? Number(v) : undefined })} />
            )}
            <TextInput label="Concepto" value={pago.concepto} onChange={(e) => setPago({ ...pago, concepto: e.currentTarget.value })} />
            <SimpleGrid cols={3}>
              <NumIn label="Importe (IVA incl.)" suffix=" €" value={pago.importe} onChange={(v) => setPago({ ...pago, importe: v })} />
              <DateIn label="Vencimiento" value={pago.vencimiento} onChange={(v) => setPago({ ...pago, vencimiento: v })} />
              <DateIn label="Fecha pagada" value={pago.fechaPagada} onChange={(v) => setPago({ ...pago, fechaPagada: v })} />
            </SimpleGrid>
            <Textarea label="Notas" autosize value={pago.notas} onChange={(e) => setPago({ ...pago, notas: e.currentTarget.value })} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPago(null)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!pago.marcaId && !pago.proveedor.trim()) return notifications.show({ color: 'red', message: 'Indica marca o proveedor' });
                await db.pagos.put(pago); setPago(null);
              }}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
