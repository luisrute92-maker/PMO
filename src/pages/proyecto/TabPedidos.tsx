import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ActionIcon, Alert, Button, Group, Modal, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconFileTypePdf, IconPencil, IconTrash, IconTruckDelivery, IconCash } from '@tabler/icons-react';
import { db } from '../../db';
import type { EstadoPedido, PedidoMarca } from '../../types';
import { ESTADO_PEDIDO } from '../../types';
import { DateIn, FechaVenc, NumIn } from '../../components/ui';
import { eur, fecha, hoy, num } from '../../lib/format';
import { generarPedidos, totalPedido } from '../../lib/ops';
import { pdfPedido } from '../../lib/pdf';
import { ejecutar, type TabProps } from './ProyectoPage';

export default function TabPedidos({ p }: TabProps) {
  const id = p.id!;
  const pedidos = useLiveQuery(() => db.pedidos.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const ofertas = useLiveQuery(() => db.ofertas.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const nPartidas = useLiveQuery(() => db.partidas.where('proyectoId').equals(id).count(), [id]) ?? 0;
  const marcas = useLiveQuery(() => db.marcas.toArray(), []) ?? [];
  const [edit, setEdit] = useState<PedidoMarca | null>(null);
  const ganada = ofertas.filter((o) => o.estado === 'ganada').sort((a, b) => b.version - a.version)[0];
  const mName = (mid: number) => marcas.find((m) => m.id === mid)?.nombre ?? '—';

  const generar = (fuente: 'ganada' | 'partidas') =>
    ejecutar(async () => {
      const r = await generarPedidos(id, fuente);
      notifications.show({
        message: `${r.creados} pedido(s) creado(s).${r.omitidas.length ? ` Omitidas por tener ya pedido: ${r.omitidas.join(', ')}.` : ''}`,
      });
    });

  const pedirFuente = () => {
    if (ganada) return generar('ganada');
    modals.openConfirmModal({
      title: 'Sin oferta ganada',
      children: <Text size="sm">No hay ninguna oferta marcada como ganada. ¿Generar los pedidos a partir de las partidas actuales del proyecto?</Text>,
      labels: { confirm: 'Usar partidas actuales', cancel: 'Cancelar' },
      onConfirm: () => generar('partidas'),
    });
  };

  const setEstado = async (x: PedidoMarca, estado: EstadoPedido) => {
    const c: Partial<PedidoMarca> = { estado };
    if (estado === 'recibido' && !x.fechaEntregaReal) c.fechaEntregaReal = hoy();
    await db.pedidos.update(x.id!, c);
  };

  const crearPago = async (x: PedidoMarca) => {
    const total = Math.round(totalPedido(x) * (1 + p.iva / 100) * 100) / 100;
    await db.pagos.add({
      proyectoId: id, marcaId: x.marcaId, pedidoId: x.id, proveedor: '', concepto: `Pedido ${x.numero}`, importe: total,
      vencimiento: x.fechaEntregaPrevista, notas: `Importe total con IVA ${p.iva}%. Ajustar a las condiciones de pago de la marca.`,
    });
    notifications.show({ message: 'Pago creado en «Cobros y pagos». Revisa importe y vencimiento.' });
  };

  const total = (x: PedidoMarca) => totalPedido(x);

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {ganada ? `Fuente: oferta ganada ${ganada.numero} (${ganada.partidas.length} partidas)` : `Sin oferta ganada · ${nPartidas} partidas actuales`}
        </Text>
        <Button leftSection={<IconTruckDelivery size={16} />} onClick={pedirFuente}>Generar pedidos por marca</Button>
      </Group>
      {pedidos.length > 0 && (
        <Alert variant="light" color="gray">Si ya existe pedido para una marca no se duplica. Para regenerarlo, elimínalo primero.</Alert>
      )}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Pedido</Table.Th>
            <Table.Th>Marca</Table.Th>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Entrega prevista</Table.Th>
            <Table.Th>Entrega real</Table.Th>
            <Table.Th className="num">Líneas</Table.Th>
            <Table.Th className="num">Importe neto</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {pedidos.map((x) => (
            <Table.Tr key={x.id}>
              <Table.Td fw={600}>{x.numero}{x.confirmacionRef && <Text size="xs" c="dimmed">Conf.: {x.confirmacionRef}</Text>}</Table.Td>
              <Table.Td>{mName(x.marcaId)}</Table.Td>
              <Table.Td>{fecha(x.fecha)}</Table.Td>
              <Table.Td>
                <Select size="xs" w={140} allowDeselect={false} value={x.estado} data={Object.entries(ESTADO_PEDIDO).map(([value, label]) => ({ value, label }))}
                  onChange={(v) => v && setEstado(x, v as EstadoPedido)} />
              </Table.Td>
              <Table.Td><FechaVenc iso={x.fechaEntregaPrevista} hecho={x.estado === 'recibido'} /></Table.Td>
              <Table.Td>{fecha(x.fechaEntregaReal)}</Table.Td>
              <Table.Td className="num">{x.lineas.length}</Table.Td>
              <Table.Td className="num" fw={600}>{eur(total(x))}</Table.Td>
              <Table.Td>
                <Group gap={0} wrap="nowrap">
                  <ActionIcon variant="subtle" title="PDF" onClick={() => ejecutar(() => pdfPedido(x.id!))}><IconFileTypePdf size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" title="Editar" onClick={() => setEdit(structuredClone(x))}><IconPencil size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="gray" title="Crear pago a la marca" onClick={() => crearPago(x)}><IconCash size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => modals.openConfirmModal({
                    title: `Eliminar ${x.numero}`, labels: { confirm: 'Eliminar', cancel: 'Cancelar' }, confirmProps: { color: 'red' },
                    onConfirm: () => db.pedidos.delete(x.id!),
                  })}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!pedidos.length && <Table.Tr><Table.Td colSpan={9}><Text c="dimmed" ta="center" py="md">Sin pedidos</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
        {pedidos.length > 0 && (
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={7}>Total pedidos (sin IVA)</Table.Th>
              <Table.Th className="num">{eur(pedidos.reduce((s, x) => s + total(x), 0))}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>

      <Modal opened={!!edit} onClose={() => setEdit(null)} title={`Pedido ${edit?.numero ?? ''} — ${edit ? mName(edit.marcaId) : ''}`} size={1100}>
        {edit && (
          <Stack>
            <SimpleGrid cols={4}>
              <TextInput label="Número" value={edit.numero} onChange={(e) => setEdit({ ...edit, numero: e.currentTarget.value })} />
              <DateIn label="Fecha pedido" value={edit.fecha} onChange={(v) => setEdit({ ...edit, fecha: v ?? edit.fecha })} />
              <DateIn label="Entrega prevista" value={edit.fechaEntregaPrevista} onChange={(v) => setEdit({ ...edit, fechaEntregaPrevista: v })} />
              <DateIn label="Entrega real" value={edit.fechaEntregaReal} onChange={(v) => setEdit({ ...edit, fechaEntregaReal: v })} />
              <TextInput label="Ref. confirmación marca" value={edit.confirmacionRef} onChange={(e) => setEdit({ ...edit, confirmacionRef: e.currentTarget.value })} />
              <TextInput label="Dirección de entrega" style={{ gridColumn: 'span 3' }} value={edit.direccionEntrega} onChange={(e) => setEdit({ ...edit, direccionEntrega: e.currentTarget.value })} />
            </SimpleGrid>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Referencia</Table.Th>
                  <Table.Th>Descripción</Table.Th>
                  <Table.Th>Acabado</Table.Th>
                  <Table.Th w={90}>Cant.</Table.Th>
                  <Table.Th w={120}>Precio neto</Table.Th>
                  <Table.Th className="num">Importe</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {edit.lineas.map((l, i) => {
                  const setL = (c: Partial<typeof l>) => setEdit({ ...edit, lineas: edit.lineas.map((x, j) => (j === i ? { ...x, ...c } : x)) });
                  return (
                    <Table.Tr key={i}>
                      <Table.Td><TextInput size="xs" value={l.referencia} onChange={(e) => setL({ referencia: e.currentTarget.value })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={l.descripcion} onChange={(e) => setL({ descripcion: e.currentTarget.value })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={l.acabado} onChange={(e) => setL({ acabado: e.currentTarget.value })} /></Table.Td>
                      <Table.Td><NumIn size="xs" value={l.cantidad} onChange={(v) => setL({ cantidad: v })} /></Table.Td>
                      <Table.Td><NumIn size="xs" value={l.costeUnit} onChange={(v) => setL({ costeUnit: v })} /></Table.Td>
                      <Table.Td className="num">{eur(l.cantidad * l.costeUnit)}</Table.Td>
                      <Table.Td><ActionIcon size="sm" variant="subtle" color="red" onClick={() => setEdit({ ...edit, lineas: edit.lineas.filter((_, j) => j !== i) })}><IconTrash size={14} /></ActionIcon></Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            <Group justify="space-between">
              <Button size="xs" variant="light" onClick={() => setEdit({ ...edit, lineas: [...edit.lineas, { zona: '', referencia: '', descripcion: '', acabado: '', cantidad: 1, unidad: 'ud', costeUnit: 0 }] })}>+ Línea</Button>
              <Text fw={700}>Total neto: {eur(totalPedido(edit))} · {num(edit.lineas.reduce((s, l) => s + l.cantidad, 0))} uds.</Text>
            </Group>
            <Textarea label="Observaciones (aparecen en el PDF)" autosize minRows={2} value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.currentTarget.value })} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button onClick={async () => { await db.pedidos.put(edit); setEdit(null); }}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
