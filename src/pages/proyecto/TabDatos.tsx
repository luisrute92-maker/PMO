import { useEffect, useState } from 'react';
import { Button, Divider, Group, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { Proyecto } from '../../types';
import { DateIn, NumIn } from '../../components/ui';
import type { TabProps } from './ProyectoPage';

export default function TabDatos({ p, upd }: TabProps) {
  const [f, setF] = useState<Proyecto>(p);
  useEffect(() => setF(p), [p]);
  const sucio = JSON.stringify(f) !== JSON.stringify(p);
  const s = (k: keyof Proyecto) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.currentTarget.value });

  return (
    <Stack>
      <Divider label="Cliente y proyecto" labelPosition="left" />
      <SimpleGrid cols={3}>
        <TextInput label="Código" value={f.codigo} onChange={s('codigo')} />
        <TextInput label="Nombre del proyecto" value={f.nombre} onChange={s('nombre')} />
        <Select label="Origen de la prescripción" allowDeselect={false} value={f.origen}
          data={[{ value: 'propia', label: 'Propia' }, { value: 'recibida', label: 'Recibida' }]}
          onChange={(v) => setF({ ...f, origen: v as Proyecto['origen'] })} />
        <TextInput label="Cliente (hotel)" value={f.cliente} onChange={s('cliente')} />
        <TextInput label="Cadena / grupo" value={f.cadena} onChange={s('cadena')} />
        <TextInput label="Interiorista" placeholder="Si lo hay" value={f.interiorista} onChange={s('interiorista')} />
        <TextInput label="Ubicación" value={f.ubicacion} onChange={s('ubicacion')} />
        <TextInput label="Dirección de entrega en obra" style={{ gridColumn: 'span 2' }} value={f.direccionEntrega} onChange={s('direccionEntrega')} />
      </SimpleGrid>
      <Divider label="Contacto" labelPosition="left" />
      <SimpleGrid cols={3}>
        <TextInput label="Nombre / cargo" value={f.contactoNombre} onChange={s('contactoNombre')} />
        <TextInput label="Email" value={f.contactoEmail} onChange={s('contactoEmail')} />
        <TextInput label="Teléfono" value={f.contactoTelefono} onChange={s('contactoTelefono')} />
      </SimpleGrid>
      <Divider label="Fechas clave" labelPosition="left" />
      <SimpleGrid cols={3}>
        <DateIn label="Fecha de alta" value={f.fechaAlta} onChange={(v) => setF({ ...f, fechaAlta: v ?? f.fechaAlta })} />
        <DateIn label="Entrega comprometida en obra" value={f.fechaEntregaObra} onChange={(v) => setF({ ...f, fechaEntregaObra: v })} />
        <DateIn label="Apertura del hotel" value={f.fechaApertura} onChange={(v) => setF({ ...f, fechaApertura: v })} />
      </SimpleGrid>
      <Divider label="Condiciones económicas" labelPosition="left" />
      <SimpleGrid cols={3}>
        <NumIn label="IVA del proyecto (%)" value={f.iva} onChange={(v) => setF({ ...f, iva: v })} description="Por defecto el de Ajustes. Canarias (IGIC), exportación 0 %…" />
        <NumIn label="Descuento global al cliente (%)" value={f.descuento} onChange={(v) => setF({ ...f, descuento: v })} description="Se aplica sobre el subtotal de la oferta" />
      </SimpleGrid>
      <Textarea label="Notas" autosize minRows={3} value={f.notas} onChange={s('notas')} />
      <Group justify="flex-end">
        {sucio && <Text size="sm" c="orange">Cambios sin guardar</Text>}
        <Button variant="default" disabled={!sucio} onClick={() => setF(p)}>Descartar</Button>
        <Button disabled={!sucio} onClick={async () => { await upd(f); notifications.show({ message: 'Proyecto guardado' }); }}>Guardar</Button>
      </Group>
    </Stack>
  );
}
