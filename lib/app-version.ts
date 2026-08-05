import packageMetadata from "@/package.json";

export const APP_VERSION = packageMetadata.version;

export const APP_CHANGELOG = [
  {
    version: "1.1.1",
    date: "5 de agosto de 2026",
    changes: [
      "Ficha dinámica y etiqueta QR para cada estantería.",
      "Detalle de ocupación, niveles, huecos, piezas y cajones de la estantería.",
      "El aviso de código leído desaparece automáticamente.",
      "Las piezas de un cajón se pueden marcar como vendidas desde el propio cajón.",
      "Vistas previas fieles para elegir el formato de las etiquetas.",
      "Diseño real de impresión con el código de barras definitivo.",
      "Corrección de textos recortados y solapados en las etiquetas.",
      "Acciones individuales de las piezas reorganizadas en un orden más directo.",
      "Impresión de etiquetas disponible desde la lista de piezas.",
      "Historial de novedades accesible pulsando el número de versión.",
      "Selector visual al imprimir etiquetas de piezas.",
      "Formato normal de 62 × 42 mm.",
      "Formato compacto de 62 × 30 mm para piezas pequeñas.",
      "La aplicación recuerda el último formato utilizado.",
      "Primera versión estable de Almacén Desguace.",
      "Gestión de piezas, estanterías, niveles, huecos y cajones.",
      "Plano general, historial y localización visual.",
      "Integración de publicación y gestión con Recambio Fácil.",
      "Etiquetas de piezas con código de barras y etiquetas QR para cajones.",
      "Optimización y subida múltiple de fotografías compatibles con Recambio Fácil.",
    ],
  },
] as const;
