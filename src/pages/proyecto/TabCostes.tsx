import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ActionIcon, Button, Divider, Group, Modal, Paper, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { db } from '../../db';
import type { CosteAdicional, Instalacion, TipoCoste, TipoInstalacion } from '../../types';
import { TIPO_COSTE, TIPO_INSTALACION } from '../../types';
import { NumIn } from '../../components/ui';
import { eur } from '../../lib/format';
import type { TabProps } from './ProyectoPage';

export default function TabCostes({ p, upd }: TabProps) {
  const id = p.id!;
  const costes = useLiveQuery(() => db.costes.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const partidas = useLiveQuery(() => db.partidas.where('proyectoId').equals(id).sortBy('orden'), [id]) ?? [];
  const [inst, setInst] = useState<Instalacion>(p.instalacion);
  useEffect(() => setInst(p.instalacion), [p.instalacion]);
  const [edit, setEdit] = useState<CosteAdicional | null>(null);
  const sucio = JSON.stringify(inst) !== JSON.stringify(p.instalacion);

  const guardar = async () => {
    if (!edit) return;
    await db.costes.put(edit.visible ? edit : { ...edit, venta: 0 });
    setEdit(null);
  };
  const partidaTxt = (pid?: number) => {
    const x = partidas.find((z) => z.id === pid);
    return x ? `${x.referencia} (${x.zona})` : 'Proyecto';
  };

  return (
    <Stack>
      <Title order={4}>Instalación</Title>
      <Paper withBorder p="md">
        <SimpleGrid cols={4}>
          <Select label="Realizada por" allowDeselect={false} value={inst.tipo}
            data={Object.entries(TIPO_INSTALACION).map(([value, label]) => ({ value, label }))}
            onChange={(v) => setInst({ ...inst, tipo: v as TipoInstalacion })} />
          <TextInput label="Proveedor / equipo" disabled={inst.tipo === 'ninguna'} value={inst.proveedor} onChange={(e) => setInst({ ...inst, proveedor: e.currentTarget.value })} />
          <NumIn label="Coste" suffix=" €" disabled={inst.tipo === 'ninguna'} value={inst.coste} onChange={(v) => setInst({ ...inst, coste: v })} />
          <NumIn label="Precio de venta al cliente" suffix=" €" disabled={inst.tipo === 'ninguna'} value={inst.venta} onChange={(v) => setInst({ ...inst, venta: v })} />
        </SimpleGrid>
        <Textarea mt="xs" label="Notas / alcance" autosize minRows={2} disabled={inst.tipo === 'ninguna'} value={inst.notas} onChange={(e) => setInst({ ...inst, notas: e.currentTarget.value })} />
        <Group justify="flex-end" mt="sm">
          <Text size="xs" c="dimmed" style={{ flex: 1 }}>La venta de instalación aparece en la oferta como línea propia. Registra los pagos a la subcontrata en «Cobros y pagos».</Text>
          <Button disabled={!sucio} onClick={async () => { await upd({ instalacion: inst }); notifications.show({ message: 'Instalación guardada' }); }}>Guardar instalación</Button>
        </Group>
      </Paper>

      <Divider />
      <Group justify="space-between">
        <Title order={4}>Costes adicionales</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEdit({ proyectoId: id, tipo: 'transporte', descripcion: '', proveedor: '', coste: 0, venta: 0, visible: true })}>
          Añadir coste
        </Button>
      </Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tipo</Table.Th>
            <Table.Th>Descripción</Table.Th>
            <Table.Th>Aplica a</Table.Th>
            <Table.Th>Proveedor</Table.Th>
            <Table.Th className="num">Coste</Table.Th>
            <Table.Th>En oferta</Table.Th>
            <Table.Th className="num">Venta</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {costes.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td>{TIPO_COSTE[c.tipo]}</Table.Td>
              <Table.Td>{c.descripcion}</Table.Td>
              <Table.Td>{partidaTxt(c.partidaId)}</Table.Td>
              <Table.Td>{c.proveedor}</Table.Td>
              <Table.Td className="num">{eur(c.coste)}</Table.Td>
              <Table.Td>{c.visible ? 'Línea visible' : <Text span c="dimmed" size="sm">Coste interno</Text>}</Table.Td>
              <Table.Td className="num">{c.visible ? eur(c.venta) : '—'}</Table.Td>
              <Table.Td>
                <Group gap={0} wrap="nowrap">
                  <ActionIcon variant="subtle" onClick={() => setEdit({ ...c })}><IconPencil size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => db.costes.delete(c.id!)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!costes.length && <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" ta="center" py="md">Sin costes adicionales</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
        {costes.length > 0 && (
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={4}>Total</Table.Th>
              <Table.Th className="num">{eur(costes.reduce((s, c) => s + c.coste, 0))}</Table.Th>
              <Table.Th />
              <Table.Th className="num">{eur(costes.filter((c) => c.visible).reduce((s, c) => s + c.venta, 0))}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>

      <Modal opened={!!edit} onClose={() => setEdit(null)} title="Coste adicional" size="lg">
        {edit && (
          <Stack>
            <SimpleGrid cols={2}>
              <Select label="Tipo" allowDeselect={false} value={edit.tipo} data={Object.entries(TIPO_COSTE).map(([value, label]) => ({ value, label }))}
                onChange={(v) => setEdit({ ...edit, tipo: v as TipoCoste })} />
              <Select label="Aplica a" value={edit.partidaId ? String(edit.partidaId) : 'proyecto'}
                data={[{ value: 'proyecto', label: 'Todo el proyecto' }, ...partidas.map((x) => ({ value: String(x.id), label: `${x.referencia} — ${x.nombre} (${x.zona})` }))]}
                onChange={(v) => setEdit({ ...edit, partidaId: v && v !== 'proyecto' ? Number(v) : undefined })} searchable allowDeselect={false} />
            </SimpleGrid>
            <TextInput label="Descripción" value={edit.descripcion} onChange={(e) => setEdit({ ...edit, descripcion: e.currentTarget.value })} />
            <TextInput label="Proveedor" value={edit.proveedor} onChange={(e) => setEdit({ ...edit, proveedor: e.currentTarget.value })} />
            <SimpleGrid cols={2}>
              <NumIn label="Coste" suffix=" €" value={edit.coste} onChange={(v) => setEdit({ ...edit, coste: v })} />
              <NumIn label="Venta al cliente" suffix=" €" disabled={!edit.visible} value={edit.venta} onChange={(v) => setEdit({ ...edit, venta: v })} />
            </SimpleGrid>
            <Switch label="Repercutir al cliente como línea visible en la oferta" checked={edit.visible} onChange={(e) => setEdit({ ...edit, visible: e.currentTarget.checked })}
              description="Si se desactiva, es un coste interno que solo reduce el margen" />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button onClick={guardar}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
