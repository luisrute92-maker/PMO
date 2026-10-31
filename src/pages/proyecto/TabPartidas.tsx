import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ActionIcon, Autocomplete, Button, Checkbox, FileButton, Group, Image, Modal, Paper, Select, SimpleGrid, Stack, Table, Text,
  TextInput, Textarea, Badge, Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconArrowDown, IconArrowUp, IconCopy, IconPlus, IconSearch, IconTrash, IconPencil } from '@tabler/icons-react';
import { db } from '../../db';
import type { Marca, Partida, Producto } from '../../types';
import { NumIn } from '../../components/ui';
import { calcularPrecio, calcularTotales, recalcularPartida } from '../../lib/calc';
import { eur, medidasTexto, num, pct } from '../../lib/format';
import { comprimirImagen } from '../../lib/imagen';
import type { TabProps } from './ProyectoPage';
import { etiquetaPrecio } from '../Productos';

function partidaDesdeProducto(prod: Producto, proyectoId: number, orden: number): Partida {
  return {
    proyectoId, productoId: prod.id, marcaId: prod.marcaId, orden, zona: '', referencia: prod.referencia, nombre: prod.nombre,
    descripcion: prod.descripcion, medidas: medidasTexto(prod), acabado: '', cantidad: 1, unidad: prod.unidad || 'ud',
    precioBase: prod.precio, suplemento: 0, costeUnit: 0, costeManual: false, pvpUnit: 0, pvpManual: false, imagen: prod.imagen, notas: '',
  };
}

