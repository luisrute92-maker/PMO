import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Anchor, Badge, Button, Group, Menu, Paper, Select, SimpleGrid, Stack, Tabs, Text, Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconFileTypePdf } from '@tabler/icons-react';
import { borrarProyecto, db } from '../../db';
import type { Fase, Proyecto } from '../../types';
import { FASE_LABEL, FASES } from '../../types';
import { calcularTotales } from '../../lib/calc';
import { eur, pct, hoy } from '../../lib/format';
import { pdfActa, pdfInforme } from '../../lib/pdf';
import { COLOR_FASE } from '../Proyectos';
import TabDatos from './TabDatos';
import TabFases from './TabFases';
import TabPartidas from './TabPartidas';
import TabCostes from './TabCostes';
import TabOfertas from './TabOfertas';
import TabPedidos from './TabPedidos';
import TabFinanzas from './TabFinanzas';
import TabEntrega from './TabEntrega';

export interface TabProps {
  p: Proyecto;
  upd: (c: Partial<Proyecto>) => Promise<unknown>;
}

export async function ejecutar(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    notifications.show({ color: 'red', title: 'Error', message: (e as Error).message });
  }
}

/** Cambia la fase actual y registra fechas reales de inicio/fin si están vacías */
export async function cambiarFase(p: Proyecto, fase: Fase) {
  const iNueva = FASES.indexOf(fase);
  const fases = p.fases.map((f, i) => {
    if (i < iNueva) return { ...f, inicioReal: f.inicioReal ?? hoy(), finReal: f.finReal ?? hoy() };
    if (i === iNueva) return { ...f, inicioReal: f.inicioReal ?? hoy() };
    return f;
  });
  await db.proyectos.update(p.id!, { faseActual: fase, fases });
}

