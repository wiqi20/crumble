# Entrega: Backend · Crumble, Etapa 0 (E0-2 a E0-6)

- **Fecha:** 17 nov 2026
- **Rama / archivos:** `feat/etapa0-backend` en `wiqi20/crumble`, desde `feat/etapa0-esqueleto`. Sin PR ni unión a `main`.
- **Veredicto** (solo revisores): no aplica

## Resumen
Quedan hechas las historias de Backend de la Etapa 0. La configuración se valida con zod al arrancar y, si falta algo, el servicio no arranca. Hay migraciones reales con `001_base.sql`, un formato de error común, registros sin datos personales y `/api/health` que consulta la base. `proxy.ts` enruta por `Host` y sirve el panel en la raíz de su dirección. Las cabeceras de seguridad están en toda respuesta, y un registro hace fallar las pruebas si una ruta de `/api/admin` no declara permiso. También están aplicadas las decisiones del PM de esta tarde: 404 en JSON para la API, panel en la raíz y `lang="es-CR"` en lo que es mío. Lint, tipos, 116 pruebas con Postgres real y build pasan. La rama se une sin conflictos con `feat/etapa0-frontend`, y la unión también pasa todo (121 pruebas, más la prueba contra servidor real, 10 de 10).

## Qué se entrega
- **E0-2:** `server/config.ts` lee y valida con zod las variables de 5.7 y las de soporte. Exige `DATABASE_URL`, `URL_TIENDA` y `URL_PANEL`: https (http solo en la propia máquina), sin ruta ni barra final, y con nombres distintos entre sí. Exige `SESSION_SECRET` e `IP_HASH_SALT` de al menos 32 caracteres, y `RETENCION_PEDIDOS_MESES` entre 1 y 120. `MODO_DEMO` vale `true` o `false` (sin valor, `false`). `ESTADO_SERVICIO` vale `activo` o `suspendido`. Fuera de la demo exige Google y `PROPIETARIA_EMAIL`. Con `MODO_DEMO=true` exige `DEMO_RESET_MINUTOS`. Las tres variables de soporte van juntas o ninguna. El mensaje lista **todo** lo que falla, una línea por variable, y nunca muestra un valor. `instrumentation.ts` y `server/arranque.ts` hacen la validación al arrancar: si falla, salen con código 1. Durante `next build` no se valida, porque el CI compila sin variables.
- **E0-3:**
  - `server/db/index.ts`: grupo de conexiones (10 conexiones, tiempos máximos de 5 s para conectar y de 15 s por consulta, y un error en una conexión inactiva queda en el registro sin tumbar el proceso). Incluye `consulta`, `transaccion(trabajo, { ajustes })`, que equivale a `SET LOCAL` con `set_config(..., true)` parametrizado y nombre validado, `tx.candado(n)` (`pg_advisory_xact_lock`), `ping` y `cerrarGrupo`.
  - `scripts/migrate.mjs`: adaptado del de sticr.app. Aplica una transacción por archivo, toma un candado propio (7420101), guarda una huella sha256 en `migraciones_aplicadas`, pide confirmación si el destino no es local (`--si` en scripts) y nunca imprime la clave ni el texto crudo de Postgres.
  - `migrations/001_base.sql`: crea `instalacion` (una fila, `es_demo` falso), `negocio` (una fila y las columnas y límites de 3.3), `usuarios`, `sesiones` (solo el resumen del token y tope de 7 días), `permisos_rol` (el `CHECK` limita al catálogo de 19 delegables y la tabla trae los valores de fábrica del encargado), `bitacora` y `limites`.
  - `server/auth/permisos.ts` (catálogo) y `server/auth/tokens.ts` (token aleatorio y su resumen sha256).
- **E0-4:**
  - `server/http/errores.ts`: `{ error, mensaje }` (más `campos` en `datos-invalidos`) con `no-store`. Trae los códigos comunes de la sección 4, `ErrorApi`, `errorComun` y `leerCuerpo` (JSON y zod, con mensajes de zod en español), y `conManejoDeErrores`: un error no controlado da 500 `error-interno` en español, sin traza, y queda en el registro solo con su tipo y su código. Incluye el id por petición.
  - `server/http/registro.ts`: una línea JSON por evento. Omite campos con nombre de dato personal o secreto, textos que parecen correo, teléfono o token, y recorta lo largo.
  - `server/servicios/salud.ts` y `app/api/health/route.ts`: 200 `{ "estado": "ok" }`, o 503 `{ "estado": "error", "error": "servicio-no-disponible", "mensaje" }`. Hace un solo `SELECT 1` a la vez, con 2 s de tiempo máximo y 3 s de vigencia.
  - `app/api/[...resto]/route.ts`: toda ruta de `/api` que no existe responde 404 JSON `no-encontrado`, con cualquier método (decisión del PM).
