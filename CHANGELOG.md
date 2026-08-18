# Historial de versiones

## Versión 1.3.0 · 18 de agosto de 2026

- Nuevo panel resumen con piezas sin ubicación, sin fotografías, pendientes de publicar e incidencias de Recambio Fácil.
- Acceso directo para ubicar piezas pendientes desde el propio resumen.
- Resumen compacto de entradas, ventas y retiradas recientes.
- Nuevo sistema de ventas con fecha, empleado, precio final, forma de pago y observaciones.
- La venta libera automáticamente la ubicación o el cajón de la pieza.
- Posibilidad de deshacer una venta registrada accidentalmente.
- Resumen de facturación con base imponible, IVA incluido, coste y margen estimado.
- Filtros de ventas por fechas, empleado y forma de pago, con detalles accesibles desde el listado.
- Gestión persistente de empleados: alta, activación y desactivación.
- Historial de cada pieza organizado como una línea temporal.
- Papelera y copias de seguridad para evitar pérdidas accidentales.
- Las retiradas se han trasladado a una sección secundaria para simplificar el uso diario.
- Nueva navegación superior permanente en ordenador y mejoras del menú móvil.
- Pantallas de carga para Historial, Plano, estanterías, huecos y cajones.
- Plano más compacto, con mejor rendimiento y una estética coherente con el resto de la aplicación.
- Localización visual de la estantería, nivel y hueco exactos de cada pieza.
- Controles para quitar el zoom, centrar la ubicación y volver a mostrar todas las estanterías.
- Alta manual de piezas IAM sin necesidad de conocer el código interno de Recambio Fácil.
- Mejoras generales en filtros, ventanas emergentes, adaptación móvil y tiempos de respuesta.

## Versión 1.2.1 · 7 de agosto de 2026

- Las piezas IAM se almacenan junto a las CAT, identificadas por su tipo.
- Nueva importación IAM desde Recambio Fácil mediante su API específica y desde CSV con vista previa.
- Las reimportaciones IAM actualizan los registros existentes sin duplicarlos.
- El listado permite filtrar CAT e IAM y la ficha muestra referencias, precios, fechas, origen y medidas IAM.
- Las piezas IAM quedan protegidas frente a publicaciones accidentales mediante el endpoint CAT.
- La opción para importar piezas IAM se muestra en ordenador y se oculta en el menú móvil.
- Las piezas IAM publicadas incluyen un acceso directo a su referencia en el buscador de Recambio Fácil.

## Versión 1.1.1 · 5 de agosto de 2026

- Cada estantería dispone de una ficha dinámica y una etiqueta QR imprimible.
- La ficha muestra ocupación, disponibilidad, configuración y contenido de cada nivel y hueco.
- El aviso de código leído al escanear desaparece automáticamente para no tapar otras acciones.
- Las piezas de un cajón se pueden marcar como vendidas desde el propio cajón, liberando su espacio.

- Las opciones de impresión muestran una vista previa fiel con los datos reales de la pieza.
- La vista previa permite comprobar qué información incluye cada formato antes de imprimir.
- La vista previa reutiliza el diseño real de impresión y el código de barras definitivo.
- Corregidos los textos recortados y solapados del selector de etiquetas.
- Reorganizadas las acciones individuales de las piezas con un orden único y más directo.
- Añadida la impresión de etiquetas desde la propia lista de piezas.
- El historial de novedades se puede consultar pulsando el número de versión.

- Selector visual al imprimir etiquetas de piezas.
- Formato normal de `62 × 42 mm`.
- Formato compacto de `62 × 30 mm` para piezas pequeñas.
- La aplicación recuerda el último formato utilizado.

- Primera versión estable identificada de Almacén Desguace.
- Gestión de piezas, estanterías, niveles, huecos y cajones.
- Plano general, historial y localización visual.
- Integración de publicación y gestión con Recambio Fácil.
- Etiquetas de piezas con código de barras y etiquetas QR para cajones.
- Optimización y subida múltiple de fotografías compatibles con Recambio Fácil.

## Criterio para las próximas versiones

- **Parche** (`1.0.1`): correcciones y pequeños ajustes visuales.
- **Menor** (`1.1.0`): funcionalidades nuevas compatibles con lo existente.
- **Mayor** (`2.0.0`): cambios importantes que modifican el funcionamiento o requieren una migración especial.
