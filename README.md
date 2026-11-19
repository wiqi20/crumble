# Crumble

Tienda en línea de pastelería con panel administrativo, construida por STI (sticr.app).

- **Tienda** (`crumble.sticr.app`): portada, ideas de pasteles, configurador «Arma tu pastel», pedido y estado del pedido.
- **Panel** (`crumble-admin.sticr.app`): pedidos, pagos, saldos a favor, precios, configurador, inventario, compras, producción, usuarios y permisos.
- **Demo** (`pasteleria-demo.sticr.app` y `pasteleria-demo-admin.sticr.app`): la misma aplicación con `MODO_DEMO=true` y datos de ejemplo.

Una instalación por cliente: cada una es un servicio Node en Railway con su propio Postgres. Tienda, panel y API viven en una sola aplicación Next.js que enruta por `Host`.

Las reglas, los estándares y el diseño del proyecto están en el repositorio `wiqi20/STICR_landingpage`, en `docs/proyectos/crumble/` (sobre todo `diseno-tecnico.md`). Lee `CLAUDE.md` y `AGENTS.md` antes de escribir código.

## Estado

Etapa 0 (preparación): esqueleto, CI, configuración validada, migraciones, formato de error, `/api/health` con la base, enrutado por `Host`, cabeceras de seguridad y registro de rutas del panel. La API está en `docs/api.md`.

## Stack

- Next.js 16.4.3 (App Router) y React 19.3.0, las mismas versiones que sticr.app.
- TypeScript estricto, ESLint (`eslint-config-next`), Tailwind 4.
- Postgres con `pg` y SQL parametrizado, sin ORM. Validación con `zod`.
- Pruebas con Vitest.
- Node.js 22.

## Cómo correrlo en local

Requisitos: Node.js 22 y npm. Para las pruebas con base (desde la etapa E0-6), un Postgres 16 local.

```bash
npm ci                     # instala exactamente lo de package-lock.json
cp .env.example .env.local # y llena los valores (nunca los subas al repositorio)
npm run dev                # http://localhost:3000
```

El servicio **no arranca** si falta una variable o no es válida: dice cuál, sin mostrar valores. En local, `URL_TIENDA` y `URL_PANEL` pueden ser `http://localhost:3000` y `http://127.0.0.1:3000` (dos nombres para la misma máquina: uno abre la tienda y el otro el panel).

```bash
npm run migrate            # aplica migrations/ a DATABASE_URL (pide confirmación si no es local)
```

Comprobación rápida: `http://localhost:3000/api/health` debe responder `{"estado":"ok"}`.

### Pruebas con Postgres

`npm test` usa `TEST_DATABASE_URL`: una base **local** cuyo nombre termina en `_test` (por ejemplo `postgresql://usuario@127.0.0.1:5432/crumble_test`). Antes de las pruebas se vacía y se le aplican las migraciones. Sin esa variable, las pruebas con base se omiten (en CI son obligatorias).

Prueba contra un servidor real (cabeceras y enrutado por `Host`), opcional: `npm run build`, arrancar `npm run start` con `URL_TIENDA=https://tienda.prueba.local` y `URL_PANEL=https://panel.prueba.local`, y correr `URL_SERVIDOR_PRUEBA=http://127.0.0.1:3000 npx vitest run tests/servidor`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Sirve la compilación de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Pruebas con Vitest |
| `npm run migrate` | Aplica las migraciones pendientes de `migrations/` (una transacción por archivo, candado, huella). En Railway, como comando previo al despliegue: `npm run migrate -- --si` |

## Variables de entorno

Los nombres están en `.env.example`, sin valores. En local van en `.env.local`; en Railway, en las variables de cada servicio. Ningún valor se escribe en el código ni en los documentos.

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Postgres de la instalación |
| `URL_TIENDA`, `URL_PANEL` | Direcciones de la tienda y del panel: enrutado por `Host`, `Origin` exacto, retorno de Google |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Inicio de sesión con Google (no se usan en la demo) |
| `SESSION_SECRET` | Firma del estado del inicio de sesión |
| `PROPIETARIA_EMAIL` | Correo de la primera propietaria, que se crea al instalar |
| `IP_HASH_SALT` | Sal del resumen de la IP |
| `MODO_DEMO`, `DEMO_RESET_MINUTOS` | Modo demo y cada cuántos minutos se restablece |
| `RETENCION_PEDIDOS_MESES` | Meses tras los que se borran los datos personales de los pedidos |
| `ESTADO_SERVICIO` | `activo` o `suspendido`; lo cambia solo el dueño de STI |
| `SOPORTE_URL`, `SOPORTE_ORIGEN`, `SOPORTE_SECRETO` | Botón «Reportar un problema»: dirección de la recepción en sticr.app, origen de la instalación (`crumble` o `pasteleria-demo`) y su secreto |
| `TEST_DATABASE_URL` | Solo pruebas: Postgres local cuyo nombre termina en `_test` |

## Estructura

```
app/(tienda)/        páginas públicas de la tienda
app/(panel)/panel/   páginas del panel
app/api/             manejadores de ruta (capa de rutas: valida con zod, llama al servicio, responde)
app/imagenes/        imágenes servidas desde Postgres
server/              solo servidor: config, db, http, auth, servicios, repos, importacion, trabajos
lib/                 código puro compartido (sin acceso a datos); lib/contrato con los esquemas zod de la API
components/          tienda, panel y comunes
styles/              tokens de la tienda y del panel
migrations/          NNN_nombre.sql
scripts/             migrate.mjs y semilla de la demo
tests/               unit, api, permisos, ayudas, archivos-hostiles
e2e/                 Playwright (QA)
docs/entregas/       entregas de cada especialista
```

## Integración continua

`.github/workflows/ci.yml` corre en cada rama y en cada PR a `main`:

1. **verificar:** `npm ci`, lint, `tsc --noEmit`, pruebas (con un Postgres 16 de servicio), build y `npm audit --omit=dev --audit-level=high`.
2. **secretos:** gitleaks sobre todo el historial de git.

Los cambios entran a `main` solo por PR con las dos verificaciones en verde.