export default function ProyectoPage() {
  const params = useParams();
  const id = Number(params.id);
  const tab = params['*'] || 'datos';
  const nav = useNavigate();
  const p = useLiveQuery(() => db.proyectos.get(id), [id]);
  const partidas = useLiveQuery(() => db.partidas.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const costes = useLiveQuery(() => db.costes.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const cobros = useLiveQuery(() => db.cobros.where('proyectoId').equals(id).toArray(), [id]) ?? [];
  const pagos = useLiveQuery(() => db.pagos.where('proyectoId').equals(id).toArray(), [id]) ?? [];

  if (p === undefined) return <Text c="dimmed">Cargando…</Text>;
  if (!p) return <Text>Proyecto no encontrado. <Anchor onClick={() => nav('/proyectos')}>Volver</Anchor></Text>;

  const upd = (c: Partial<Proyecto>) => db.proyectos.update(id, c);
  const t = calcularTotales(partidas, costes, p.instalacion, p.descuento, p.iva);
  const pendCobro = cobros.filter((c) => !c.fechaCobrada).reduce((s, c) => s + c.importe, 0);
  const pendPago = pagos.filter((c) => !c.fechaPagada).reduce((s, c) => s + c.importe, 0);

  const cambioFase = async (v: string | null) => {
    if (!v) return;
    const fase = v as Fase;
    if (FASES.indexOf(fase) > FASES.indexOf(p.faseActual)) {
      modals.openConfirmModal({
        title: `Pasar a ${FASE_LABEL[fase]}`,
        children: <Text size="sm">Se rellenará con la fecha de hoy el fin real de las fases anteriores y el inicio real de «{FASE_LABEL[fase]}» si están vacíos.</Text>,
        labels: { confirm: 'Aceptar', cancel: 'Cancelar' },
        onConfirm: () => cambiarFase(p, fase),
      });
    } else {
      await upd({ faseActual: fase });
    }
  };

  const borrar = () =>
    modals.openConfirmModal({
      title: `Eliminar proyecto ${p.codigo}`,
      children: <Text size="sm">Se eliminarán el proyecto y todas sus partidas, ofertas, pedidos, cobros, pagos e incidencias. Esta acción no se puede deshacer.</Text>,
      labels: { confirm: 'Eliminar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await borrarProyecto(id);
        nav('/proyectos');
      },
    });

  const props: TabProps = { p, upd };

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            <Anchor size="sm" onClick={() => nav('/proyectos')}>Proyectos</Anchor>
            <Text size="sm" c="dimmed">/ {p.codigo}</Text>
          </Group>
          <Title order={2}>{p.cliente}</Title>
          <Group gap="xs">
            <Text c="dimmed">{p.nombre}{p.ubicacion ? ` · ${p.ubicacion}` : ''}</Text>
            <Badge variant="outline" color="gray">{p.origen === 'propia' ? 'Prescripción propia' : 'Prescripción recibida'}</Badge>
            {p.cerrado && <Badge color="dark">Cerrado</Badge>}
          </Group>
        </Stack>
        <Group>
          <Select
            label="Fase actual"
            w={220}
            allowDeselect={false}
            data={FASES.map((f, i) => ({ value: f, label: `${i + 1}. ${FASE_LABEL[f]}` }))}
            value={p.faseActual}
            onChange={cambioFase}
            leftSection={<span style={{ width: 8, height: 8, borderRadius: 4, background: `var(--mantine-color-${COLOR_FASE[p.faseActual]}-6)` }} />}
          />
          <Menu position="bottom-end">
            <Menu.Target>
              <Button mt={24} variant="default" leftSection={<IconFileTypePdf size={16} />} rightSection={<IconChevronDown size={14} />}>Documentos</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => ejecutar(() => pdfInforme(id))}>Informe de estado del proyecto</Menu.Item>
              <Menu.Item onClick={() => ejecutar(() => pdfActa(id))}>Acta de entrega</Menu.Item>
              <Menu.Divider />
              <Menu.Label>Oferta y pedidos: desde sus pestañas</Menu.Label>
            </Menu.Dropdown>
          </Menu>
          <Menu position="bottom-end">
            <Menu.Target>
              <Button mt={24} variant="subtle" color="gray" rightSection={<IconChevronDown size={14} />}>Más</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => upd({ cerrado: !p.cerrado })}>{p.cerrado ? 'Reabrir proyecto' : 'Cerrar / archivar proyecto'}</Menu.Item>
              <Menu.Item color="red" onClick={borrar}>Eliminar proyecto</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <SimpleGrid cols={6}>
        {[
          ['Venta (base imp.)', eur(t.base)],
          ['Coste total', eur(t.coste)],
          ['Margen', `${eur(t.margen)}`, pct(t.margenPct) + ' s/venta'],
          ['Total con IVA', eur(t.total)],
          ['Pendiente de cobro', eur(pendCobro)],
          ['Pendiente de pago', eur(pendPago)],
        ].map(([k, v, sub]) => (
          <Paper key={k} withBorder p="sm">
            <Text size="xs" c="dimmed">{k}</Text>
            <Text fw={700} size="lg">{v}</Text>
            {sub && <Text size="xs" c="dimmed">{sub}</Text>}
          </Paper>
        ))}
      </SimpleGrid>

      <Tabs value={tab} onChange={(v) => nav(`/proyectos/${id}/${v === 'datos' ? '' : v}`)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="datos">Datos</Tabs.Tab>
          <Tabs.Tab value="fases">Seguimiento</Tabs.Tab>
          <Tabs.Tab value="partidas">Partidas ({partidas.length})</Tabs.Tab>
          <Tabs.Tab value="costes">Costes e instalación</Tabs.Tab>
          <Tabs.Tab value="ofertas">Ofertas</Tabs.Tab>
          <Tabs.Tab value="pedidos">Pedidos</Tabs.Tab>
          <Tabs.Tab value="finanzas">Cobros y pagos</Tabs.Tab>
          <Tabs.Tab value="entrega">Entrega</Tabs.Tab>
        </Tabs.List>
        <Paper withBorder p="md" mt="sm">
          <Tabs.Panel value="datos"><TabDatos {...props} /></Tabs.Panel>
          <Tabs.Panel value="fases"><TabFases {...props} /></Tabs.Panel>
          <Tabs.Panel value="partidas"><TabPartidas {...props} /></Tabs.Panel>
          <Tabs.Panel value="costes"><TabCostes {...props} /></Tabs.Panel>
          <Tabs.Panel value="ofertas"><TabOfertas {...props} /></Tabs.Panel>
          <Tabs.Panel value="pedidos"><TabPedidos {...props} /></Tabs.Panel>
          <Tabs.Panel value="finanzas"><TabFinanzas {...props} /></Tabs.Panel>
          <Tabs.Panel value="entrega"><TabEntrega {...props} /></Tabs.Panel>
        </Paper>
      </Tabs>
    </Stack>
  );
}
