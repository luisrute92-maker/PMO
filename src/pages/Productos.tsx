import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ActionIcon, Anchor, Badge, Button, Checkbox, Divider, FileButton, Group, Image, Modal, Paper, Select, SimpleGrid,
  Stack, Table, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconSearch, IconCopy } from '@tabler/icons-react';
import { db } from '../db';
import type { GrupoAcabado, Marca, Producto } from '../types';
import { NumIn } from '../components/ui';
import { calcularPrecio } from '../lib/calc';
import { eur, medidasTexto } from '../lib/format';
import { comprimirImagen } from '../lib/imagen';

export const productoVacio = (marcaId = 0): Producto => ({
  marcaId, referencia: '', nombre: '', descripcion: '', categoria: '', coleccion: '', acabados: [], precio: 0,
  unidad: 'ud', certificaciones: '', exterior: false, fichaUrl: '', notas: '',
});

export function etiquetaPrecio(m?: Marca) {
  return m?.regla === 'neto_margen' ? 'Precio neto' : 'Tarifa';
}

function EditorAcabados({ value, onChange }: { value: GrupoAcabado[]; onChange: (v: GrupoAcabado[]) => void }) {
  const set = (i: number, g: GrupoAcabado) => onChange(value.map((x, j) => (j === i ? g : x)));
  return (
    <Stack gap="xs">
      {value.map((g, i) => (
        <Paper key={i} withBorder p="xs">
          <Group gap="xs" mb={6}>
            <TextInput size="xs" placeholder="Grupo (p. ej. Tapizado)" value={g.nombre} style={{ flex: 1 }} onChange={(e) => set(i, { ...g, nombre: e.currentTarget.value })} />
            <ActionIcon variant="subtle" color="red" onClick={() => onChange(value.filter((_, j) => j !== i))}><IconTrash size={14} /></ActionIcon>
          </Group>
          {g.opciones.map((o, k) => (
            <Group key={k} gap="xs" mb={4} wrap="nowrap">
              <TextInput size="xs" placeholder="Opción" value={o.nombre} style={{ flex: 1 }}
                onChange={(e) => set(i, { ...g, opciones: g.opciones.map((x, j) => (j === k ? { ...x, nombre: e.currentTarget.value } : x)) })} />
              <NumIn size="xs" w={110} placeholder="Suplemento €" value={o.suplemento}
                onChange={(v) => set(i, { ...g, opciones: g.opciones.map((x, j) => (j === k ? { ...x, suplemento: v } : x)) })} />
              <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => set(i, { ...g, opciones: g.opciones.filter((_, j) => j !== k) })}><IconTrash size={12} /></ActionIcon>
            </Group>
          ))}
          <Button size="compact-xs" variant="subtle" onClick={() => set(i, { ...g, opciones: [...g.opciones, { nombre: '', suplemento: 0 }] })}>+ opción</Button>
        </Paper>
      ))}
      <Button size="xs" variant="light" onClick={() => onChange([...value, { nombre: '', opciones: [{ nombre: '', suplemento: 0 }] }])}>
        + Grupo de acabados
      </Button>
      <Text size="xs" c="dimmed">El suplemento se suma al precio base (tarifa o neto) y se le aplica la regla de la marca.</Text>
    </Stack>
  );
}

