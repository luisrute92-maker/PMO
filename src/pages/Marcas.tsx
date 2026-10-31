import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Button, Group, Modal, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title, ActionIcon,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { db } from '../db';
import type { Marca, ReglaPrecio } from '../types';
import { REGLAS } from '../types';
import { NumIn } from '../components/ui';
import { calcularPrecio } from '../lib/calc';
import { eur, num } from '../lib/format';
import { recalcularProyecto } from '../lib/ops';

const VACIA: Marca = {
  nombre: '', contacto: '', email: '', telefono: '', web: '', condiciones: '', plazoSemanas: 8,
  regla: 'tarifa_dto_margen', dtoCompra: 0, margen: 30, coeficiente: 1, notas: '',
};

export function reglaTexto(m: Marca) {
  switch (m.regla) {
    case 'tarifa_dto_margen': return `Tarifa −${num(m.dtoCompra)}% +${num(m.margen)}%`;
    case 'neto_margen': return `Neto +${num(m.margen)}%`;
    case 'tarifa_coef': return `Tarifa × ${num(m.coeficiente)} (dto. compra ${num(m.dtoCompra)}%)`;
  }
}

export default function Marcas() {
  const marcas = useLiveQuery(() => db.marcas.orderBy('nombre').toArray(), []);
  const productos = useLiveQuery(() => db.productos.toArray(), []);
  const [edit, setEdit] = useState<Marca | null>(null);
  const [original, setOriginal] = useState<Marca | null>(null);

  const guardar = async () => {
    if (!edit) return;
    if (!edit.nombre.trim()) return notifications.show({ color: 'red', message: 'El nombre es obligatorio' });
    const id = await db.marcas.put(edit);
    const cambioRegla =
      original &&
      (original.regla !== edit.regla || original.dtoCompra !== edit.dtoCompra || original.margen !== edit.margen || original.coeficiente !== edit.coeficiente);
    setEdit(null);
    if (cambioRegla) {
      modals.openConfirmModal({
        title: 'Regla de precio modificada',
        children: (
          <Text size="sm">
            ¿Recalcular coste y PVP de las partidas de esta marca en los proyectos abiertos? Las partidas con precio
            editado manualmente y las ofertas ya emitidas no se modifican.
          </Text>
        ),
        labels: { confirm: 'Recalcular', cancel: 'No' },
        onConfirm: async () => {
          const ps = await db.proyectos.filter((p) => !p.cerrado).toArray();
          const conMarca = new Set((await db.partidas.where('marcaId').equals(id).toArray()).map((x) => x.proyectoId));
          for (const p of ps) if (conMarca.has(p.id!)) await recalcularProyecto(p.id!);
          notifications.show({ message: 'Partidas recalculadas' });
        },
      });
    }
  };

  const borrar = async (m: Marca) => {
    const usadas = await db.partidas.where('marcaId').equals(m.id!).count();
    if (usadas) {
      return notifications.show({ color: 'red', title: 'No se puede eliminar', message: `${m.nombre} se usa en ${usadas} partidas de proyectos.` });
    }
    const n = productos?.filter((p) => p.marcaId === m.id).length ?? 0;
    modals.openConfirmModal({
      title: `Eliminar ${m.nombre}`,
      children: <Text size="sm">{n ? `Tiene ${n} productos en catálogo, que también se eliminarán. ` : ''}¿Continuar?</Text>,
      labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await db.productos.where('marcaId').equals(m.id!).delete();
        await db.marcas.delete(m.id!);
      },
    });
  };

  const ejemplo = edit ? calcularPrecio(1000, edit) : null;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Marcas</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => { setEdit({ ...VACIA }); setOriginal(null); }}>
          Nueva marca
        </Button>
      </Group>
      <Paper withBorder>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Marca</Table.Th>
              <Table.Th>Contacto</Table.Th>
              <Table.Th>Regla de precio</Table.Th>
              <Table.Th className="num">Plazo (sem.)</Table.Th>
              <Table.Th className="num">Productos</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {marcas?.map((m) => (
              <Table.Tr key={m.id} className="clickable" onClick={() => { setEdit({ ...m }); setOriginal(m); }}>
                <Table.Td fw={600}>{m.nombre}</Table.Td>
                <Table.Td>
                  <Text size="sm">{m.contacto}</Text>
                  <Text size="xs" c="dimmed">{[m.email, m.telefono].filter(Boolean).join(' · ')}</Text>
                </Table.Td>
                <Table.Td>{reglaTexto(m)}</Table.Td>
                <Table.Td className="num">{m.plazoSemanas}</Table.Td>
                <Table.Td className="num">{productos?.filter((p) => p.marcaId === m.id).length}</Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <ActionIcon variant="subtle" color="red" onClick={() => borrar(m)}><IconTrash size={16} /></ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            {marcas?.length === 0 && (
              <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="md">Sin marcas</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar marca' : 'Nueva marca'} size="lg">
        {edit && (
          <Stack>
            <SimpleGrid cols={2}>
              <TextInput label="Nombre" required value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.currentTarget.value })} />
              <TextInput label="Persona de contacto" value={edit.contacto} onChange={(e) => setEdit({ ...edit, contacto: e.currentTarget.value })} />
              <TextInput label="Email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.currentTarget.value })} />
              <TextInput label="Teléfono" value={edit.telefono} onChange={(e) => setEdit({ ...edit, telefono: e.currentTarget.value })} />
              <TextInput label="Web" value={edit.web} onChange={(e) => setEdit({ ...edit, web: e.currentTarget.value })} />
              <NumIn label="Plazo de fabricación habitual (semanas)" value={edit.plazoSemanas} decimalScale={0} onChange={(v) => setEdit({ ...edit, plazoSemanas: v })} />
            </SimpleGrid>
            <Textarea label="Condiciones comerciales" autosize minRows={2} value={edit.condiciones} onChange={(e) => setEdit({ ...edit, condiciones: e.currentTarget.value })} />
            <Paper withBorder p="sm" bg="gray.0">
              <Stack gap="xs">
                <Select
                  label="Regla de precio"
                  data={Object.entries(REGLAS).map(([value, label]) => ({ value, label }))}
                  value={edit.regla}
                  allowDeselect={false}
                  onChange={(v) => setEdit({ ...edit, regla: v as ReglaPrecio })}
                />
                <SimpleGrid cols={3}>
                  {edit.regla !== 'neto_margen' && (
                    <NumIn label="% dto. de compra s/tarifa" value={edit.dtoCompra} onChange={(v) => setEdit({ ...edit, dtoCompra: v })} />
                  )}
                  {edit.regla !== 'tarifa_coef' && (
                    <NumIn label="% margen (markup s/coste)" value={edit.margen} onChange={(v) => setEdit({ ...edit, margen: v })} />
                  )}
                  {edit.regla === 'tarifa_coef' && (
                    <NumIn label="Coeficiente PVP s/tarifa" value={edit.coeficiente} decimalScale={4} onChange={(v) => setEdit({ ...edit, coeficiente: v })} />
                  )}
                </SimpleGrid>
                {ejemplo && (
                  <Text size="xs" c="dimmed">
                    Ejemplo con {edit.regla === 'neto_margen' ? 'neto' : 'tarifa'} de {eur(1000)}: coste {eur(ejemplo.coste)} → PVP {eur(ejemplo.pvp)}
                  </Text>
                )}
              </Stack>
            </Paper>
            <Textarea label="Notas" autosize minRows={2} value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.currentTarget.value })} />
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
