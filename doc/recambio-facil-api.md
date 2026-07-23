# Publicación en Recambio Fácil

La aplicación publica piezas con el endpoint interno:

`POST /api/almacen-desguace/recambio-facil/publicar`

Este endpoint consulta las piezas guardadas, construye los objetos CAT y utiliza `/CAT/batch` incluso para una sola pieza. Procesa las respuestas `200` y `207` pieza por pieza, y solo marca como `Online` las creadas correctamente o las que Recambio Fácil confirma que ya estaban insertadas.

## 1. Configuración

Añade estas variables al entorno del servidor:

```env
RECAMBIO_FACIL_API_URL=https://apipre.recambio.recambiofacil.com
RECAMBIO_FACIL_ID_CLIENTE=31172
RECAMBIO_FACIL_API_KEY=PEGA-AQUI-EL-TOKEN-DE-RECAMBIO-FACIL
CAZAPIEZAS_POSTMAN_TOKEN=GENERA-AQUI-UN-TOKEN-LARGO-Y-SECRETO
```

La URL puede ser la base de la API o acabar en `/CAT`. La aplicación completa automáticamente `/CAT?idcliente=...`.

Todas las peticiones externas envían el token en la cabecera requerida:

```http
x-api-key: TOKEN-DE-RECAMBIO-FACIL
```

`RECAMBIO_FACIL_ALMACEN` es opcional y permite cambiar el nombre del almacén enviado. Reinicia la aplicación después de cambiar el entorno.

## 2. Uso desde la aplicación

- En la lista, abre **Acciones** de una pieza no online y pulsa **Publicar en R/F**.
- Para publicar varias, selecciónalas y pulsa **Publicar** en el bloque azul.
- Cazapiezas utiliza `POST /CAT/batch` y crea lotes de un máximo de 10 recambios. Si seleccionas más de 10, se generan varios lotes consecutivos.
- En la ficha de una pieza no online también aparece **Publicar en R/F**.
- La ficha incluye un bloque **Comprobar y gestionar la publicación**. Primero utiliza
  `GET /CAT/{codigo}` para confirmar si la pieza existe realmente en R/F.
- Después de una comprobación correcta permite actualizar todos los datos con `PUT /CAT`
  o eliminar solamente el anuncio externo con `DELETE /CAT/{codigo}`.
- Eliminar de R/F no borra la pieza de Cazapiezas, no cambia su ubicación y conserva
  fotografías e historial. Si estaba en proceso `Publicada`, pasa a `Lista para publicar`.
- Siempre se muestra una confirmación antes de enviar.
- Si una pieza ya está online se omite, por lo que no se publica dos veces desde la aplicación.
- Si falla una pieza de una selección, las demás continúan y se muestra el motivo de cada error.

Campos obligatorios antes de publicar:

- Código RF numérico generado de forma estable a partir del cliente y el ID interno → `Codigo`
- Cliente configurado → `Idcliente`
- Nombre de la pieza → `Descripcion` en la API de Recambio Fácil
- Precio de venta → `Precio`
- Referencia principal de al menos cuatro caracteres → `Referencia`
- Marca del vehículo → `Marca`
- Modelo del vehículo → `Modelo`

Aunque Recambio Fácil llama `Descripcion` a su campo, Cazapiezas envía siempre
`nombre_pieza`. El campo local de descripción queda reservado para observaciones y detalles
opcionales, enviados mediante `Observaciones`.
- `Ubicacion` se envía automáticamente como `almacenada`, tenga o no ubicación física en Cazapiezas

También se envían únicamente los campos opcionales que ya se han comprobado correctamente: referencia principal, fecha base, ubicación corta de estantería, PVP, observaciones, marca, modelo y fotografías. `Imagenes` es una cadena con las URLs públicas separadas por comas. Los campos vacíos no se incluyen.

`Codigo` no utiliza directamente el código alfanumérico de Cazapiezas porque Recambio Fácil lo rechaza con un error `500`. Se genera un código numérico estable de 9 cifras: las tres últimas cifras del cliente seguidas del ID interno rellenado a seis cifras. Por ejemplo, para el cliente `31172` y la pieza con ID `668`, se envía `172000668`. `Referencia` continúa siendo la referencia real del producto. Las referencias adicionales no se envían porque la API de preproducción ha demostrado ser sensible a campos opcionales.

