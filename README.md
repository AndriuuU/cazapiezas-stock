<div align="center">

# 🔧 Cazapiezas Stock

**Aplicación web privada para consultar, escanear y administrar el stock de materiales de Cazapiezas**

Integrada con **TallerGP** y **Supabase**

[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-000000?logo=next.js&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white)](#)
[![Status](https://img.shields.io/badge/estado-privado-lightgrey)](#)

</div>

---

## 📚 Índice

- [Vista general](#-vista-general)
- [Funcionalidades](#-funcionalidades)
- [Requisitos](#-requisitos)
- [Variables de entorno](#-variables-de-entorno)
- [Instalación y desarrollo](#-instalación-y-desarrollo)
- [Scripts útiles](#-scripts-útiles)
- [Flujo de uso](#-flujo-de-uso)
- [Catálogo local y caché](#-catálogo-local-y-caché)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Validación antes de subir versión](#-validación-antes-de-subir-versión)
- [Problemas conocidos](#-problemas-conocidos)
- [Futuras mejoras](#-futuras-mejoras)
- [Licencia](#-licencia)

---

## 🧭 Vista General

**Cazapiezas Stock** centraliza las tareas diarias de almacén en una única aplicación:

| | |
|---|---|
| 🔍 | Buscar materiales de forma rápida |
| 📷 | Escanear códigos de barras desde móvil o escritorio |
| 📋 | Consultar fichas completas de producto |
| 📉 | Registrar salidas y ajustes de stock |
| ➕ | Crear productos nuevos |
| 🏷️ | Imprimir etiquetas |
| 📊 | Revisar movimientos desde el panel de administración |

Construida con **Next.js App Router**, **React**, **TypeScript** y **Tailwind CSS**. La comunicación con TallerGP pasa siempre por rutas API internas, evitando exponer credenciales sensibles en el navegador.

### Home
![Pantalla principal](doc\screenshots\Home.png)

### Panel de Admin
![Pantalla Admin](doc\screenshots\admin.png)

---

## ⚙️ Funcionalidades

### 🏠 Pantalla Principal

- Búsqueda por código, referencia, serie, EAN, nombre o descripción.
- Escaneo de códigos de barras con la cámara del dispositivo.
- Catálogo local en `localStorage` para acelerar búsquedas.
- Recarga automática del catálogo cada **2 horas**.
- Ficha de producto con stock, precios, IVA, imágenes y ajuste de cantidad.
- Registro de salidas y ajustes con empleado asociado.

### 🛠️ Panel de Administración

Disponible en:

```text
/admin
```

Incluye:

- Dashboard de actividad reciente.
- Movimientos de stock.
- Administración de materiales.
- Detalle completo de cada material al pulsar en la fila, en la referencia o en `Ver`.
- Visualización del ID interno de TallerGP solo dentro de la ficha del material.
- Movimientos de TallerGP y movimientos guardados en Cazapiezas.
- Edición de stock, código, precios y umbrales.
- Alta de productos nuevos.
- Generación e impresión de etiquetas.
- Gestión de empleados.
- Exportaciones y copias de seguridad.

### 🚀 Rendimiento y Estabilidad

- Caché local del catálogo para reducir carga.
- Caché interno en la API para detalles y movimientos de materiales.
- Reducción de errores `429 Too Many Requests` al abrir fichas repetidas.
- Fuentes del sistema para que `npm run build` no dependa de descargar Google Fonts.

---

## ✅ Requisitos

- Node.js compatible con Next.js 16.
- Acceso a la API de TallerGP.
- Proyecto Supabase o endpoint REST compatible para movimientos, empleados y eventos internos.

### Módulo Almacén Desguace

El módulo independiente vive en `/almacen-desguace` y utiliza exclusivamente las tablas
`almacen_desguace_piezas` y `almacen_desguace_fotos`. Antes de usarlo, ejecuta en el editor
SQL de Supabase la migración:

`supabase/migrations/202607160001_almacen_desguace.sql`

La migración también crea el bucket privado `almacen-desguace`, la numeración automática
`CZP-DESGUACE-000001` y las restricciones de ubicación y estados. En servidor se puede
configurar opcionalmente `SUPABASE_SERVICE_ROLE_KEY`; si no existe, se mantiene el mismo
método de acceso con la clave anon que ya utiliza la aplicación.

---

## 🔐 Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
TALLERGP_URL=https://tu-api-tallergp.com
TALLERGP_TOKEN=tu_token_de_tallergp

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key

CAZAPIEZAS_LOGIN_PASSWORD=una_clave_larga_para_el_taller
CAZAPIEZAS_SESSION_SECRET=otra_clave_larga_aleatoria

# Opcional: limita el acceso a una o varias IPs publicas separadas por coma.
# CAZAPIEZAS_ALLOWED_IPS=80.25.10.123,80.25.10.124
```

> **⚠️ Importante**
> - `TALLERGP_URL` y `TALLERGP_TOKEN` deben ser variables de servidor.
> - También se soportan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como respaldo.
> - **No** uses `NEXT_PUBLIC_TALLERGP_TOKEN`: expondría el token en el navegador.
> - `CAZAPIEZAS_LOGIN_PASSWORD` es la clave que usaran los companeros para entrar.
> - `CAZAPIEZAS_SESSION_SECRET` firma la sesion guardada en cookie. Si la cambias, todos tendran que iniciar sesion otra vez.
> - `CAZAPIEZAS_ALLOWED_IPS` es opcional. Si la activas, solo esas IPs podran usar la app.

---

## 💻 Instalación y Desarrollo

```bash
npm install
npm run dev
```

Servidor local:

```text
http://localhost:3000
```

### Imprimir etiquetas desde un móvil Android

La Brother QL-570 conectada por USB puede recibir etiquetas desde un móvil de la misma red mediante el puente local incluido. En el PC conectado a la impresora, ejecuta:

```bash
npm run print:bridge
```

Deja esa ventana abierta. En el móvil, abre una pieza, pulsa **Imprimir etiqueta** y después **Brother por Wi-Fi**. El móvil mostrará una vista previa alojada en el PC y pedirá confirmación antes de imprimir.

El puente escucha únicamente en la red local, en `http://192.168.1.36:8765`, y utiliza Microsoft Edge con la impresora predeterminada de Windows. La Brother QL-570 debe estar configurada como predeterminada con papel de 62 × 32 mm para la etiqueta compacta.

---

## 📜 Scripts Útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | Revisión con ESLint |
| `npx tsc --noEmit` | Revisión de TypeScript |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |

---

## 🔄 Flujo de Uso

1. Abre la pantalla principal.
2. Deja que cargue el catálogo local o pulsa **Actualizar**.
3. Busca un material por referencia, código, nombre o escaneando el código de barras.
4. Abre la ficha para revisar datos y ajustar stock.
5. Selecciona el empleado al registrar una salida o ajuste.
6. Usa `/admin` para materiales, etiquetas, empleados, exportaciones y movimientos.

---

## 🗄️ Catálogo Local y Caché

El catálogo local se guarda en el navegador con `localStorage`.

- Caduca cada **2 horas**.
- Se puede forzar la recarga con **Actualizar**.
- La pantalla muestra número de productos, tamaño aproximado y fecha/hora de la última actualización.
- Si TallerGP limita peticiones, la app intenta seguir usando datos locales cuando es posible.

La API interna mantiene una caché corta en memoria para detalles y movimientos. Esto evita repetir la misma llamada cuando React ejecuta efectos dos veces en desarrollo o cuando se abre varias veces el mismo material.

---

## 🗂️ Estructura del Proyecto

```text
app/
├── page.tsx                    Pantalla principal
├── admin/page.tsx              Panel de administración
└── api/
    ├── materials/route.ts      Proxy y operaciones de materiales
    ├── adjustments/route.ts    Movimientos y ajustes internos
    └── employees/route.ts      Empleados

components/
├── CacheLoader.tsx             Carga y estado del catálogo local
├── MaterialsList.tsx           Lista de catálogo en pantalla principal
├── NewProductForm.tsx          Alta de productos
├── ProductCard.tsx             Ficha de producto
└── Scanner.tsx                 Escaneo de códigos

services/
├── cache.ts                    Catálogo local y caducidad
├── search.ts                   Búsqueda sobre caché
└── materials.ts                Utilidades de materiales

lib/
├── barcodes.ts                 Generación de códigos internos
└── supabase.ts                 Configuración REST de Supabase

types/
└── material.ts                 Tipos de materiales
```

---

## 🧪 Validación Antes de Subir Versión

Antes de publicar o subir versión:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

**Estado de la última revisión:**

| Comprobación | Estado |
|---|---|
| `npm run lint` | ✅ Correcto |
| `npx tsc --noEmit` | ✅ Correcto |
| `npm run build` | ✅ Correcto |

---

## 🐞 Problemas Conocidos

- TallerGP puede responder `429 Too Many Requests` si se fuerzan muchas recargas o se abren muchas fichas seguidas.
- En desarrollo, React puede duplicar algunas peticiones para detectar efectos inseguros.
- El catálogo local depende del navegador; si se vacían los datos del sitio, hay que recargarlo.
- `next-env.d.ts` lo genera Next.js y está ignorado por Git. Si una build local falla intentando reescribirlo, ejecuta de nuevo con permisos normales del usuario o regenera tipos con:

```bash
npx next typegen
```

---

## 🚧 Futuras Mejoras

- [ ] Mostrar avisos más claros cuando TallerGP limite peticiones.
- [ ] Mejorar la caché de movimientos con invalidación selectiva tras ajustes de stock.
- [ ] Añadir paginación o carga progresiva en historiales de movimientos grandes.
- [ ] Unificar exportaciones con filtros por fecha, empleado y tipo de movimiento.
- [ ] Crear tests end-to-end para búsqueda, ajuste de stock, alta de producto e impresión de etiquetas.
- [ ] Añadir auditoría completa de cambios de material.
- [ ] Mejorar el modo offline con cola de movimientos pendientes.


---

## 📄 Licencia

Proyecto privado para **Cazapiezas**.
