# API de Crumble

Documento vivo de la API. Fuente: `diseno-tecnico.md` (sección 4) en `wiqi20/STICR_landingpage`. Backend lo mantiene al día con cada ruta nueva. Estado: **Etapa 0** (convenciones, salud y registro de rutas del panel).

## Direcciones

Una sola aplicación atiende dos direcciones por instalación (`URL_TIENDA` y `URL_PANEL`); `proxy.ts` decide por la cabecera `Host`:

| Host | Qué sirve |
| --- | --- |
| Tienda (`crumble.sticr.app`) | Páginas de la tienda y la API pública. `/panel` y `/api/admin/*` → 404 |
| Panel (`crumble-admin.sticr.app`) | El panel **en la raíz**: `/pedidos` se reescribe por dentro a `/panel/pedidos`. La API (`/api/*`, incluida `/api/admin/*`), `/imagenes/*` e íconos pasan tal cual. Toda respuesta lleva `X-Robots-Tag: noindex, nofollow` y `Cache-Control: private, no-store, max-age=0` (nunca en caché, aunque la página esté prerenderizada) |
| Cualquier otro | 404. Única excepción: `GET /api/health` (prueba de salud de Railway) |

En la demo (`MODO_DEMO=true`), la tienda también lleva `X-Robots-Tag: noindex, nofollow`.

- El `Host` se compara sin mayúsculas, sin punto final y sin el puerto estándar (`:443` o `:80`); otro puerto es un Host desconocido.
- Una ruta con codificación ilegible (`/%`, `/panel/%ZZ`) responde 404 JSON `no-encontrado` desde el proxy, en las dos direcciones, sin llegar a Next.js ni escribir en el registro.
- Las respuestas reescritas llevan `x-middleware-rewrite` (y, en peticiones RSC, `x-nextjs-rewritten-path`). Las pone Next.js después del proxy y el enrutador del navegador las necesita; no se pueden quitar desde la aplicación. Revelan solo la ruta interna (`/panel/...`), no dan acceso a nada.

## Convenciones

- JSON. Todo error tiene la forma:

  ```json
  { "error": "codigo-corto", "mensaje": "Texto en español para mostrar." }
  ```

  con `Cache-Control: no-store`, sin trazas, consultas ni rutas internas. `400 datos-invalidos` agrega `campos` (ruta del campo → mensaje en español):

  ```json
  { "error": "datos-invalidos", "mensaje": "Los datos enviados no son válidos. Revisa los campos marcados.", "campos": { "lineas.0.cantidad": "Demasiado grande: se esperaba que número fuera <=20" } }
  ```

- Códigos comunes: 400 `datos-invalidos`, 401 `sin-sesion`, 403 `sin-permiso`, 403 `no-disponible-en-demo`, 403 `origen-no-permitido`, 404 `no-encontrado`, 409 `conflicto`, 413 `archivo-muy-grande`, 415 `tipo-no-permitido`, 422 `archivo-ilegible`, 429 `demasiadas-peticiones` (con `Retry-After`), 500 `error-interno`, 503 `servicio-no-disponible`. Textos en `server/http/errores.ts` (`MENSAJES`).
- Una ruta de `/api` que no existe responde **404 JSON** `no-encontrado` (`app/api/[...resto]/route.ts`), con cualquier método.
- Cada respuesta lleva `X-Id-Peticion` (UUID). Es el mismo id que aparece en los registros del servidor; sirve para que soporte encuentre una petición sin pedir datos personales. Un `x-id-peticion` que mande el navegador se descarta.
- Cabeceras de seguridad en toda respuesta: CSP sin terceros, `Strict-Transport-Security: max-age=31536000` (sin `includeSubDomains`), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` en `/pedido/*` y `/mi-pedido/*`), `X-Frame-Options: DENY`, COOP y CORP `same-origin`, `Permissions-Policy`.

## Rutas

### `GET /api/health`

- **Quién:** cualquiera, con cualquier `Host`. Sin límite de intentos.
- **Entrada:** ninguna.
- **200:** `{ "estado": "ok" }` — el servicio y la base responden.
- **503:** `{ "estado": "error", "error": "servicio-no-disponible", "mensaje": "El servicio no está disponible en este momento. Intenta de nuevo en unos minutos." }` — la base no responde en 2 s (o la configuración no es válida). Sin detalles.
- `Cache-Control: no-store`. El resultado se reutiliza 3 s y nunca hay más de una comprobación a la vez, para no agotar las conexiones.

## Panel: cómo se declara una ruta de `/api/admin/*`

Toda ruta del panel se define con `rutaAdmin` (`server/http/ruta-admin.ts`), que llama a la puerta `requierePermiso` **antes** que cualquier otra cosa:

```ts
export const GET = rutaAdmin("pedidos.ver", async (peticion, contexto, usuario) => { ... });
```

- El acceso es un permiso del catálogo (`server/auth/permisos.ts`, sección 5.4), `"sesion"` (cualquier usuario con sesión) o `"publica"` (solo las rutas de inicio de sesión: `/api/admin/auth/google`, `/api/admin/auth/google/callback` y `/api/admin/auth/demo`).
- La prueba `tests/permisos/registro-rutas.test.ts` recorre **todo** `route.ts` de `app` que el panel pueda alcanzar: los que pueden atender `/api/admin/...` (también por segmentos dinámicos como `api/[x]/[...r]`) y los que pueden atender `/panel/...` (por ejemplo, una descarga en `app/(panel)/panel/exportar/route.ts`). Falla si un método exportado no se definió con `rutaAdmin`, si declara un permiso fuera del catálogo, si es público sin estar en esa lista (en `/panel/...` nada puede ser público) o si sin sesión responde algo distinto de 401. `api/[...resto]` está exceptuada y solo debe responder 404.
- No se usan Server Actions (`"use server"`): la misma prueba falla si aparecen en `app`, `components`, `server` o `lib`. Toda escritura va por `app/api`.
- Las respuestas del panel van con `Cache-Control: no-store`.
- **Etapa 0:** todavía no hay sesión (B2) ni lectura de permisos (B3): la puerta falla cerrada y toda ruta no pública responde `401 sin-sesion`.

Catálogo: 19 permisos delegables (con su valor de fábrica para el encargado en `permisos_rol`) y los solo de la propietaria `precios.editar`, `costos.ver`, `inventario.ajustar`, `inventario.anular`, `compras.anular`, `portada.editar`, `negocio.descuento_inventario`, `saldos.administrar` y `propietaria` (usuarios, permisos, bitácora, anonimizar, reabrir pedidos cancelados, IVA).