- **E0-5:**
  - `proxy.ts` y `server/http/enrutado.ts` (función pura). Un Host desconocido da 404, salvo `/api/health`, que la prueba de salud de Railway llama con su propio Host.
  - En la tienda, `/panel` y `/api/admin` dan 404, también disfrazados: mayúsculas, `%70anel`, barras dobles, barra invertida.
  - En el panel, por decisión del PM, toda página se reescribe por dentro a `/panel/...`: `crumble-admin…/pedidos` sirve `/panel/pedidos`. La API, `/imagenes`, `/marcas`, `/iconos` y los íconos pasan tal cual.
  - Los 404 de páginas en una dirección conocida se reescriben al 404 de su lado (el `[...resto]` de Frontend). El 404 propio del proxy (`lang="es-CR"`) queda solo para un Host desconocido.
  - El proxy pone `x-id-peticion` (reemplaza el que mande el navegador) y lo devuelve como `X-Id-Peticion`. Agrega `X-Robots-Tag: noindex, nofollow` en el panel y en toda la demo.
  - `server/http/cabeceras.ts` y `next.config.ts`: CSP sin terceros (`'unsafe-inline'` sin nonces, como sticr.app, para no perder la caché de la tienda), HSTS `max-age=31536000` sin `includeSubDomains`, `nosniff`, `Referrer-Policy` (`no-referrer` en `/pedido/*` y `/mi-pedido/*`), `X-Frame-Options`, COOP, CORP y `Permissions-Policy`.
- **E0-6:**
  - `vitest.config.mts` con `globalSetup` (`tests/ayudas/base.ts`), que vacía y migra la base de `TEST_DATABASE_URL`. Solo acepta una base local `*_test` distinta de `DATABASE_URL`, y en CI falla si falta la variable. Las pruebas corren un archivo a la vez.
  - Ayudas en `tests/ayudas/datos.ts` (`crearUsuario`, `crearSesion` vigente, vencida o revocada, `limpiarUsuarios`) y en `tests/ayudas/entorno.ts` (instalación ficticia con secretos al azar).
  - Registro de rutas: `server/http/ruta-admin.ts` (`rutaAdmin(acceso, manejador)` llama a la puerta en la primera línea y pone `no-store`), la puerta provisional `server/auth/puerta.ts` (falla cerrada con 401 hasta B2 y B3) y el revisor `tests/ayudas/registro-rutas.ts`, con su prueba `tests/permisos/registro-rutas.test.ts` y rutas de ejemplo malas en `tests/permisos/ejemplos/`.
- Documentación: `docs/api.md` (direcciones, convenciones, `/api/health` y cómo declarar una ruta del panel), `README.md` (migraciones, pruebas con Postgres y prueba contra servidor real) y `.env.example` (solo notas, ninguna variable nueva).

Commits: `ceb5e01` (E0-2), `4de3d4b` (E0-3), `ee9baa5` (E0-4), `ce5f669` (E0-5), `a985d65` y `e77ab7a` (E0-6), `bb03ddd` (docs), `c2d4bda` (arreglo de la reescritura), más el de esta entrega.

## Cómo se comprobó
Con un Postgres 16 desechable levantado para esta tarea (127.0.0.1, puerto y carpeta únicos, apagado y borrado al terminar) y `TEST_DATABASE_URL` hacia `crumble_test`:
- `npm run lint` → sin errores ni avisos.
- `npm run typecheck` → sin errores.
- `npm test` → 8 archivos, **116 pruebas pasan** y 10 se omiten (las del servidor real, que piden `URL_SERVIDOR_PRUEBA`). Dos corridas seguidas dan el mismo resultado.
- `CI=true npm test` sin `TEST_DATABASE_URL` → falla con "En CI, TEST_DATABASE_URL es obligatoria".
- Criterios de 11.4 cubiertos por pruebas:
  - E0-2: sin `DATABASE_URL`, o con `MODO_DEMO=true` sin `DEMO_RESET_MINUTOS`, no arranca y lo dice en español. `register()` llama a `process.exit(1)` y el mensaje no contiene el valor.
  - E0-3: migrar dos veces una base vacía deja el mismo esquema (columnas, restricciones, índices y datos de fábrica), también al migrar otra base desde cero. Editar una migración aplicada detiene el ejecutor. Dos ejecuciones simultáneas: una aplica y la otra no encuentra nada. Una migración rota se revierte entera. Hay pruebas del CLI y de la guarda de la base.
  - E0-4: con la base caída (puerto cerrado), `/api/health` da 503 `estado: error` sin detalles. Un error no controlado da 500 en español sin traza y el registro no lleva el mensaje, ni correos, ni teléfonos, ni la clave.
  - E0-5: Host desconocido → 404. `/api/admin` y el panel en la tienda → 404. Las cabeceras están en una página de la tienda, una del panel y una respuesta de la API.
  - E0-6: las rutas de ejemplo sin permiso, con un permiso inventado, públicas fuera de la lista, con un método sin declarar, dentro de un grupo de rutas o con la marca pegada a mano (responde 200 sin sesión) hacen fallar la revisión. La app real pasa.