function PartidaForm({ value, onChange, marcas, producto, zonas }: {
  value: Partida; onChange: (p: Partida) => void; marcas: Marca[]; producto?: Producto; zonas: string[];
}) {
  const p = value;
  const m = marcas.find((x) => x.id === p.marcaId);
  const calc = m ? calcularPrecio(p.precioBase + p.suplemento, m) : null;
  // selección de acabados del catálogo
  const [sel, setSel] = useState<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    producto?.acabados.forEach((g) => {
      const found = g.opciones.find((o) => p.acabado.includes(`${g.nombre}: ${o.nombre}`));
      if (found) r[g.nombre] = found.nombre;
    });
    return r;
  });
  const aplicarSel = (nueva: Record<string, string>) => {
    setSel(nueva);
    if (!producto) return;
    const partes: string[] = [];
    let sup = 0;
    for (const g of producto.acabados) {
      const o = g.opciones.find((x) => x.nombre === nueva[g.nombre]);
      if (o) {
        partes.push(`${g.nombre}: ${o.nombre}`);
        sup += o.suplemento;
      }
    }
    onChange(recalcularPartida({ ...p, acabado: partes.join(' · '), suplemento: sup }, m));
  };
  const set = (c: Partial<Partida>) => onChange(recalcularPartida({ ...p, ...c }, marcas.find((x) => x.id === (c.marcaId ?? p.marcaId))));

  return (
    <SimpleGrid cols={2} spacing="lg">
      <Stack gap="xs">
        {!producto && <Badge variant="light" color="grape">Producto a medida (solo para este proyecto)</Badge>}
        <SimpleGrid cols={2}>
          <Autocomplete label="Zona / estancia" data={zonas} value={p.zona} onChange={(v) => set({ zona: v })} />
          <Select label="Marca" required disabled={!!producto} data={marcas.map((x) => ({ value: String(x.id), label: x.nombre }))}
            value={p.marcaId ? String(p.marcaId) : null} onChange={(v) => set({ marcaId: Number(v) })} />
          <TextInput label="Referencia" value={p.referencia} onChange={(e) => set({ referencia: e.currentTarget.value })} />
          <TextInput label="Nombre" value={p.nombre} onChange={(e) => set({ nombre: e.currentTarget.value })} />
        </SimpleGrid>
        <Textarea label="Descripción" autosize minRows={2} value={p.descripcion} onChange={(e) => set({ descripcion: e.currentTarget.value })} />
        <TextInput label="Medidas" value={p.medidas} onChange={(e) => set({ medidas: e.currentTarget.value })} />
        {producto && producto.acabados.length > 0 && (
          <SimpleGrid cols={2}>
            {producto.acabados.map((g) => (
              <Select key={g.nombre} label={g.nombre} clearable value={sel[g.nombre] ?? null}
                data={g.opciones.map((o) => ({ value: o.nombre, label: o.suplemento ? `${o.nombre} (+${eur(o.suplemento)})` : o.nombre }))}
                onChange={(v) => aplicarSel({ ...sel, [g.nombre]: v ?? '' })} />
            ))}
          </SimpleGrid>
        )}
        <TextInput label="Acabado (texto en oferta y pedido)" value={p.acabado} onChange={(e) => set({ acabado: e.currentTarget.value })} />
      </Stack>
      <Stack gap="xs">
        <SimpleGrid cols={2}>
          <NumIn label="Cantidad" value={p.cantidad} onChange={(v) => set({ cantidad: v })} />
          <TextInput label="Unidad" value={p.unidad} onChange={(e) => set({ unidad: e.currentTarget.value })} />
          <NumIn label={`${etiquetaPrecio(m)} base (ud)`} suffix=" €" value={p.precioBase} onChange={(v) => set({ precioBase: v })} />
          <NumIn label="Suplemento acabados (ud)" suffix=" €" value={p.suplemento} onChange={(v) => set({ suplemento: v })} />
        </SimpleGrid>
        <Paper withBorder p="sm" bg="gray.0">
          <Text size="xs" c="dimmed" mb={4}>Regla de {m?.nombre ?? '—'}: {calc ? `coste ${eur(calc.coste)} · PVP ${eur(calc.pvp)}` : 'selecciona marca'}</Text>
          <SimpleGrid cols={2}>
            <Stack gap={4}>
              <NumIn label="Coste unitario" suffix=" €" value={p.costeUnit} disabled={!p.costeManual} onChange={(v) => set({ costeUnit: v })} />
              <Checkbox size="xs" label="Editar manualmente" checked={p.costeManual} onChange={(e) => set({ costeManual: e.currentTarget.checked })} />
            </Stack>
            <Stack gap={4}>
              <NumIn label="PVP unitario" suffix=" €" value={p.pvpUnit} disabled={!p.pvpManual} onChange={(v) => set({ pvpUnit: v })} />
              <Checkbox size="xs" label="Editar manualmente" checked={p.pvpManual} onChange={(e) => set({ pvpManual: e.currentTarget.checked })} />
            </Stack>
          </SimpleGrid>
          <Text size="sm" mt="xs">
            Total venta <b>{eur(p.pvpUnit * p.cantidad)}</b> · coste {eur(p.costeUnit * p.cantidad)} · margen{' '}
            {p.pvpUnit ? pct(((p.pvpUnit - p.costeUnit) / p.pvpUnit) * 100) : '—'}
          </Text>
        </Paper>
        <Group align="flex-start">
          {p.imagen ? <Image src={p.imagen} w={120} h={90} fit="contain" bg="gray.1" radius="sm" /> : <Paper w={120} h={90} bg="gray.1" />}
          <Stack gap={4}>
            <FileButton accept="image/*" onChange={async (f) => f && set({ imagen: await comprimirImagen(f) })}>
              {(props) => <Button size="xs" variant="light" {...props}>Imagen</Button>}
            </FileButton>
            {p.imagen && <Button size="xs" variant="subtle" color="red" onClick={() => set({ imagen: undefined })}>Quitar</Button>}
          </Stack>
        </Group>
        <Textarea label="Notas internas" autosize minRows={2} value={p.notas} onChange={(e) => set({ notas: e.currentTarget.value })} />
      </Stack>
    </SimpleGrid>
  );
}

