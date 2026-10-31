import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Alert, Button, FileButton, Group, Paper, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconUpload, IconDatabaseOff, IconDatabasePlus } from '@tabler/icons-react';
import { AJUSTES_DEFECTO, db, getAjustes } from '../db';
import type { Ajustes } from '../types';
import { NumIn } from '../components/ui';
import { exportarJSON, importarJSON } from '../lib/backup';
import { borrarDatosEjemplo, cargarDatosEjemplo, hayDatosEjemplo } from '../lib/seed';

export default function AjustesPage() {
  const guardado = useLiveQuery(() => getAjustes(), []);
  const demo = useLiveQuery(() => hayDatosEjemplo(), []);
  const [a, setA] = useState<Ajustes>(AJUSTES_DEFECTO);
  useEffect(() => { if (guardado) setA(guardado); }, [guardado]);
  const sucio = guardado && JSON.stringify(a) !== JSON.stringify(guardado);

  const importar = (f: File | null) => {
    if (!f) return;
    modals.openConfirmModal({
      title: 'Restaurar copia de seguridad',
      children: <Text size="sm">Se <b>sustituirán todos los datos actuales</b> por los del archivo «{f.name}». Te recomiendo exportar antes una copia de los datos actuales. ¿Continuar?</Text>,
      labels: { confirm: 'Restaurar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await importarJSON(f);
          notifications.show({ color: 'green', message: 'Copia restaurada' });
        } catch (e) {
          notifications.show({ color: 'red', title: 'Error al importar', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <Stack maw={1000}>
      <Title order={2}>Ajustes y datos</Title>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">General</Title>
        <SimpleGrid cols={3}>
          <NumIn label="IVA por defecto (%)" value={a.ivaDefecto} onChange={(v) => setA({ ...a, ivaDefecto: v })} description="Para proyectos nuevos" />
          <NumIn label="Días de aviso de alertas" value={a.diasAviso} decimalScale={0} onChange={(v) => setA({ ...a, diasAviso: v })} />
          <NumIn label="Validez de ofertas (días)" value={a.validezDias} decimalScale={0} onChange={(v) => setA({ ...a, validezDias: v })} />
        </SimpleGrid>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">Documentos PDF</Title>
        <Text size="xs" c="dimmed" mb="sm">Formato neutro sin logo. Los datos de empresa aparecen en texto en la cabecera (déjalos vacíos para no mostrar nada).</Text>
        <SimpleGrid cols={2}>
          <TextInput label="Nombre de la empresa" value={a.empresaNombre} onChange={(e) => setA({ ...a, empresaNombre: e.currentTarget.value })} />
          <Textarea label="Datos de la empresa" placeholder={'CIF · dirección\nteléfono · email'} autosize minRows={2} value={a.empresaDatos} onChange={(e) => setA({ ...a, empresaDatos: e.currentTarget.value })} />
        </SimpleGrid>
        <Textarea mt="sm" label="Condiciones de la oferta" autosize minRows={4} value={a.condicionesOferta} onChange={(e) => setA({ ...a, condicionesOferta: e.currentTarget.value })} />
        <Textarea mt="sm" label="Condiciones del pedido a marca" autosize minRows={2} value={a.condicionesPedido} onChange={(e) => setA({ ...a, condicionesPedido: e.currentTarget.value })} />
        <Textarea mt="sm" label="Plantilla de checklist de entrega (una línea por elemento, se aplica a proyectos nuevos)" autosize minRows={4} value={a.checklistPlantilla} onChange={(e) => setA({ ...a, checklistPlantilla: e.currentTarget.value })} />
      </Paper>
      <Group justify="flex-end">
        <Button disabled={!sucio} onClick={async () => { await db.ajustes.put(a); notifications.show({ message: 'Ajustes guardados' }); }}>Guardar ajustes</Button>
      </Group>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">Copia de seguridad</Title>
        <Text size="sm" mb="sm">Los datos se guardan solo en este navegador. Exporta una copia con regularidad; borrar los datos del navegador los elimina.</Text>
        <Group>
          <Button leftSection={<IconDownload size={16} />} onClick={() => exportarJSON()}>Exportar copia (JSON)</Button>
          <FileButton accept="application/json,.json" onChange={importar}>
            {(props) => <Button variant="default" leftSection={<IconUpload size={16} />} {...props}>Importar copia…</Button>}
          </FileButton>
        </Group>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">Datos de ejemplo</Title>
        {demo ? (
          <Alert color="yellow" variant="light" mb="sm">Hay datos de ejemplo cargados (3 marcas, 15 productos, 2 proyectos «DEMO»).</Alert>
        ) : (
          <Text size="sm" mb="sm" c="dimmed">No hay datos de ejemplo cargados.</Text>
        )}
        <Group>
          <Button color="red" variant="light" leftSection={<IconDatabaseOff size={16} />} disabled={!demo}
            onClick={() => modals.openConfirmModal({
              title: 'Borrar datos de ejemplo',
              children: <Text size="sm">Se eliminarán solo las marcas, productos y proyectos de ejemplo con todo su contenido. Los registros que hayas creado tú se conservan. Si has añadido partidas propias con productos o marcas de ejemplo, esas partidas también podrían quedar sin marca.</Text>,
              labels: { confirm: 'Borrar', cancel: 'Cancelar' }, confirmProps: { color: 'red' },
              onConfirm: async () => { await borrarDatosEjemplo(); notifications.show({ message: 'Datos de ejemplo eliminados' }); },
            })}>
            Borrar datos de ejemplo
          </Button>
          <Button variant="default" leftSection={<IconDatabasePlus size={16} />} disabled={!!demo}
            onClick={async () => { await cargarDatosEjemplo(); notifications.show({ message: 'Datos de ejemplo cargados' }); }}>
            Cargar datos de ejemplo
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}
