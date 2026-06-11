# Mejoras de codigos de barras, etiquetas y admin

Este documento resume los cambios realizados en la app de Cazapiezas STOCK para productos sin codigo de barras, impresion de etiquetas Brother QL-570, control de altas y exportaciones.

## 1. Generacion automatica de codigo de barras

Cuando se crea un producto nuevo:

- Si el admin escribe o escanea un codigo de barras, se guarda ese codigo.
- Si el campo de codigo esta vacio, la app genera automaticamente un codigo EAN-13 interno.
- El codigo generado usa prefijo interno `20`, pensado para uso dentro del taller.
- Antes de guardar, la app comprueba que ese codigo no exista ya en el catalogo.

Importante: un codigo unico a nivel mundial solo se garantiza comprando un prefijo GS1. Esta solucion garantiza unicidad dentro del catalogo de Cazapiezas/TallerGP.

Archivo principal:

- `lib/barcodes.ts`
- `app/api/materials/route.ts`

## 2. Validacion de codigos duplicados

Al crear un producto, si el admin introduce un codigo que ya existe en otro producto, el servidor bloquea el alta.

Resultado:

- Evita que dos productos acaben con el mismo codigo.
- La validacion ocurre en servidor, no solo en pantalla.
- Si hay duplicado, la API devuelve error `409`.

Archivo principal:

- `app/api/materials/route.ts`

## 3. Guardado del codigo generado

El codigo generado se envia a TallerGP como `serial_number`.

La app ya buscaba productos por:

- `barcode`
- `ean`
- `serial_number`

Por eso el codigo generado queda usable para escanear y encontrar el producto desde la app.

## 4. Ficha historica completa del producto

Al crear un producto nuevo, ahora se guarda una copia historica de la ficha en el registro de alta.

La ficha historica incluye:

- Referencia
- Nombre/articulo
- Codigo de barras
- Stock inicial
- Coste
- PVP
- IVA
- Alerta de stock
- Fecha de creacion

Esto sirve para que el admin conserve informacion aunque el producto cambie o se borre despues en TallerGP.

Nota: aplica a productos creados desde esta mejora. Las altas antiguas conservan solo los datos que ya estaban guardados.

Archivos principales:

- `app/api/materials/route.ts`
- `app/api/adjustments/route.ts`
- `app/admin/page.tsx`

## 5. Deteccion de productos borrados de TallerGP

Antes, si un producto se borraba de TallerGP, en admin podia aparecer como `Sin codigo`.

Ahora el admin distingue:

- Producto existe y tiene codigo: permite imprimir.
- Producto existe pero no tiene codigo: muestra `Sin codigo`.
- Producto ya no existe en TallerGP: muestra `Borrado de TallerGP`.

Si la ficha historica tiene codigo guardado, se puede seguir reimprimiendo la etiqueta aunque el producto ya no exista en TallerGP.

Archivos principales:

- `app/api/adjustments/route.ts`
- `app/admin/page.tsx`

## 6. Impresion de etiquetas Brother QL-570

Se anadio impresion directa de etiquetas desde el admin.

Formato actual:

- Tamano de etiqueta: `62mm x 29mm`.
- Arriba: nombre del articulo.
- Abajo: codigo de barras.
- Debajo de las barras: numeros del codigo.
- La etiqueta esta ajustada para no partirse en varias hojas.

El boton `Imprimir` queda disponible siempre que exista codigo, incluso si la etiqueta ya fue impresa antes.

Archivo principal:

- `app/admin/page.tsx`

## 7. Estado de etiqueta impresa

Las altas nuevas quedan como pendientes de etiqueta.

Cuando el admin imprime:

- Si la alta estaba pendiente, se marca como completada.
- Si ya estaba completada, permite reimprimir sin volver a tocar el estado.

Estados visibles:

- `Imprimir`
- `Etiqueta impresa`
- `Sin codigo`
- `Borrado de TallerGP`

Archivo principal:

- `app/admin/page.tsx`

## 8. Vista de etiquetas pendientes

Se creo una nueva pestana en el panel admin: `Etiquetas`.

Esta vista muestra solo productos nuevos pendientes de etiqueta.

Acciones disponibles:

- `Imprimir`: imprime una etiqueta individual.
- `Imprimir todas`: imprime todas las etiquetas pendientes que tengan codigo.
- `Marcar como impresa`: marca una etiqueta individual como completada.
- `Marcar como impresas`: marca toda la cola pendiente como completada.

Tambien muestra avisos si:

- El producto esta borrado de TallerGP.
- No hay codigo guardado.

Archivo principal:

- `app/admin/page.tsx`

## 9. Exportaciones ampliadas

Se mantuvieron las exportaciones existentes y se anadieron:

- `Catalogo completo`
- `Backup completo`

El backup completo incluye:

- Catalogo local
- Movimientos de stock
- Altas de producto
- Estado de etiquetas

La exportacion se genera como archivo `.xls` compatible con Excel.

Archivo principal:

- `app/admin/page.tsx`

## 10. Limpieza de datos internos en pantalla

Para guardar la ficha historica sin cambiar la estructura de Supabase, se almacenan metadatos internos dentro del registro de alta.

La interfaz limpia esos metadatos para que el admin no vea textos tecnicos como:

- `[CODIGO: ...]`
- `[FICHA: ...]`

El admin ve solo el nombre real del articulo.

Archivos principales:

- `app/api/materials/route.ts`
- `app/api/adjustments/route.ts`
- `app/admin/page.tsx`

## 11. Validaciones realizadas

Se pasaron estas comprobaciones:

```bash
npx.cmd eslint app\api\materials\route.ts app\api\adjustments\route.ts app\admin\page.tsx
npx.cmd tsc --noEmit
```

Resultado:

- ESLint paso en los archivos modificados.
- TypeScript paso sin errores.

## 12. Archivos modificados o creados

Archivos creados:

- `lib/barcodes.ts`
- `MEJORAS_CODIGOS_ETIQUETAS.md`

Archivos modificados:

- `app/api/materials/route.ts`
- `app/api/adjustments/route.ts`
- `app/admin/page.tsx`