function SelectorCatalogo({ marcas, onPick }: { marcas: Marca[]; onPick: (p: Producto) => void }) {
  const productos = useLiveQuery(() => db.productos.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [fM, setFM] = useState<string | null>(null);
  const lista = productos
    .filter((p) => !fM || p.marcaId === Number(fM))
    .filter((p) => !q || `${p.referencia} ${p.nombre} ${p.categoria}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Stack>
      <Group>
        <TextInput autoFocus placeholder="Buscar…" leftSection={<IconSearch size={14} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ flex: 1 }} />
        <Select placeholder="Marca" clearable data={marcas.map((m) => ({ value: String(m.id), label: m.nombre }))} value={fM} onChange={setFM} />
      </Group>
      <Table highlightOnHover>
        <Table.Tbody>
          {lista.map((p) => {
            const m = marcas.find((x) => x.id === p.marcaId);
            return (
              <Table.Tr key={p.id} className="clickable" onClick={() => onPick(p)}>
                <Table.Td w={60}>{p.imagen && <img src={p.imagen} className="thumb" />}</Table.Td>
                <Table.Td fw={600}>{p.referencia}</Table.Td>
                <Table.Td>{p.nombre}<Text size="xs" c="dimmed">{p.categoria}</Text></Table.Td>
                <Table.Td>{m?.nombre}</Table.Td>
                <Table.Td className="num">{m && eur(calcularPrecio(p.precio, m).pvp)}</Table.Td>
              </Table.Tr>
            );
          })}
          {!lista.length && <Table.Tr><Table.Td><Text c="dimmed">Sin resultados</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

export default function TabPartidas({ p }: TabProps) {
  const id = p.id!;
  const partidas = useLiveQuery(() => db.partidas.where('proyectoId').equals(id).sortBy('orden'), [id]) ?? [];
  const costes = useLiveQuery(() => db.costes.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const marcas = useLiveQuery(() => db.marcas.orderBy('nombre').toArray(), []) ?? [];
  const productos = useLiveQuery(() => db.productos.toArray(), []) ?? [];
  const [picker, setPicker] = useState(false);
  const [edit, setEdit] = useState<Partida | null>(null);
  const [agrupar, setAgrupar] = useState(true);

  const zonas = useMemo(() => [...new Set(partidas.map((x) => x.zona).filter(Boolean))], [partidas]);
  const t = calcularTotales(partidas, costes, p.instalacion, p.descuento, p.iva);
  const siguienteOrden = partidas.length ? Math.max(...partidas.map((x) => x.orden)) + 1 : 0;

  const guardar = async () => {
    if (!edit) return;
    if (!edit.marcaId) return notifications.show({ color: 'red', message: 'La marca es obligatoria (se usa para la regla de precio y el pedido)' });
    await db.partidas.put(edit);
    setEdit(null);
  };

  const mover = async (i: number, dir: -1 | 1) => {
    const a = partidas[i];
    const b = partidas[i + dir];
    if (!a || !b) return;
    await db.partidas.bulkPut([{ ...a, orden: b.orden }, { ...b, orden: a.orden }]);
  };

  const filas = agrupar ? [...partidas].sort((a, b) => (zonas.indexOf(a.zona) - zonas.indexOf(b.zona)) || a.orden - b.orden) : partidas;
  let zonaPrev: string | null = null;
  const costesPartida = (pid?: number) => costes.filter((c) => c.partidaId === pid).reduce((s, c) => s + c.coste, 0);

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setPicker(true)} disabled={!marcas.length}>Añadir del catálogo</Button>
          <Button variant="light" leftSection={<IconPlus size={16} />} disabled={!marcas.length}
            onClick={() => setEdit({ ...partidaDesdeProducto({ marcaId: marcas[0]?.id ?? 0, referencia: '', nombre: '', descripcion: '', categoria: '', coleccion: '', acabados: [], precio: 0, unidad: 'ud', certificaciones: '', exterior: false, fichaUrl: '', notas: '' }, id, siguienteOrden), productoId: undefined })}>
            Partida a medida
          </Button>
        </Group>
        <Checkbox label="Agrupar por zona" checked={agrupar} onChange={(e) => setAgrupar(e.currentTarget.checked)} />
      </Group>
      <Table className="sticky-head">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={56} />
            <Table.Th>Zona</Table.Th>
            <Table.Th>Producto</Table.Th>
            <Table.Th>Acabado</Table.Th>
            <Table.Th className="num">Cant.</Table.Th>
            <Table.Th className="num">Coste ud.</Table.Th>
            <Table.Th className="num">PVP ud.</Table.Th>
            <Table.Th className="num">Total coste</Table.Th>
            <Table.Th className="num">Total venta</Table.Th>
            <Table.Th className="num">Margen</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map((x, i) => {
            const m = marcas.find((mm) => mm.id === x.marcaId);
            const cab = agrupar && x.zona !== zonaPrev;
            zonaPrev = x.zona;
            const zonaPartidas = partidas.filter((z) => z.zona === x.zona);
            const extra = costesPartida(x.id);
            return [
              cab && (
                <Table.Tr key={`z-${x.zona}`} bg="gray.0">
                  <Table.Td colSpan={8} fw={700}>{x.zona || 'Sin zona'}</Table.Td>
                  <Table.Td className="num" fw={700}>{eur(zonaPartidas.reduce((s, z) => s + z.pvpUnit * z.cantidad, 0))}</Table.Td>
                  <Table.Td colSpan={2} />
                </Table.Tr>
              ),
              <Table.Tr key={x.id}>
                <Table.Td>{x.imagen && <img src={x.imagen} className="thumb" />}</Table.Td>
                <Table.Td>{x.zona}</Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600}>{x.referencia} {!x.productoId && <Badge size="xs" color="grape" variant="light">a medida</Badge>}</Text>
                  <Text size="xs">{x.nombre}</Text>
                  <Text size="xs" c="dimmed">{m?.nombre ?? '⚠ sin marca'}</Text>
                </Table.Td>
                <Table.Td><Text size="xs">{x.acabado}</Text></Table.Td>
                <Table.Td className="num">{num(x.cantidad)} {x.unidad}</Table.Td>
                <Table.Td className="num">
                  {eur(x.costeUnit)}{x.costeManual && <Text span c="orange" size="xs"> M</Text>}
                </Table.Td>
                <Table.Td className="num">
                  {eur(x.pvpUnit)}{x.pvpManual && <Tooltip label="PVP editado manualmente"><Text span c="orange" size="xs"> M</Text></Tooltip>}
                </Table.Td>
                <Table.Td className="num">
                  {eur(x.costeUnit * x.cantidad)}
                  {extra > 0 && <Text size="xs" c="dimmed">+{eur(extra)} adic.</Text>}
                </Table.Td>
                <Table.Td className="num" fw={600}>{eur(x.pvpUnit * x.cantidad)}</Table.Td>
                <Table.Td className="num">{x.pvpUnit ? pct(((x.pvpUnit - x.costeUnit) / x.pvpUnit) * 100) : '—'}</Table.Td>
                <Table.Td>
                  <Group gap={0} wrap="nowrap">
                    {!agrupar && <>
                      <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => mover(i, -1)}><IconArrowUp size={14} /></ActionIcon>
                      <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => mover(i, 1)}><IconArrowDown size={14} /></ActionIcon>
                    </>}
                    <ActionIcon size="sm" variant="subtle" onClick={() => setEdit({ ...x })}><IconPencil size={14} /></ActionIcon>
                    <ActionIcon size="sm" variant="subtle" color="gray" title="Duplicar" onClick={() => { const { id: _i, ...r } = x; db.partidas.add({ ...r, orden: siguienteOrden, demo: false }); }}><IconCopy size={14} /></ActionIcon>
                    <ActionIcon size="sm" variant="subtle" color="red" onClick={() => modals.openConfirmModal({
                      title: 'Eliminar partida', children: <Text size="sm">{x.referencia} — {x.nombre}</Text>,
                      labels: { confirm: 'Eliminar', cancel: 'Cancelar' }, confirmProps: { color: 'red' },
                      onConfirm: async () => {
                        await db.partidas.delete(x.id!);
                        const cs = costes.filter((c) => c.partidaId === x.id);
                        await db.costes.bulkPut(cs.map((c) => ({ ...c, partidaId: undefined })));
                      },
                    })}><IconTrash size={14} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>,
            ];
          })}
          {!partidas.length && <Table.Tr><Table.Td colSpan={11}><Text c="dimmed" ta="center" py="md">Sin partidas</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Group justify="flex-end">
        <Paper withBorder p="md" w={420}>
          <Table withRowBorders={false} verticalSpacing={2}>
            <Table.Tbody>
              <Table.Tr><Table.Td>Partidas</Table.Td><Table.Td className="num">{eur(t.ventaPartidas)}</Table.Td><Table.Td className="num" c="dimmed">{eur(t.costePartidas)}</Table.Td></Table.Tr>
              <Table.Tr><Table.Td>Costes adicionales</Table.Td><Table.Td className="num">{eur(t.ventaCostes)}</Table.Td><Table.Td className="num" c="dimmed">{eur(t.costeCostes)}</Table.Td></Table.Tr>
              <Table.Tr><Table.Td>Instalación</Table.Td><Table.Td className="num">{eur(t.ventaInstalacion)}</Table.Td><Table.Td className="num" c="dimmed">{eur(t.costeInstalacion)}</Table.Td></Table.Tr>
              {p.descuento > 0 && <Table.Tr><Table.Td>Descuento {pct(p.descuento)}</Table.Td><Table.Td className="num">−{eur(t.descuentoImporte)}</Table.Td><Table.Td /></Table.Tr>}
              <Table.Tr style={{ borderTop: '1px solid #ddd' }}><Table.Td fw={700}>Venta (base) / coste</Table.Td><Table.Td className="num" fw={700}>{eur(t.base)}</Table.Td><Table.Td className="num" fw={700}>{eur(t.coste)}</Table.Td></Table.Tr>
              <Table.Tr><Table.Td fw={700}>Margen</Table.Td><Table.Td className="num" fw={700} colSpan={2}>{eur(t.margen)} ({pct(t.margenPct)} s/venta)</Table.Td></Table.Tr>
              <Table.Tr><Table.Td>IVA {pct(p.iva)}</Table.Td><Table.Td className="num">{eur(t.ivaImporte)}</Table.Td><Table.Td /></Table.Tr>
              <Table.Tr><Table.Td fw={700}>Total con IVA</Table.Td><Table.Td className="num" fw={700}>{eur(t.total)}</Table.Td><Table.Td /></Table.Tr>
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" mt={4}>Columna gris = coste. Descuento e IVA se configuran en «Datos».</Text>
        </Paper>
      </Group>

      <Modal opened={picker} onClose={() => setPicker(false)} title="Añadir producto del catálogo" size="xl">
        <SelectorCatalogo marcas={marcas} onPick={(prod) => {
          setPicker(false);
          const m = marcas.find((x) => x.id === prod.marcaId);
          setEdit(recalcularPartida(partidaDesdeProducto(prod, id, siguienteOrden), m));
        }} />
      </Modal>
      <Modal opened={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar partida' : 'Nueva partida'} size={1000}>
        {edit && (
          <Stack>
            <PartidaForm value={edit} onChange={setEdit} marcas={marcas} zonas={zonas}
              producto={edit.productoId ? productos.find((x) => x.id === edit.productoId) : undefined} />
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
