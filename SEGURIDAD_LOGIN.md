# Seguridad añadida

Este documento resume los cambios hechos para proteger Cazapiezas Stock con un login sencillo para el taller.

## Que se ha añadido

- Pantalla de login en `/login`.
- Sesion persistente con cookie segura `HttpOnly`.
- Proteccion de la pantalla principal `/`.
- Proteccion del panel `/admin`.
- Proteccion de las APIs internas.
- Limite de peticiones por IP.
- Avisos visibles cuando hay demasiadas peticiones.
- Opcion de limitar el acceso solo a una o varias IPs del trabajo.

## Como funciona el login

La app usa una clave compartida para el taller.

Cada companero introduce la clave una vez en su dispositivo. Despues queda guardada una sesion en cookie durante 180 dias, asi que normalmente no tendra que volver a escribirla.

La cookie se guarda como `HttpOnly`, lo que significa que el navegador la envia automaticamente, pero JavaScript del cliente no puede leerla.

## Variables nuevas

En `.env.local` hay que poner:

```env
CAZAPIEZAS_LOGIN_PASSWORD=la_clave_que_quieras_para_el_taller
CAZAPIEZAS_SESSION_SECRET=una_clave_larga_aleatoria_distinta
```

Recomendacion:

- `CAZAPIEZAS_LOGIN_PASSWORD`: una clave facil de comunicar al equipo, pero no trivial.
- `CAZAPIEZAS_SESSION_SECRET`: una clave larga y aleatoria, solo para firmar sesiones.

Si cambias `CAZAPIEZAS_LOGIN_PASSWORD` o `CAZAPIEZAS_SESSION_SECRET`, las sesiones anteriores dejaran de valer y los usuarios tendran que iniciar sesion otra vez.

## Archivos creados

### `app/login/page.tsx`

Nueva pantalla de acceso.

Permite introducir la clave del taller y muestra errores como:

- Contrasena incorrecta.
- Demasiados intentos.
- Falta configurar la clave.

### `app/api/auth/login/route.ts`

Nueva API para iniciar sesion.

Comprueba la clave, crea el token de sesion y guarda la cookie.

### `app/api/auth/logout/route.ts`

Nueva API para cerrar sesion.

Borra la cookie de sesion. Ahora mismo no hay boton visible de cerrar sesion, pero la ruta queda preparada.

### `lib/auth.ts`

Modulo interno de autenticacion.

Hace estas cosas:

- Lee la clave configurada.
- Crea tokens de sesion.
- Firma los tokens.
- Verifica si una cookie de sesion es valida.
- Define las opciones seguras de la cookie.

### `lib/request-security.ts`

Modulo interno de seguridad para peticiones.

Hace estas cosas:

- Comprueba si la IP esta permitida.
- Aplica limite de peticiones.
- Comprueba que la API tenga sesion valida.
- Devuelve errores claros con estado `401`, `403` o `429`.

### `proxy.ts`

Filtro de entrada de Next.js.

Protege:

- `/`
- `/admin`
- `/api/*`

Si no hay sesion:

- En paginas, redirige a `/login`.
- En APIs, devuelve `401` con `Inicia sesion para continuar.`

## APIs protegidas

Se ha anadido proteccion directa dentro de estas rutas:

- `app/api/materials/route.ts`
- `app/api/adjustments/route.ts`
- `app/api/employees/route.ts`

Esto es importante porque no basta con esconder pantallas o botones. Aunque alguien intentase llamar directamente a una API, ahora la API comprueba sesion antes de tocar datos.

## Limite de peticiones

Se han puesto limites por IP para evitar abuso o demasiadas llamadas seguidas.

Limites actuales:

- Login: 8 intentos cada 15 minutos.
- Consultas de materiales: 35 peticiones por minuto.
- Cambios de materiales: 20 peticiones por minuto.
- Consultas de movimientos: 60 peticiones por minuto.
- Cambios de movimientos: 30 peticiones por minuto.
- Consultas de empleados: 60 peticiones por minuto.
- Cambios de empleados: 15 peticiones por minuto.

Si se supera el limite, la API devuelve:

```text
Demasiadas peticiones. Espera X segundos y vuelve a intentarlo.
```

La pantalla principal y el cargador de catalogo ya muestran este mensaje al usuario.

## Limitar por IP del trabajo

Se puede activar con:

```env
CAZAPIEZAS_ALLOWED_IPS=80.25.10.123
```

Tambien se pueden poner varias IPs:

```env
CAZAPIEZAS_ALLOWED_IPS=80.25.10.123,80.25.10.124
```

Mi recomendacion: usarlo como segunda capa, no como unica proteccion.

Motivo:

- Si cambia la IP publica del trabajo, os podeis quedar fuera.
- Si alguien esta dentro de la red permitida, la IP por si sola no distingue usuarios.
- Con login + IP tienes una proteccion mas fuerte.

## Comprobaciones realizadas

Se comprobaron correctamente:

```bash
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

Tambien se hizo una prueba temporal del servidor:

- `/` redirige a `/login` sin sesion.
- `/api/materials?all=true` devuelve `401` sin sesion.

## Pendiente opcional

No se ha anadido boton de cerrar sesion en pantalla.

La ruta existe (`/api/auth/logout`), asi que si mas adelante quieres un boton de "Salir", se puede poner facil en el panel o en la pantalla principal.

