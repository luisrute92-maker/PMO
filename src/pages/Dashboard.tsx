import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Badge, Group, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { db, getAjustes } from '../db';
import type { EstadoOferta } from '../types';
import { ESTADO_OFERTA, FASE_LABEL, FASES } from '../types';
import { calcularAlertas, type TipoAlerta } from '../lib/alertas';
import { calcularTotales } from '../lib/calc';
import { eur, fecha, pct } from '../lib/format';
import { textoDias } from '../components/ui';
import { COLOR_FASE } from './Proyectos';

const TIPO_ALERTA: Record<TipoAlerta, [string, string]> = {
  fase: ['Fase', 'blue'],
  pedido: ['Pedido', 'violet'],
  cobro: ['Cobro', 'green'],
  pago: ['Pago', 'orange'],
  incidencia: ['Incidencia', 'red'],
};

function Kpi({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <Paper withBorder p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{k}</Text>
      <Text fw={700} size="xl">{v}</Text>
      {sub && <Text size="xs" c="dimmed">{sub}</Text>}
    </Paper>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const data = useLiveQuery(async () => {
    const [proyectos, partidas, costes, ofertas, pedidos, cobros, pagos, incidencias, marcas, aj] = await Promise.all([
      db.proyectos.toArray(), db.partidas.toArray(), db.costes.toArray(), db.ofertas.toArray(), db.pedidos.toArray(),
      db.cobros.toArray(), db.pagos.toArray(), db.incidencias.toArray(), db.marcas.toArray(), getAjustes(),
    ]);
    return { proyectos, partidas, costes, ofertas, pedidos, cobros, pagos, incidencias, marcas, aj };
  }, []);
  const [filtro, setFiltro] = useState<string>('todas');
  if (!data) return null;
  const { proyectos, partidas, costes, ofertas, cobros, pagos, aj } = data;

  const activos = proyectos.filter((p) => !p.cerrado);
  const tot = activos.map((p) => ({
    p,
    t: calcularTotales(partidas.filter((x) => x.proyectoId === p.id), costes.filter((x) => x.proyectoId === p.id), p.instalacion, p.descuento, p.iva),
  }));
  const venta = tot.reduce((s, x) => s + x.t.base, 0);
  const coste = tot.reduce((s, x) => s + x.t.coste, 0);
  const pendCobro = cobros.filter((c) => !c.fechaCobrada).reduce((s, c) => s + c.importe, 0);
  const pendPago = pagos.filter((c) => !c.fechaPagada).reduce((s, c) => s + c.importe, 0);

  const alertas = calcularAlertas(data, aj.diasAviso).filter((a) => filtro === 'todas' || a.tipo === filtro);
  const vencidas = alertas.filter((a) => a.dias < 0).length;

  // Pipeline: última versión de oferta de cada proyecto
  const ultimas = new Map<number, (typeof ofertas)[number]>();
  for (const o of ofertas) {
    const prev = ultimas.get(o.proyectoId);
    if (!prev || o.version > prev.version) ultimas.set(o.proyectoId, o);
  }
  const pipeline = (['borrador', 'enviada', 'ganada', 'perdida'] as EstadoOferta[]).map((e) => {
    const os = [...ultimas.values()].filter((o) => o.estado === e);
    return { e, n: os.length, importe: os.reduce((s, o) => s + calcularTotales(o.partidas, o.costes, o.instalacion, o.descuento, o.iva).base, 0) };
  });
  const resueltas = pipeline.filter((x) => x.e === 'ganada' || x.e === 'perdida').reduce((s, x) => s + x.n, 0);
  const ratio = resueltas ? (pipeline.find((x) => x.e === 'ganada')!.n / resueltas) * 100 : 0;
  const COLOR_OF: Record<EstadoOferta, string> = { borrador: 'gray', enviada: 'blue', ganada: 'green', perdida: 'red' };

  return (
    <Stack>
      <Title order={2}>Dashboard</Title>
      <SimpleGrid cols={6}>
        <Kpi k="Proyectos activos" v={String(activos.length)} sub={`${proyectos.length - activos.length} cerrados`} />
        <Kpi k="Venta (base imp.)" v={eur(venta)} sub="Proyectos activos, partidas actuales" />
        <Kpi k="Coste" v={eur(coste)} />
        <Kpi k="Margen" v={eur(venta - coste)} sub={venta ? pct(((venta - coste) / venta) * 100) + ' s/venta' : undefined} />
        <Kpi k="Pendiente de cobro" v={eur(pendCobro)} sub="IVA incl." />
        <Kpi k="Pendiente de pago" v={eur(pendPago)} sub="IVA incl." />
      </SimpleGrid>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">Proyectos por fase</Title>
        <SimpleGrid cols={8} spacing="xs">
          {FASES.map((f) => {
            const ps = activos.filter((p) => p.faseActual === f);
            return (
              <Stack key={f} gap={6}>
                <Group gap={6} justify="space-between" style={{ borderBottom: `3px solid var(--mantine-color-${COLOR_FASE[f]}-5)` }} pb={4}>
                  <Text size="xs" fw={700}>{FASE_LABEL[f]}</Text>
                  <Badge size="sm" color={COLOR_FASE[f]} variant="light">{ps.length}</Badge>
                </Group>
                {ps.map((p) => (
                  <Paper key={p.id} withBorder p={6} className="clickable" onClick={() => nav(`/proyectos/${p.id}`)}>
                    <Text size="xs" fw={600} lineClamp={2}>{p.cliente}</Text>
                    <Text size="xs" c="dimmed">{p.codigo}</Text>
                  </Paper>
                ))}
              </Stack>
            );
          })}
        </SimpleGrid>
      </Paper>

      <SimpleGrid cols={3}>
        <Paper withBorder p="md" style={{ gridColumn: 'span 2' }}>
          <Group justify="space-between" mb="sm">
            <Title order={4}>Alertas de plazos {vencidas > 0 && <Badge color="red" ml={4}>{vencidas} vencidas</Badge>}</Title>
            <SegmentedControl size="xs" value={filtro} onChange={setFiltro}
              data={[{ value: 'todas', label: 'Todas' }, ...Object.entries(TIPO_ALERTA).map(([value, [label]]) => ({ value, label }))]} />
          </Group>
          <Text size="xs" c="dimmed" mb="xs">Vencidas y próximas {aj.diasAviso} días (configurable en Ajustes).</Text>
          <Table highlightOnHover>
            <Table.Tbody>
              {alertas.map((a, i) => (
                <Table.Tr key={i} className="clickable" onClick={() => nav(`/proyectos/${a.proyectoId}/${a.tipo === 'fase' ? 'fases' : a.tipo === 'pedido' ? 'pedidos' : a.tipo === 'incidencia' ? 'entrega' : 'finanzas'}`)}>
                  <Table.Td w={100}><Badge color={TIPO_ALERTA[a.tipo][1]} variant="light">{TIPO_ALERTA[a.tipo][0]}</Badge></Table.Td>
                  <Table.Td><Text size="sm">{a.texto}</Text><Text size="xs" c="dimmed">{a.proyecto}</Text></Table.Td>
                  <Table.Td w={90}>{fecha(a.fecha)}</Table.Td>
                  <Table.Td w={130}><Text size="sm" fw={600} c={a.dias < 0 ? 'red' : 'orange'}>{textoDias(a.dias)}</Text></Table.Td>
                </Table.Tr>
              ))}
              {!alertas.length && <Table.Tr><Table.Td><Text c="dimmed" ta="center" py="md">Sin alertas</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">Pipeline de ofertas</Title>
          <Table>
            <Table.Thead>
              <Table.Tr><Table.Th>Estado</Table.Th><Table.Th className="num">Nº</Table.Th><Table.Th className="num">Importe (base)</Table.Th></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pipeline.map((x) => (
                <Table.Tr key={x.e}>
                  <Table.Td><Badge color={COLOR_OF[x.e]} variant="light">{ESTADO_OFERTA[x.e]}</Badge></Table.Td>
                  <Table.Td className="num">{x.n}</Table.Td>
                  <Table.Td className="num">{eur(x.importe)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="sm" mt="sm">Ratio de éxito: <b>{resueltas ? pct(ratio) : '—'}</b></Text>
          <Text size="xs" c="dimmed">Se cuenta la última versión de oferta de cada proyecto.</Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">Resumen económico por proyecto</Title>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Proyecto</Table.Th>
              <Table.Th>Fase</Table.Th>
              <Table.Th className="num">Venta</Table.Th>
              <Table.Th className="num">Coste</Table.Th>
              <Table.Th className="num">Margen</Table.Th>
              <Table.Th className="num">Pend. cobro</Table.Th>
              <Table.Th className="num">Pend. pago</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tot.map(({ p, t }) => (
              <Table.Tr key={p.id} className="clickable" onClick={() => nav(`/proyectos/${p.id}`)}>
                <Table.Td><Text size="sm" fw={500}>{p.cliente}</Text><Text size="xs" c="dimmed">{p.codigo}</Text></Table.Td>
                <Table.Td><Badge color={COLOR_FASE[p.faseActual]} variant="light">{FASE_LABEL[p.faseActual]}</Badge></Table.Td>
                <Table.Td className="num">{eur(t.base)}</Table.Td>
                <Table.Td className="num">{eur(t.coste)}</Table.Td>
                <Table.Td className="num">{eur(t.margen)} <Text span size="xs" c="dimmed">({pct(t.margenPct)})</Text></Table.Td>
                <Table.Td className="num">{eur(cobros.filter((c) => c.proyectoId === p.id && !c.fechaCobrada).reduce((s, c) => s + c.importe, 0))}</Table.Td>
                <Table.Td className="num">{eur(pagos.filter((c) => c.proyectoId === p.id && !c.fechaPagada).reduce((s, c) => s + c.importe, 0))}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}