- `npm run build` sin variables de la instalación → el primer intento se detiene con el aviso de Next.js a agentes y el segundo compila **sin errores ni avisos** (`ƒ /api/[...resto]`, `ƒ /api/health`, `ƒ Proxy`). No ejecuté la actualización que el aviso propone.
- `npm audit --omit=dev --audit-level=high` → sale con 0. Sigue el mismo moderado de `next` de la entrega de DevOps.
- Búsqueda de direcciones de base con clave y de tokens conocidos en el árbol → solo los valores falsos de las pruebas (`CLAVE`, `SECRETO`).
- **Servidor real, solo mi rama** (`next build` y `next start`): sin variables, el proceso sale con 1 y lista diez variables sin mostrar el valor que se le pasó. Con variables válidas, `tests/servidor` pasa 8 de 8 (la versión anterior a la decisión del panel en la raíz), y `curl` confirma las cabeceras en la tienda, el panel, la API, el Host desconocido y `/api/admin` en la tienda.
- **Servidor real, mi rama unida con `origin/feat/etapa0-frontend`** en un worktree temporal: la unión entra sin conflictos. `npm ci`, lint, tipos y `npm test` (121 pruebas) pasan, y el build también (al segundo intento, por el aviso). `tests/servidor` pasa **10 de 10**: la raíz del panel muestra la página del panel (200, "En construcción · Panel de Crumble"), `/pedidos`, `/panel` y `/privacidad` en el panel dan el 404 del panel, `/panel` en la tienda da el 404 de la tienda, `/api/nada` y `/api/admin/no-existe` dan 404 JSON, y `/api/health` responde con el Host de Railway.
- **Defecto encontrado y corregido en esa prueba:** la reescritura del panel daba 404, porque se armaba con `peticion.url` y Next.js la trataba como externa. Ahora se arma con `nextUrl` y queda una prueba de regresión en `tests/servidor`. Ver el riesgo sobre `-H` abajo.

## Decisiones tomadas
- **Tabla del ejecutor `migraciones_aplicadas`** (`version`, `nombre`, `huella`, `aplicada_en`), en español como el resto del código. Lleva un candado propio, distinto del de sticr.app.
- **SSL de la base por la propia `DATABASE_URL`** (`?sslmode=require` si hace falta). En Railway la base va por la red privada. Así no se suma ninguna variable (5.7 dice "no hay variables nuevas").
- **Comando previo al despliegue: `npm run migrate -- --si`.** Igual que en el sitio, el ejecutor pide confirmación si el destino no es local, y en Railway no hay terminal.
- **`/api/health` responde con cualquier Host:** la prueba de salud de Railway no usa las direcciones de la instalación. Solo dice `ok` o `error`.
- **El 503 de salud lleva `estado` y además `error` y `mensaje`:** cumple 4.1 (`estado`) y el formato común a la vez.
- **El panel en la raíz se arma con reescritura interna** (decisión del PM). `/panel/x` en el panel cae en `/panel/panel/x` y da 404, para que cada pantalla tenga una sola dirección.
- **`negocio` sin fila ni columnas que apunten a tablas que aún no existen** (`bodega_venta_id`, `bodega_produccion_id`, `logo_imagen_id`): llegan con su migración. La fila la crea la instalación o la semilla (B5). **`instalacion` nace con `es_demo = false`**: la semilla de la demo debe ponerlo en verdadero a propósito.
- **Permiso `propietaria`** para lo que 5.4 deja solo a la propietaria sin nombrarlo (usuarios, permisos, bitácora, anonimizar, reabrir y la tarifa de IVA). B3 puede partirlo en nombres propios.
- **Puerta que falla cerrada en la Etapa 0:** `requierePermiso` ya tiene su firma definitiva y hoy siempre responde 401. B2 y B3 cambian su cuerpo, no a quienes la llaman.
- **`campos` de `datos-invalidos`** es un objeto `ruta.del.campo → mensaje`. El contrato no fijaba la forma.
- **Las variables de soporte son opcionales por ahora** (las tres juntas o ninguna), para no bloquear E0-9 antes de que exista el botón. Pasan a obligatorias cuando se construya.
- **No toqué archivos de Frontend:** layouts, páginas y `lib/dinero.ts`, que todavía no existe.

