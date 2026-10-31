import { db, TABLAS } from '../db';
import type { Table } from 'dexie';
import { hoy } from './format';

const APP = 'ffe-pmo';
const VERSION = 1;

export async function exportarJSON() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLAS) data[t] = await (db[t] as Table<any, any>).toArray();
  const blob = new Blob([JSON.stringify({ app: APP, version: VERSION, fecha: new Date().toISOString(), data })], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `copia-ffe-${hoy()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Sustituye todos los datos por los de la copia */
export async function importarJSON(file: File) {
  const json = JSON.parse(await file.text());
  if (json?.app !== APP || typeof json.data !== 'object') {
    throw new Error('El archivo no es una copia de seguridad válida de esta aplicación.');
  }
  await db.transaction('rw', TABLAS.map((t) => db[t]), async () => {
    for (const t of TABLAS) {
      const tabla = db[t] as Table<any, any>;
      await tabla.clear();
      const rows = json.data[t];
      if (Array.isArray(rows) && rows.length) await tabla.bulkAdd(rows);
    }
  });
}
