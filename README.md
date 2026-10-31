# Gestor FF&E Contract

Aplicación web de uso personal para gestionar proyectos FF&E hoteleros: catálogo de marcas y productos, proyectos, partidas, ofertas, pedidos a marcas, cobros y pagos, entrega y dashboard. Funciona sin login y guarda los datos en el navegador (IndexedDB).

## Uso (sin instalar nada)

1. Descarga `app/FFE-Contract.html`.
2. Ábrelo con doble clic en Chrome o Edge.
3. La primera vez se cargan datos de ejemplo (3 marcas, 15 productos, 2 proyectos «DEMO»). Se borran desde **Ajustes y datos → Borrar datos de ejemplo**.

> Los datos quedan guardados en ese navegador y asociados a la ruta del archivo. Si mueves el `.html` a otra carpeta o cambias de navegador, verás la app vacía: usa **Exportar copia (JSON)** e **Importar copia** para trasladarlos. Exporta una copia con regularidad.

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # tests de cálculo (precios, márgenes, IVA)
npm run build    # genera dist/index.html (archivo único)
cp dist/index.html app/FFE-Contract.html
```

Stack: React 18 + TypeScript + Vite, Mantine UI, Dexie (IndexedDB), pdfmake.

## Reglas de negocio implementadas

- **Reglas de precio por marca** (margen = markup sobre coste):
  - a) Tarifa − % dto. + % margen → coste = tarifa·(1−dto); PVP = coste·(1+margen)
  - b) Neto + % margen → coste = neto; PVP = neto·(1+margen)
  - c) Tarifa × coeficiente → coste = tarifa·(1−dto); PVP = tarifa·coef
- Los suplementos de acabado se suman al precio base antes de aplicar la regla.
- El PVP y el coste de cada partida se pueden editar manualmente (quedan marcados con «M» y no se recalculan).
- Los costes adicionales pueden ser una línea visible en la oferta (con precio de venta) o un coste interno.
- La instalación tiene coste y precio de venta (línea propia en la oferta).
- Hay un descuento global opcional al cliente y un IVA por proyecto (el valor por defecto está en Ajustes).
- Cada versión de oferta guarda una copia fija de las partidas. Los pedidos se generan desde la última oferta ganada (o desde las partidas actuales, previa confirmación), con un pedido por marca.
- Margen % mostrado = margen / venta (base imponible).
- Los importes de cobros y pagos se registran con IVA incluido.
- Numeración: `OF-<código proyecto>-v<n>` y `PED-<código proyecto>-<MARCA>`.