## Pendientes y riesgos
- **Para Frontend:**
  - Cambiar `<html lang="es">` a **`lang="es-CR"`** en `app/(tienda)/layout.tsx` y `app/(panel)/layout.tsx` (decisión del PM; no los toqué).
  - Con el panel en la raíz, el enlace del 404 del panel debe apuntar a **`/`**, no a `/panel`, y los enlaces internos del panel van sin `/panel` (por ejemplo, `/pedidos`).
  - Las rutas de `/api/admin` se definen con `rutaAdmin` (`docs/api.md`).
- **Para B1:** el separador de miles de `lib/dinero.ts` debe ser **U+00A0** (el de `Intl` `es-CR`), no U+202F (decisión del PM). El archivo aún no existe.
- **Para DevOps (E0-9):**
  - El comando previo al despliegue es `npm run migrate -- --si`.
  - **Arrancar con `npm run start` (`next start` sin `-H`).** Si el servidor se arranca atado a una IP concreta, Next.js trata la reescritura del panel como externa y el panel da 404 (comprobado en local). La prueba `tests/servidor` lo detecta. Conviene correrla contra el servicio desplegado, o sumar al CI un paso de `next start` y esa prueba, que hoy se omite.
- `npm audit`: sigue 1 moderado en `next` 16.4.3. El build vuelve a mostrar el aviso de Next.js que recomienda actualizar. No actualicé: la versión está fijada a propósito y es decisión del Project Manager (pregunta abierta de la entrega de DevOps).
- `/api/health` no tiene límite de intentos (como en el sitio). Lo protege la vigencia de 3 s y una sola consulta a la vez.
- La CSP lleva `'unsafe-inline'` en scripts y estilos (sin nonces, para conservar la caché de la tienda). Es el mismo compromiso del sitio. Seguridad debe revisarlo.
- Los commits intermedios E0-2 y E0-3 no compilan por sí solos (`server/db` usa `server/http/registro`, que llega en E0-4). La punta de la rama sí compila. Si se hace "squash" en el PR, no importa.

## Preguntas para el Project Manager
- ¿Va bien el nombre `propietaria` para los permisos solo de la propietaria que 5.4 no nombra, o el Arquitecto prefiere nombres propios desde ya?
- ¿Se suma al CI un paso que arranque el servidor y corra `tests/servidor`? Es de DevOps; hoy se corre a mano.
- La ruta del estado del pedido: 11.2 dice `pedido/[token]` y el ejemplo de 4.1 `mi-pedido/<token>`. Las cabeceras cubren las dos; conviene fijar una.

## Dependencias nuevas
- Ninguna. Se usan `pg`, `zod` y `next`, que ya estaban.

## Correcciones tras la revisión

Revisión de Seguridad (`docs/entregas/seguridad-etapa0.md`, rama `docs/seguridad-etapa0`) y de QA (`docs/entregas/qa-etapa0.md`, rama `docs/qa-etapa0`) sobre `feat/etapa0` en `9c40f62`. Corregido el 19 nov 2026 en `feat/etapa0`.