export function ProductoForm({ value, onChange, marcas }: { value: Producto; onChange: (p: Producto) => void; marcas: Marca[] }) {
  const p = value;
  const m = marcas.find((x) => x.id === p.marcaId);
  const calc = m ? calcularPrecio(p.precio, m) : null;
  return (
    <SimpleGrid cols={2} spacing="lg">
      <Stack gap="xs">
        <Select label="Marca" required data={marcas.map((x) => ({ value: String(x.id), label: x.nombre }))} value={p.marcaId ? String(p.marcaId) : null}
          onChange={(v) => onChange({ ...p, marcaId: Number(v) })} />
        <SimpleGrid cols={2}>
          <TextInput label="Referencia" required value={p.referencia} onChange={(e) => onChange({ ...p, referencia: e.currentTarget.value })} />
          <TextInput label="Nombre" value={p.nombre} onChange={(e) => onChange({ ...p, nombre: e.currentTarget.value })} />
          <TextInput label="Categoría" placeholder="Silla, butaca, mesa…" value={p.categoria} onChange={(e) => onChange({ ...p, categoria: e.currentTarget.value })} />
          <TextInput label="Colección" value={p.coleccion} onChange={(e) => onChange({ ...p, coleccion: e.currentTarget.value })} />
        </SimpleGrid>
        <Textarea label="Descripción" autosize minRows={2} value={p.descripcion} onChange={(e) => onChange({ ...p, descripcion: e.currentTarget.value })} />
        <Divider label="Medidas (cm) y logística" labelPosition="left" />
        <SimpleGrid cols={4}>
          <NumIn label="Ancho" value={p.ancho} onChange={(v) => onChange({ ...p, ancho: v || undefined })} />
          <NumIn label="Fondo" value={p.fondo} onChange={(v) => onChange({ ...p, fondo: v || undefined })} />
          <NumIn label="Alto" value={p.alto} onChange={(v) => onChange({ ...p, alto: v || undefined })} />
          <NumIn label="Alto asiento" value={p.altoAsiento} onChange={(v) => onChange({ ...p, altoAsiento: v || undefined })} />
          <NumIn label="Peso (kg)" value={p.peso} onChange={(v) => onChange({ ...p, peso: v || undefined })} />
          <NumIn label="Volumen (m³)" value={p.volumen} decimalScale={3} onChange={(v) => onChange({ ...p, volumen: v || undefined })} />
          <NumIn label="Plazo propio (sem.)" placeholder={m ? `Marca: ${m.plazoSemanas}` : ''} value={p.plazoSemanas} decimalScale={0} onChange={(v) => onChange({ ...p, plazoSemanas: v || undefined })} />
        </SimpleGrid>
        <Divider label="Precio" labelPosition="left" />
        <SimpleGrid cols={2}>
          <NumIn label={etiquetaPrecio(m)} value={p.precio} suffix=" €" onChange={(v) => onChange({ ...p, precio: v })} />
          <TextInput label="Unidad" value={p.unidad} onChange={(e) => onChange({ ...p, unidad: e.currentTarget.value })} />
        </SimpleGrid>
        {calc && <Text size="xs" c="dimmed">Coste {eur(calc.coste)} · PVP {eur(calc.pvp)} (sin suplementos)</Text>}
      </Stack>
      <Stack gap="xs">
        <Group align="flex-start">
          {p.imagen ? <Image src={p.imagen} w={160} h={120} fit="contain" radius="sm" bg="gray.1" /> : <Paper w={160} h={120} bg="gray.1" />}
          <Stack gap={4}>
            <FileButton accept="image/*" onChange={async (f) => f && onChange({ ...p, imagen: await comprimirImagen(f) })}>
              {(props) => <Button size="xs" variant="light" {...props}>Subir imagen</Button>}
            </FileButton>
            {p.imagen && <Button size="xs" variant="subtle" color="red" onClick={() => onChange({ ...p, imagen: undefined })}>Quitar</Button>}
          </Stack>
        </Group>
        <TextInput label="Enlace a ficha técnica" placeholder="https://…" value={p.fichaUrl} onChange={(e) => onChange({ ...p, fichaUrl: e.currentTarget.value })} />
        <TextInput label="Certificaciones" placeholder="UNE-EN 1021-1/2, BS 5852…" value={p.certificaciones} onChange={(e) => onChange({ ...p, certificaciones: e.currentTarget.value })} />
        <Checkbox label="Apto para exterior" checked={p.exterior} onChange={(e) => onChange({ ...p, exterior: e.currentTarget.checked })} />
        <Text size="sm" fw={500} mt="xs">Acabados / opciones</Text>
        <EditorAcabados value={p.acabados} onChange={(acabados) => onChange({ ...p, acabados })} />
        <Textarea label="Notas internas" autosize minRows={2} value={p.notas} onChange={(e) => onChange({ ...p, notas: e.currentTarget.value })} />
      </Stack>
    </SimpleGrid>
  );
}