La referencia principal, la referencia OEM y cada una de las referencias equivalentes deben contener al menos 4 caracteres cuando estén informadas. Cazapiezas valida todos estos campos antes de realizar la llamada para evitar el error `500` que devuelve Recambio Fácil con referencias demasiado cortas.

La ubicación física no bloquea la publicación. Cuando existe una posición en Cazapiezas se envía adicionalmente mediante `UbicacionEstanteria`, compactada a un máximo de 10 caracteres. Por ejemplo, `DESGUACE-E01-N01-C03` se envía como `E01N01C03`. Cuando no existe ubicación, ese campo se omite.

## 3. Prueba con Postman

Importa `doc/Recambio-Facil.postman_collection.json` y rellena sus variables:

- `app_url`: por ejemplo `http://localhost:3000`
- `postman_token`: el mismo valor de `CAZAPIEZAS_POSTMAN_TOKEN`
- `pieza_id`: ID numérico de una pieza existente que todavía no esté online

La petición **Publicar una pieza desde Cazapiezas** usa:

```http
POST {{app_url}}/api/almacen-desguace/recambio-facil/publicar
Authorization: Bearer {{postman_token}}
Content-Type: application/json
```

```json
{
  "id": 1
}
```

La colección también incluye estas operaciones usando `pieza_id`:

```http
GET    {{app_url}}/api/almacen-desguace/recambio-facil/gestionar/{{pieza_id}}
PUT    {{app_url}}/api/almacen-desguace/recambio-facil/gestionar/{{pieza_id}}
DELETE {{app_url}}/api/almacen-desguace/recambio-facil/gestionar/{{pieza_id}}
```

`GET` es la operación recomendada antes de actualizar o eliminar. Las tres rutas calculan
el código numérico de R/F automáticamente, por lo que no debes escribirlo a mano.

Para probar directamente la API sin tocar una pieza real, ejecuta completa la carpeta
**PRUEBA COMPLETA CRUD DIRECTA - ejecutar carpeta**. Postman realiza automáticamente:

1. Crear un recambio temporal con código único.
2. Comprobarlo mediante `GET`.
3. Editar descripción y precio mediante `PUT`.
4. Volver a consultar y verificar la edición.
5. Eliminar el recambio temporal mediante `DELETE`.
6. Confirmar mediante `GET` que la API devuelve `404`.

Solo necesitas rellenar `recambio_api_key`. El cliente y la URL de preproducción ya están
configurados en las variables de la colección.

También puedes enviar hasta 50 IDs:

```json
{
  "ids": [1, 2, 3]
}
```

La colección incluye una segunda petición para probar directamente la API externa de Recambio Fácil. Completa `recambio_api_key` con el token antes de enviarla.

La prueba directa genera automáticamente un `Codigo` numérico nuevo en cada envío para evitar errores por códigos duplicados. Solo envía los campos que han funcionado correctamente y una imagen pública de prueba; no envía campos opcionales vacíos ni valores cero innecesarios porque la API de preproducción puede responder `500` con ellos.

La petición **Prueba directa - POST CAT batch (2 piezas)** permite comprobar `/CAT/batch` con dos códigos numéricos diferentes. Una respuesta correcta de esta ruta es HTTP `200`.

## 4. Respuestas

Una respuesta correcta indica las piezas publicadas y las que ya estaban online:

```json
{
  "requested": 2,
  "published": [{ "id": 1, "codigo": "CAT-0001" }],
  "skipped": [{ "id": 2, "codigo": "CAT-0002", "reason": "Ya estaba online." }],
  "failed": []
}
```

Si algunas se publican y otras fallan, devuelve HTTP `207` con los errores en `failed`. Si Recambio Fácil confirma el alta pero falla el guardado local, la respuesta incluye `publishedExternally: true`; en ese caso conviene revisar esa pieza antes de volver a enviarla para evitar un duplicado.

## 5. Consultar una etiqueta de transporte

La aplicación incorpora este endpoint protegido:

```http
GET /api/almacen-desguace/recambio-facil/etiqueta?idPedido=12345
```

También admite `idEnvio` en lugar de `idPedido`. Cazapiezas añade automáticamente `idCliente=31172` y la cabecera privada `x-api-key`, y devuelve sin modificar la respuesta Base64 de Recambio Fácil.

La colección incluye llamadas a la aplicación y directamente a `/API/etiqueta`. Rellena `id_pedido` antes de probar. Este endpoint no permite descubrir pedidos nuevos: primero hace falta conocer el identificador del pedido o del envío.
