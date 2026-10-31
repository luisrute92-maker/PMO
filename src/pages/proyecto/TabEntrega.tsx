import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ActionIcon, Button, Checkbox, Group, Modal, Progress, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import { IconFileTypePdf, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { db } from '../../db';
import type { EstadoIncidencia, Incidencia } from '../../types';
import { ESTADO_INCIDENCIA } from '../../types';
import { BadgeIncidencia, DateIn, FechaVenc } from '../../components/ui';
import { fecha, hoy } from '../../lib/format';
import { pdfActa } from '../../lib/pdf';
import { ejecutar, type TabProps } from './ProyectoPage';

export default function TabEntrega({ p }: TabProps) {
  const id = p.id!;
  const items = useLiveQuery(() => db.checklist.where('proyectoId').equals(id).sortBy('orden'), [id]) ?? [];
  const incidencias = useLiveQuery(() => db.incidencias.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const partidas = useLiveQuery(() => db.partidas.where('proyectoId').equals(id).sortBy('orden'), [id]) ?? [];
  const [nuevoItem, setNuevoItem] = useState('');
  const [inc, setInc] = useState<Incidencia | null>(null);
  const [verResueltas, setVerResueltas] = useState(false);
  const hechos = items.filter((i) => i.hecho).length;
  const lista = incidencias.filter((i) => verResueltas || i.estado !== 'resuelta').sort((a, b) => b.fechaAlta.localeCompare(a.fechaAlta));

  const añadir = async () => {
    if (!nuevoItem.trim()) return;
    await db.checklist.add({ proyectoId: id, orden: items.length ? Math.max(...items.map((i) => i.orden)) + 1 : 0, texto: nuevoItem.trim(), hecho: false, notas: '' });
    setNuevoItem('');
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Checklist de entrega</Title>
        <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={() => ejecutar(() => pdfActa(id))}>Acta de entrega (PDF)</Button>
      </Group>
      <Group>
        <Progress value={items.length ? (hechos / items.length) * 100 : 0} style={{ flex: 1 }} color="green" />
        <Text size="sm">{hechos} / {items.length}</Text>
      </Group>
      <Table>
        <Table.Tbody>
          {items.map((i) => (
            <Table.Tr key={i.id}>
              <Table.Td w={40}>
                <Checkbox checked={i.hecho} onChange={(e) => db.checklist.update(i.id!, { hecho: e.currentTarget.checked, fecha: e.currentTarget.checked ? i.fecha ?? hoy() : undefined })} />
              </Table.Td>
              <Table.Td><Text size="sm" td={i.hecho ? 'line-through' : undefined} c={i.hecho ? 'dimmed' : undefined}>{i.texto}</Text></Table.Td>
              <Table.Td w={160}>{i.hecho && <DateIn size="xs" value={i.fecha} onChange={(v) => db.checklist.update(i.id!, { fecha: v })} />}</Table.Td>
              <Table.Td w={260}><TextInput size="xs" placeholder="Notas" defaultValue={i.notas} onBlur={(e) => e.currentTarget.value !== i.notas && db.checklist.update(i.id!, { notas: e.currentTarget.value })} /></Table.Td>
              <Table.Td w={40}><ActionIcon size="sm" variant="subtle" color="red" onClick={() => db.checklist.delete(i.id!)}><IconTrash size={14} /></ActionIcon></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group>
        <TextInput placeholder="Nuevo elemento del checklist" value={nuevoItem} onChange={(e) => setNuevoItem(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && añadir()} style={{ flex: 1 }} />
        <Button variant="light" onClick={añadir}>Añadir</Button>
      </Group>

      <Group justify="space-between" mt="md">
        <Title order={4}>Incidencias</Title>
        <Group>
          <Checkbox label="Mostrar resueltas" checked={verResueltas} onChange={(e) => setVerResueltas(e.currentTarget.checked)} />
          <Button leftSection={<IconPlus size={16} />} onClick={() => setInc({ proyectoId: id, descripcion: '', responsable: '', estado: 'abierta', fechaAlta: hoy(), notas: '' })}>Nueva incidencia</Button>
        </Group>
      </Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Descripción</Table.Th>
            <Table.Th>Partida</Table.Th>
            <Table.Th>Responsable</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Alta</Table.Th>
            <Table.Th>Límite</Table.Th>
            <Table.Th>Resuelta</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lista.map((i) => (
            <Table.Tr key={i.id}>
              <Table.Td>{i.descripcion}</Table.Td>
              <Table.Td>{partidas.find((x) => x.id === i.partidaId)?.referencia ?? '—'}</Table.Td>
              <Table.Td>{i.responsable}</Table.Td>
              <Table.Td><BadgeIncidencia e={i.estado} /></Table.Td>
              <Table.Td>{fecha(i.fechaAlta)}</Table.Td>
              <Table.Td><FechaVenc iso={i.fechaLimite} hecho={i.estado === 'resuelta'} /></Table.Td>
              <Table.Td>{fecha(i.fechaResolucion)}</Table.Td>
              <Table.Td>
                <Group gap={0} wrap="nowrap">
                  <ActionIcon variant="subtle" onClick={() => setInc({ ...i })}><IconPencil size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => db.incidencias.delete(i.id!)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!lista.length && <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" ta="center" py="sm">Sin incidencias pendientes</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={!!inc} onClose={() => setInc(null)} title="Incidencia" size="lg">
        {inc && (
          <Stack>
            <Textarea label="Descripción" autosize minRows={2} value={inc.descripcion} onChange={(e) => setInc({ ...inc, descripcion: e.currentTarget.value })} />
            <SimpleGrid cols={2}>
              <Select label="Partida afectada" clearable searchable value={inc.partidaId ? String(inc.partidaId) : null}
                data={partidas.map((x) => ({ value: String(x.id), label: `${x.referencia} — ${x.nombre} (${x.zona})` }))}
                onChange={(v) => setInc({ ...inc, partidaId: v ? Number(v) : undefined })} />
              <TextInput label="Responsable" value={inc.responsable} onChange={(e) => setInc({ ...inc, responsable: e.currentTarget.value })} />
              <Select label="Estado" allowDeselect={false} value={inc.estado} data={Object.entries(ESTADO_INCIDENCIA).map(([value, label]) => ({ value, label }))}
                onChange={(v) => setInc({ ...inc, estado: v as EstadoIncidencia, fechaResolucion: v === 'resuelta' ? inc.fechaResolucion ?? hoy() : undefined })} />
              <DateIn label="Fecha de alta" value={inc.fechaAlta} onChange={(v) => setInc({ ...inc, fechaAlta: v ?? inc.fechaAlta })} />
              <DateIn label="Fecha límite" value={inc.fechaLimite} onChange={(v) => setInc({ ...inc, fechaLimite: v })} />
              <DateIn label="Fecha de resolución" value={inc.fechaResolucion} onChange={(v) => setInc({ ...inc, fechaResolucion: v })} />
            </SimpleGrid>
            <Textarea label="Notas" autosize value={inc.notas} onChange={(e) => setInc({ ...inc, notas: e.currentTarget.value })} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setInc(null)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!inc.descripcion.trim()) return notifications.show({ color: 'red', message: 'Indica la descripción' });
                await db.incidencias.put(inc); setInc(null);
              }}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
