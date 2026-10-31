import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Group, Modal, Paper, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { db } from '../db';
import type { Proyecto } from '../types';
import { FASE_LABEL, FASES } from '../types';
import { calcularTotales } from '../lib/calc';
import { eur, pct } from '../lib/format';
import { crearProyecto, nuevoProyectoVacio } from '../lib/ops';
import { FechaVenc } from '../components/ui';

export const COLOR_FASE: Record<string, string> = {
  prescripcion: 'gray', oferta: 'blue', aprobacion: 'indigo', pedido: 'violet', fabricacion: 'orange',
  transporte: 'yellow', instalacion: 'teal', entrega: 'green',
};

export default function Proyectos() {
  const nav = useNavigate();
  const proyectos = useLiveQuery(() => db.proyectos.toArray(), []) ?? [];
  const partidas = useLiveQuery(() => db.partidas.toArray(), []) ?? [];
  const costes = useLiveQuery(() => db.costes.toArray(), []) ?? [];
  const [filtro, setFiltro] = useState('activos');
  const [fFase, setFFase] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Proyecto | null>(null);

  const lista = proyectos
    .filter((p) => (filtro === 'activos' ? !p.cerrado : filtro === 'cerrados' ? p.cerrado : true))
    .filter((p) => !fFase || p.faseActual === fFase)
    .sort((a, b) => b.fechaAlta.localeCompare(a.fechaAlta));

  const crear = async () => {
    if (!nuevo) return;
    if (!nuevo.nombre.trim() || !nuevo.cliente.trim()) return notifications.show({ color: 'red', message: 'Nombre y cliente son obligatorios' });
    const id = await crearProyecto(nuevo);
    setNuevo(null);
    nav(`/proyectos/${id}`);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Proyectos</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={async () => setNuevo(await nuevoProyectoVacio())}>Nuevo proyecto</Button>
      </Group>
      <Group>
        <SegmentedControl value={filtro} onChange={setFiltro} data={[{ value: 'activos', label: 'Activos' }, { value: 'cerrados', label: 'Cerrados' }, { value: 'todos', label: 'Todos' }]} />
        <Select placeholder="Todas las fases" clearable data={FASES.map((f) => ({ value: f, label: FASE_LABEL[f] }))} value={fFase} onChange={setFFase} />
      </Group>
      <Paper withBorder>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Proyecto / cliente</Table.Th>
              <Table.Th>Ubicación</Table.Th>
              <Table.Th>Fase</Table.Th>
              <Table.Th>Entrega obra</Table.Th>
              <Table.Th className="num">Venta (base)</Table.Th>
              <Table.Th className="num">Margen</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lista.map((p) => {
              const t = calcularTotales(partidas.filter((x) => x.proyectoId === p.id), costes.filter((x) => x.proyectoId === p.id), p.instalacion, p.descuento, p.iva);
              return (
                <Table.Tr key={p.id} className="clickable" onClick={() => nav(`/proyectos/${p.id}`)}>
                  <Table.Td fw={600}>{p.codigo}</Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{p.cliente}</Text>
                    <Text size="xs" c="dimmed">{p.nombre}</Text>
                  </Table.Td>
                  <Table.Td>{p.ubicacion}</Table.Td>
                  <Table.Td>
                    <Badge color={COLOR_FASE[p.faseActual]} variant="light">{FASE_LABEL[p.faseActual]}</Badge>
                    {p.cerrado && <Badge ml={4} color="dark" variant="outline">Cerrado</Badge>}
                  </Table.Td>
                  <Table.Td><FechaVenc iso={p.fechaEntregaObra} hecho={p.cerrado || p.faseActual === 'entrega'} /></Table.Td>
                  <Table.Td className="num">{eur(t.base)}</Table.Td>
                  <Table.Td className="num">{eur(t.margen)} <Text span size="xs" c="dimmed">({pct(t.margenPct)})</Text></Table.Td>
                </Table.Tr>
              );
            })}
            {!lista.length && <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center" py="md">Sin proyectos</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Paper>
      <Modal opened={!!nuevo} onClose={() => setNuevo(null)} title="Nuevo proyecto" size="lg">
        {nuevo && (
          <Stack>
            <SimpleGrid cols={2}>
              <TextInput label="Código" value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.currentTarget.value })} />
              <TextInput label="Nombre del proyecto" required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.currentTarget.value })} />
              <TextInput label="Cliente (hotel)" required value={nuevo.cliente} onChange={(e) => setNuevo({ ...nuevo, cliente: e.currentTarget.value })} />
              <TextInput label="Cadena / grupo" value={nuevo.cadena} onChange={(e) => setNuevo({ ...nuevo, cadena: e.currentTarget.value })} />
              <TextInput label="Ubicación" value={nuevo.ubicacion} onChange={(e) => setNuevo({ ...nuevo, ubicacion: e.currentTarget.value })} />
              <Select label="Origen de la prescripción" allowDeselect={false} data={[{ value: 'propia', label: 'Propia' }, { value: 'recibida', label: 'Recibida (interiorista / cliente)' }]}
                value={nuevo.origen} onChange={(v) => setNuevo({ ...nuevo, origen: v as Proyecto['origen'] })} />
            </SimpleGrid>
            <Text size="xs" c="dimmed">El resto de datos se completan en la ficha del proyecto.</Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setNuevo(null)}>Cancelar</Button>
              <Button onClick={crear}>Crear</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
