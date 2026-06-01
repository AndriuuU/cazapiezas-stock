# 📦 Cazapiezas - Stock Manager

Una app moderna para escanear códigos de barras y gestionar el stock de materiales en tallergp.

## ✨ Características

- **Escaneo QR/Código de Barras** - Usa la cámara del dispositivo para escanear
- **Búsqueda Manual** - Ingresa el código manualmente si el escaneo falla
- **Visualización Completa** - Ve toda la información del material:
  - Stock actual
  - Precio de venta (PVP)
  - Coste
  - IVA
  - Historial de movimientos
- **Modificación de Cantidad** - Cambia la cantidad localmente (demostración)
- **Diseño Responsivo** - Funciona perfectamente en móvil y web
- **Interfaz Moderna** - UI oscura con acentos de cyan

## 🚀 Instalación

1. **Clona los archivos actualizados a tu proyecto:**
   ```bash
   # Reemplaza los archivos en tu proyecto con los proporcionados
   ```

2. **Instala las dependencias:**
   ```bash
   npm install
   # o
   yarn install
   ```

3. **Configura las variables de entorno:**
   ```bash
   # Copia .env.example a .env.local
   cp .env.example .env.local
   
   # Edita .env.local con tu URL y token de tallergp
   NEXT_PUBLIC_TALLERGP_URL=https://tu-api-url.com
   NEXT_PUBLIC_TALLERGP_TOKEN=tu_token_jwt_aqui
   ```

4. **Inicia el servidor de desarrollo:**
   ```bash
   npm run dev
   # o
   yarn dev
   ```

5. **Abre en el navegador:**
   ```
   http://localhost:3000
   ```

## 📱 Uso

### Escanear Código de Barras
1. Toca el botón "Escanear Código de Barras"
2. Apunta la cámara al código
3. El material se cargará automáticamente

### Búsqueda Manual
1. Escribe el código de barras en el campo
2. Presiona Enter o toca "Buscar"
3. El material aparecerá si existe

### Ver Detalles
- Toca la tarjeta del producto para ver más información
- Desplázate para ver el historial de movimientos
- Los datos se obtienen en tiempo real de tallergp

### Cambiar Cantidad
1. Usa los botones + y - para cambiar la cantidad
2. O escribe directamente en el campo
3. **Nota:** Los cambios son locales solo en esta sesión (demostración)

## 🏗️ Estructura del Proyecto

```
src/
├── app/
│   ├── page.tsx              # Página principal con lógica
│   ├── layout.tsx            # Layout base
│   └── globals.css           # Estilos globales
├── components/
│   ├── Scanner.tsx           # Componente de escaneo
│   ├── ProductCard.tsx       # Modal con detalles del producto
│   └── QuantityPanel.tsx     # Panel para cambiar cantidad
├── services/
│   ├── materials.ts          # Funciones de búsqueda de materiales
│   └── tallergp.ts           # Cliente Axios configurado
└── types/
    └── material.ts           # Tipos TypeScript
```

## 🔧 Componentes

### Scanner.tsx
- Escanea códigos de barras y QR
- Usa la librería `@zxing/browser`
- Preferencia por cámara trasera en móvil
- Bloquea escaneos duplicados en 1 segundo

### ProductCard.tsx
- Modal con toda la información del material
- Muestra historial de movimientos
- Indicador de cambios locales
- Responsive en móvil y desktop

### QuantityPanel.tsx
- Controles para aumentar/disminuir cantidad
- Validación de límites
- Indicador visual del estado del stock
- Entrada numérica editable

## 🎨 Diseño

- **Color Scheme:** Zinc (gris) con acentos de cyan y gradientes
- **Tipografía:** Fuentes del sistema optimizadas
- **Espaciado:** Generoso con bordes redondeados (xl)
- **Animaciones:** Transiciones suaves y feedback visual

## 📊 APIs Utilizadas

### GET /materials
Obtiene la lista de materiales con paginación.

```json
{
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_count": 285,
    "total_pages": 29
  },
  "data": [...]
}
```

### GET /materials/{material_id}
Obtiene los detalles completos de un material incluyendo movimientos de stock.

```json
{
  "material_id": "...",
  "name": "...",
  "quantity": 6,
  "stock_movements": [...],
  "photos": [...]
}
```

## 🔐 Seguridad

- Las variables de ambiente con `NEXT_PUBLIC_` son expuestas al cliente (necesario para el navegador)
- El token se envía en todas las peticiones a tallergp
- Asegúrate que el token tiene los permisos correctos en tu API

## 🐛 Troubleshooting

### La cámara no funciona
- Verifica que el navegador tenga permisos de cámara
- En HTTPS, iOS requiere que abras desde el ícono de la app
- En Android, concede permisos manualmente

### Dice "Material no encontrado"
- Verifica que el código de barras sea correcto
- Asegúrate que el material existe en tallergp
- El `serial_number` debe coincidir exactamente

### Error de autenticación
- Revisa que el `NEXT_PUBLIC_TALLERGP_TOKEN` sea válido
- Verifica que el token no ha expirado
- Confirma que la URL de la API es correcta

## 📝 Notas

- La app NO modifica el stock en tallergp (es solo lectura + demostración local)
- Todos los datos se obtienen en tiempo real de la API
- La cantidad local se reinicia cuando cierras la tarjeta del producto
- Compatible con navegadores modernos en móvil y desktop

## 🚀 Próximas Características

- [ ] Endpoint para guardar cambios de cantidad
- [ ] Historial de cambios locales
- [ ] Sincronización con servidor
- [ ] Caché offline
- [ ] Búsqueda por referencia o nombre
- [ ] Impresión de etiquetas

## 📄 Licencia

Proyecto privado para tallergp.