export default function Productos() {
  const marcas = useLiveQuery(() => db.marcas.orderBy('nombre').toArray(), []) ?? [];
  const productos = useLiveQuery(() => db.productos.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [fMarca, setFMarca] = useState<string | null>(null);
  const [fCat, setFCat] = useState<string | null>(null);
  const [edit, setEdit] = useState<Producto | null>(null);

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort(), [productos]);
  const lista = productos
    .filter((p) => !fMarca || p.marcaId === Number(fMarca))
    .filter((p) => !fCat || p.categoria === fCat)
    .filter((p) => !q || `${p.referencia} ${p.nombre} ${p.descripcion} ${p.coleccion}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.referencia.localeCompare(b.referencia));

  const guardar = async () => {
    if (!edit) return;
    if (!edit.marcaId || !edit.referencia.trim()) return notifications.show({ color: 'red', message: 'Marca y referencia son obligatorias' });
    await db.productos.put(edit);
    setEdit(null);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Productos de catálogo</Title>
        <Button leftSection={<IconPlus size={16} />} disabled={!marcas.length} onClick={() => setEdit(productoVacio(marcas[0]?.id))}>
          Nuevo producto
        </Button>
      </Group>
      <Group>
        <TextInput placeholder="Buscar referencia, nombre…" leftSection={<IconSearch size={14} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} w={280} />
        <Select placeholder="Todas las marcas" clearable data={marcas.map((m) => ({ value: String(m.id), label: m.nombre }))} value={fMarca} onChange={setFMarca} />
        <Select placeholder="Todas las categorías" clearable data={categorias} value={fCat} onChange={setFCat} />
        <Text size="sm" c="dimmed">{lista.length} productos</Text>
      </Group>
      <Paper withBorder>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={60} />
              <Table.Th>Referencia</Table.Th>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Marca</Table.Th>
              <Table.Th>Medidas</Table.Th>
              <Table.Th className="num">Precio base</Table.Th>
              <Table.Th className="num">Coste</Table.Th>
              <Table.Th className="num">PVP</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lista.map((p) => {
              const m = marcas.find((x) => x.id === p.marcaId);
              const c = m ? calcularPrecio(p.precio, m) : null;
              return (
                <Table.Tr key={p.id} className="clickable" onClick={() => setEdit(structuredClone(p))}>
                  <Table.Td>{p.imagen ? <img src={p.imagen} className="thumb" /> : null}</Table.Td>
                  <Table.Td fw={600}>{p.referencia}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{p.nombre}</Text>
                    <Group gap={4}>
                      {p.categoria && <Badge size="xs" variant="light" color="gray">{p.categoria}</Badge>}
                      {p.exterior && <Badge size="xs" variant="light" color="teal">Exterior</Badge>}
                      {p.fichaUrl && <Anchor size="xs" href={p.fichaUrl} target="_blank" onClick={(e) => e.stopPropagation()}>Ficha</Anchor>}
                    </Group>
                  </Table.Td>
                  <Table.Td>{m?.nombre}</Table.Td>
                  <Table.Td><Text size="xs">{medidasTexto(p)}</Text></Table.Td>
                  <Table.Td className="num">{eur(p.precio)}<Text size="xs" c="dimmed">{etiquetaPrecio(m).toLowerCase()}</Text></Table.Td>
                  <Table.Td className="num">{c && eur(c.coste)}</Table.Td>
                  <Table.Td className="num" fw={600}>{c && eur(c.pvp)}</Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Group gap={0} wrap="nowrap">
                      <ActionIcon variant="subtle" color="gray" title="Duplicar" onClick={() => { const { id, ...rest } = structuredClone(p); setEdit({ ...rest, referencia: rest.referencia + '-copia', demo: false }); }}><IconCopy size={16} /></ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() =>
                        modals.openConfirmModal({
                          title: `Eliminar ${p.referencia}`,
                          children: <Text size="sm">Las partidas de proyectos ya creadas con este producto se conservan.</Text>,
                          labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
                          confirmProps: { color: 'red' },
                          onConfirm: () => db.productos.delete(p.id!),
                        })}><IconTrash size={16} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {!lista.length && (
              <Table.Tr><Table.Td colSpan={9}><Text c="dimmed" ta="center" py="md">{marcas.length ? 'Sin productos' : 'Crea primero una marca'}</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>
      <Modal opened={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar producto' : 'Nuevo producto'} size={1000}>
        {edit && (
          <Stack>
            <ProductoForm value={edit} onChange={setEdit} marcas={marcas} />
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
