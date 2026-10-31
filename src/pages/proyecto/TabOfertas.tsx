import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ActionIcon, Button, Group, Modal, Select, Stack, Table, Text, Textarea, Alert } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconFileTypePdf, IconPlus, IconTrash, IconNotes } from '@tabler/icons-react';
import { db } from '../../db';
import type { EstadoOferta, Oferta } from '../../types';
import { ESTADO_OFERTA } from '../../types';
import { calcularTotales } from '../../lib/calc';
import { eur, fecha, pct } from '../../lib/format';
import { cambiarEstadoOferta, crearVersionOferta } from '../../lib/ops';
import { pdfOferta } from '../../lib/pdf';
import { DateIn } from '../../components/ui';
import { ejecutar, type TabProps } from './ProyectoPage';

export default function TabOfertas({ p }: TabProps) {
  const id = p.id!;
  const ofertas = useLiveQuery(() => db.ofertas.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const partidas = useLiveQuery(() => db.partidas.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const costes = useLiveQuery(() => db.costes.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const [notas, setNotas] = useState<Oferta | null>(null);
  const actual = calcularTotales(partidas, costes, p.instalacion, p.descuento, p.iva);
  const lista = [...ofertas].sort((a, b) => b.version - a.version);

  const nueva = () =>
    modals.openConfirmModal({
      title: 'Nueva versión de oferta',
      children: (
        <Text size="sm">
          Se guardará una copia fija de las {partidas.length} partidas, costes e instalación actuales (venta {eur(actual.base)} sin IVA). Los cambios posteriores en
          las partidas no modificarán esta versión.
        </Text>
      ),
      labels: { confirm: 'Crear versión', cancel: 'Cancelar' },
      onConfirm: () => ejecutar(() => crearVersionOferta(id)),
    });

  const setEstado = (o: Oferta, estado: EstadoOferta) => {
    if (estado === 'ganada') {
      const otras = ofertas.filter((x) => x.id !== o.id && (x.estado === 'enviada' || x.estado === 'borrador'));
      if (otras.length) {
        modals.openConfirmModal({
          title: 'Oferta ganada',
          children: <Text size="sm">¿Marcar también como perdidas las otras {otras.length} versiones en borrador/enviadas?</Text>,
          labels: { confirm: 'Sí', cancel: 'No, dejarlas' },
          onConfirm: async () => {
            await cambiarEstadoOferta(o, 'ganada');
            for (const x of otras) await cambiarEstadoOferta(x, 'perdida');
          },
          onCancel: () => cambiarEstadoOferta(o, 'ganada'),
        });
        return;
      }
    }
    cambiarEstadoOferta(o, estado);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">Partidas actuales: venta {eur(actual.base)} · margen {pct(actual.margenPct)}</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={nueva} disabled={!partidas.length}>Nueva versión desde partidas actuales</Button>
      </Group>
      {ofertas.some((o) => o.estado === 'ganada') && (
        <Alert color="green" variant="light">La última versión ganada es la base para generar los pedidos a marcas.</Alert>
      )}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Número</Table.Th>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Enviada</Table.Th>
            <Table.Th>Resolución</Table.Th>
            <Table.Th className="num">Partidas</Table.Th>
            <Table.Th className="num">Base imponible</Table.Th>
            <Table.Th className="num">Total con IVA</Table.Th>
            <Table.Th className="num">Margen</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lista.map((o) => {
            const t = calcularTotales(o.partidas, o.costes, o.instalacion, o.descuento, o.iva);
            return (
              <Table.Tr key={o.id}>
                <Table.Td fw={600}>{o.numero}{o.notas && <Text size="xs" c="dimmed" lineClamp={1} maw={220}>{o.notas}</Text>}</Table.Td>
                <Table.Td>{fecha(o.fecha)}</Table.Td>
                <Table.Td>
                  <Select size="xs" w={120} allowDeselect={false} value={o.estado}
                    data={Object.entries(ESTADO_OFERTA).map(([value, label]) => ({ value, label }))}
                    onChange={(v) => v && setEstado(o, v as EstadoOferta)} />
                </Table.Td>
                <Table.Td><DateIn size="xs" value={o.fechaEnvio} onChange={(v) => db.ofertas.update(o.id!, { fechaEnvio: v })} /></Table.Td>
                <Table.Td><DateIn size="xs" value={o.fechaResolucion} onChange={(v) => db.ofertas.update(o.id!, { fechaResolucion: v })} /></Table.Td>
                <Table.Td className="num">{o.partidas.length}</Table.Td>
                <Table.Td className="num">{eur(t.base)}</Table.Td>
                <Table.Td className="num" fw={600}>{eur(t.total)}</Table.Td>
                <Table.Td className="num">{pct(t.margenPct)}</Table.Td>
                <Table.Td>
                  <Group gap={0} wrap="nowrap">
                    <ActionIcon variant="subtle" title="PDF" onClick={() => ejecutar(() => pdfOferta(o.id!))}><IconFileTypePdf size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="gray" title="Observaciones" onClick={() => setNotas({ ...o })}><IconNotes size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => modals.openConfirmModal({
                      title: `Eliminar ${o.numero}`, labels: { confirm: 'Eliminar', cancel: 'Cancelar' }, confirmProps: { color: 'red' },
                      onConfirm: () => db.ofertas.delete(o.id!),
                    })}><IconTrash size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
          {!lista.length && <Table.Tr><Table.Td colSpan={10}><Text c="dimmed" ta="center" py="md">Sin ofertas. Crea la primera versión cuando las partidas estén listas.</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <Modal opened={!!notas} onClose={() => setNotas(null)} title={`Observaciones ${notas?.numero ?? ''}`}>
        {notas && (
          <Stack>
            <Textarea autosize minRows={4} value={notas.notas} onChange={(e) => setNotas({ ...notas, notas: e.currentTarget.value })}
              description="Aparecen en el PDF de la oferta" />
            <Group justify="flex-end">
              <Button onClick={async () => { await db.ofertas.update(notas.id!, { notas: notas.notas }); setNotas(null); }}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