| Hallazgo | Qué se hizo | Prueba |
| --- | --- | --- |
| **M4.** El panel salía con `s-maxage=31536000` | `proxy.ts` pone `Cache-Control: private, no-store, max-age=0` en **toda** respuesta del panel (páginas, 404 y API). Contra el servidor real, gana sobre el `s-maxage` de la página prerenderizada. No toqué el layout del panel, que es de Frontend (ver pendientes) | `tests/unit/enrutado.test.ts` y `tests/servidor` ("M4") |
| **B1.** `/%`, `/%E0%A4%A` y `/panel/%ZZ` daban 500 en inglés y una línea de error en el registro por petición | `decidir` devuelve `ruta-invalida` y el proxy responde 404 JSON `no-encontrado` (formato común, cabeceras de seguridad, `no-store`) sin pasar a Next.js. Las dos direcciones | Pruebas unitarias (no se escribe nada en la consola) y `tests/servidor`. El registro del servidor real quedó sin errores. En CI, el paso nuevo falla si el servidor registra un error |
| **QA, observación del puerto.** `tienda.prueba.local:443` daba 404 | `normalizarHost` quita `:443` y `:80`. Otro puerto sigue siendo Host desconocido | Unitarias y `tests/servidor` |
| **B2.** Se exponen `x-middleware-rewrite` y `x-nextjs-rewritten-path` | **No se puede quitar desde la aplicación.** Next.js 16.4.3 las agrega después del proxy (`server/lib/router-utils/resolve-routes.js`), y el enrutador del navegador las usa en las peticiones RSC: quitarlas rompería la navegación del panel. Queda documentado en `docs/api.md`. Si se quiere, se podría filtrar `x-middleware-rewrite` en la plataforma para peticiones que no son RSC | No aplica |
| **M3.** Puntos ciegos del revisor de rutas | El revisor recorre todo `route.ts` y revisa los que pueden atender `/api/admin/...` o `/panel/...`, también con `[x]`, `[...x]` y `[[...x]]` (función `puedeAtender`). En `/panel/...` nada puede ser público. `api/[...resto]` está exceptuada, pero debe responder 404. Nueva búsqueda de `"use server"` en `app`, `components`, `server` y `lib` (al inicio del archivo o dentro de una función). Ejemplos nuevos: los dos casos de ataque de Seguridad (`app/(panel)/panel/exportar/route.ts` y `app/api/[seccion]/[...r]/route.ts`), una descarga del panel pública, un comodín opcional en la raíz, un 404 de la API que responde 200 en POST, y dos Server Actions | `tests/permisos/registro-rutas.test.ts`: 11 problemas detectados en los ejemplos, 0 en la aplicación real, y casos de `puedeAtender` |
| **B5.** La guarda aceptaba `postgresql:///x_test` (sin host: pg usaría `PGHOST`) | Exige el host explícito `localhost` o `127.0.0.1` | `tests/api/migraciones.test.ts` (sin host, sin host con usuario e IPv6 se rechazan) |
| **B6.** CI sin fijar y sin `tests/servidor` | `runs-on: ubuntu-26.04` (la imagen con que corre hoy `ubuntu-latest`). `postgres:16@sha256:3950ad7c…382f`: el resumen que descargó el CI en la ejecución 44500001661, porque desde aquí no hay acceso a Docker Hub. Paso nuevo tras el build: `next start` con una instalación ficticia (secretos con `openssl rand`), `tests/servidor` y fallo si el servidor registró errores | El CI de esta corrección (abajo) |

**Cómo se comprobó** (worktree propio desde `origin/feat/etapa0`; Postgres 16 desechable en `/var/lib/postgresql/<nombre único>` y puerto único, ya apagado y borrado):
- `npm run lint` y `npm run typecheck` → sin errores.
- `npm test` con `TEST_DATABASE_URL` → 10 archivos, **129 pasan** y las 13 de servidor real se omiten.
- `npm run build` → el primer intento se detiene con el aviso de Next.js y el segundo compila sin avisos. No ejecuté `next upgrade`.
- `next start` (sin `-H`) y `tests/servidor` → **13 de 13**. El panel sale con `private, no-store`; `/%` y `/panel/%ZZ` dan 404 JSON; `tienda.prueba.local:443` sirve la tienda. El registro del servidor no tiene ninguna línea de error.
- `npm audit --omit=dev --audit-level=high` → sale con 0.

**Quedan para después:**
- **M5:** CSP con nonce en el panel, antes de la etapa 8.
- **M6:** subir `next` a 16.4.6, decisión del PM, antes de la primera historia con `'use cache'`.
- **B3** (migraciones) y **B4** (variedad y repetición de secretos), cuando convenga.
- **Para Frontend (recomendación):** además del `no-store` del proxy, conviene que el layout del panel sea dinámico (`export const dynamic = "force-dynamic"` según la guía). Así el servidor tampoco guarda el armazón como prerender (hoy responde `x-nextjs-cache: HIT`, aunque el navegador y cualquier caché compartida reciben `no-store`).
- **M1** (repositorio público) y **M2** (protección de `main`) son del dueño, antes de E0-9.
