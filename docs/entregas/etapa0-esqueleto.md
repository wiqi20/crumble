# Entrega: DevOps · Crumble, Etapa 0: esqueleto (E0-1) y CI (E0-8)

- **Fecha:** 17 nov 2026
- **Rama / archivos:** `main` (commit inicial) y `feat/etapa0-esqueleto` en `wiqi20/crumble`. Sin PR ni unión a `main`.
- **Veredicto** (solo revisores): no aplica

## Resumen
El repositorio `wiqi20/crumble` ya tiene el esqueleto de la sección 11 del diseño técnico: Next.js 16.4.3 y React 19.3.0 fijos (las mismas que sticr.app), TypeScript estricto, ESLint, Tailwind 4, Vitest, `pg` y `zod` sin ORM, la estructura de carpetas de 11.2, una página mínima en `/` y `GET /api/health` que responde `{"ok":true}` sin tocar la base. El CI de GitHub Actions corre lint, tipos, pruebas con Postgres de servicio, build, `npm audit --omit=dev` (nivel alto) y gitleaks. Todo pasa en local, también en un clon limpio. No se creó nada en Railway ni en Netlify.

## Qué se entrega
- `package.json` y `package-lock.json`: versiones exactas (sin `^`). Producción: `next` 16.4.3, `react` y `react-dom` 19.3.0, `pg` 8.23.1, `zod` 4.6.7. Desarrollo: `typescript` 5.9.3, `eslint` 9.39.5, `eslint-config-next` 16.4.3, `tailwindcss` y `@tailwindcss/turbopack` 4.3.3, `vitest` 5.0.5, `@types/*`. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `migrate`. `engines.node` en 22.
- `tsconfig.json` (estricto), `eslint.config.mjs`, `next.config.ts` (Tailwind con el cargador de Turbopack, como el sitio; sin cabecera `X-Powered-By`), `vitest.config.mts` (alias `@` y sustituto de `server-only`, como el sitio).
- `app/layout.tsx` (`lang="es"`), `app/page.tsx` (página provisional en español), `app/globals.css` (solo `@import "tailwindcss"`).
- `app/api/health/route.ts`: `GET` → 200 `{"ok":true}` con `Cache-Control: no-store`, dinámica (`ƒ` en el build).
- `tests/unit/health.test.ts`: prueba de la ruta de salud. `tests/ayudas/server-only.ts`.
- `scripts/migrate.mjs`: **marcador** que no se conecta a nada y termina sin error, para que `npm run migrate` exista ya como comando previo al despliegue. Backend lo reemplaza en E0-3.
- Carpetas vacías de 11.2 (con `.gitkeep`): `app/(tienda)`, `app/(panel)/panel`, `app/api/{tienda,inicio,ideas,configurador,retiro,carrito,pedidos,admin}`, `app/imagenes`, `server/{db,http,auth,servicios,repos,importacion,trabajos}`, `lib/contrato`, `components/{tienda,panel,comunes}`, `styles`, `public/marcas/demo`, `migrations`, `tests/{api,permisos,archivos-hostiles}`, `e2e`.
- `.env.example`: todas las variables de 5.7 (`DATABASE_URL`, `URL_TIENDA`, `URL_PANEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `PROPIETARIA_EMAIL`, `IP_HASH_SALT`, `MODO_DEMO`, `DEMO_RESET_MINUTOS`, `RETENCION_PEDIDOS_MESES`, `ESTADO_SERVICIO`), las de soporte (`SOPORTE_URL`, `SOPORTE_ORIGEN`, `SOPORTE_SECRETO`) y `TEST_DATABASE_URL` (solo pruebas). Todas vacías.
- `.gitignore`: dependencias, `.next`, `.env*` (salvo `.env.example`), llaves y volcados de base.
- `README.md`: qué es, cómo correrlo en local, scripts, variables, estructura y CI.
- `CLAUDE.md`: remite a `wiqi20/STICR_landingpage` (`docs/proyectos/crumble/`, estándares, `AGENCIA.md`); todo el texto en español.
- `AGENTS.md`: el bloque que escribe `next dev` (idéntico al de `generate-agent-files.js`, para que no aparezca como cambio) y una nota con las guías de `node_modules/next/dist/docs/` que importan aquí (`proxy.ts`, manejadores de ruta, caché, despliegue).
- `.github/workflows/ci.yml`: dos trabajos.
  - **verificar:** `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (con Postgres 16 de servicio y `TEST_DATABASE_URL` hacia `crumble_test`), `npm run build`, `npm audit --omit=dev --audit-level=high`.
  - **secretos:** gitleaks 8.30.1 sobre todo el historial (`fetch-depth: 0`), descargado de la versión oficial con suma sha256 comprobada.
  - Se dispara en cada `push` a cualquier rama y en cada PR a `main`. Permisos `contents: read`, acciones fijadas por commit (`actions/checkout` v7.0.1, `actions/setup-node` v7.1.0), `persist-credentials: false`.

## Cómo se comprobó
En `/home/claude/crumble` y además en un clon limpio de la rama (`npm ci` desde cero):
- `npm ci` → sin errores.
- `npm run lint` → sin errores ni avisos.
- `npm run typecheck` (`tsc --noEmit`) → sin errores.
- `npm test` → 1 archivo, 1 prueba, pasa.
- `npm run build` → sin errores; rutas `○ /`, `○ /_not-found`, `ƒ /api/health`. En un entorno como el de CI (variables limpias, `CI=true`) compila a la primera (ver riesgos sobre el aviso de Next a agentes).
- `npm audit --omit=dev --audit-level=high` → sale con 0. Queda 1 hallazgo **moderado** en `next` (ver riesgos).
- `npm run migrate` → imprime que aún no hay ejecutor y termina con 0.
- `next start` y peticiones reales: `GET /api/health` → `200`, `content-type: application/json`, `cache-control: no-store`, cuerpo `{"ok":true}`; `GET /` → `<html lang="es">` con el texto provisional; una ruta inexistente → 404. El CSS compilado contiene las utilidades de Tailwind usadas en la página.
- Que el CI se ponga en rojo (simulado en local en el clon): un error de tipos hace fallar `typecheck` (salida 2); una prueba rota hace fallar `npm test` (salida 1); un token falso con forma de token de GitHub en un commit hace fallar gitleaks (salida 1, "leaks found: 1"). Ese commit de prueba se descartó y nunca salió del clon temporal.
- gitleaks 8.30.1 sobre todo el historial real de `wiqi20/crumble`, incluido el commit de esta entrega → "no leaks found"; además, archivo por archivo antes del commit → sin hallazgos.
- El YAML del flujo se validó con un analizador.
- **GitHub Actions, ejecución 44206070795 sobre `feat/etapa0-esqueleto`** (commit 37e3f0c) → **verde**: `verificar` en 1 min 23 s y `secretos` en 12 s. En el registro: Node 22.23.4 y npm 10.9.9; pruebas "1 passed"; build "Compiled successfully" con `ƒ /api/health` y sin el aviso de Next a agentes; auditoría de producción con "1 moderate severity vulnerability" (no falla porque el nivel es alto); "gitleaks.tar.gz: OK" (suma verificada), "4 commits scanned", "no leaks found". GitHub anota que `ubuntu-latest` pasa a Ubuntu 26 desde el 19 oct 2026; no afectó.

## Decisiones tomadas
- **Versiones exactas** (sin `^`) en `package.json`, como pide 11.1. Son las mismas que resuelve el `package-lock.json` de sticr.app en `origin/main`.
- **El `package-lock.json` se armó a partir del de sticr.app.** `npm install` desde cero falla en npm 10.9.9 con un error interno del resolvedor de dependencias entre pares (`Cannot read properties of null (reading 'edgesOut')`). Partir del lockfile del sitio, que ya resuelve exactamente estas versiones, y dejar que npm quite lo que sobra lo resolvió; `npm ci` desde cero funciona. Quedan seis paquetes opcionales de `sharp` para wasm que `npm ls` marca como "extraneous"; son opcionales de plataforma, igual que en el sitio, y no afectan.
- **Tailwind con `@tailwindcss/turbopack`**, como el sitio, en vez del plugin de PostCSS que muestra la guía. Mismo método que ya funciona en sticr.app, y "la misma base" que pide 11.1.
- **gitleaks como binario de versión fija con suma verificada**, no con `gitleaks-action`: no depende de licencias ni de tokens y no agrega una acción de terceros.
- **El Postgres de servicio ya está en CI** aunque todavía no haya pruebas con base: E0-6 (Backend) lo usa sin tocar el flujo. El nombre `TEST_DATABASE_URL` y la base `crumble_test` siguen la regla del sitio (base local que termina en `_test`). La contraseña del contenedor es de un Postgres desechable que solo existe durante el trabajo de CI; no es un secreto.
- **No creé lo que es de otras historias:** `server/config.ts` (E0-2), ejecutor de migraciones y `001_base.sql` (E0-3), formato de error y `/api/health` con base (E0-4), `proxy.ts` y cabeceras de seguridad (E0-5), registro de rutas (E0-6), tokens, fuentes, layouts de tienda y panel y favicon (E0-7). `instrumentation.ts` y `playwright.config.ts` llegan con quien los use. `jose` llega con B2 (sesión).
- `/api/health` responde `{"ok":true}` como pidió el encargo. E0-4 lo cambia a la forma `estado` del diseño; quien lo cambie actualiza la prueba.

## Pendientes y riesgos
- **Protección de `main` (parte de E0-8):** no la activé. Es un cambio de la configuración del repositorio que no estaba en el encargo y conviene que lo decida el dueño. Propuesta: el dueño la activa en GitHub (Settings → Branches o Rulesets): cambios solo por PR, verificaciones obligatorias `verificar` y `secretos`, sin empujes forzados ni borrado. Conviene hacerlo **después** de que el CI haya corrido una vez, para que GitHub ofrezca esos nombres.
- **Criterio de E0-8 en GitHub:** el caso limpio en verde está comprobado en GitHub (ejecución 44206070795, por `push`). El caso rojo ("un PR con error de tipos o prueba rota queda en rojo") lo comprobé en local, no en GitHub, porque no se pidió abrir PR. Se cierra con el primer PR real, o con un PR de prueba si el Project Manager lo pide.
- **`npm audit` de producción: 1 moderado en `next` 16.4.3** (avisos GHSA-mfr8-8qww-v76h y GHSA-vc7v-qv4w-wrv8, filtración de caché entre parámetros raíz con `'use cache'` y `unstable_cache`). Según npm, se corrige en 16.4.6. Hoy no usamos `'use cache'`. No bloquea (no es alto ni crítico), pero 11.1 pide la misma versión que el sitio: **decisión del Project Manager** si se sube a la vez en sticr.app y en Crumble.
- **`npm audit` completo (desarrollo): 11 altos y 7 moderados** en herramientas que no van en el servidor de producción (`picomatch`, `vite`, `vitest`, `eslint-config-next`, `typescript-eslint`, entre otros; ReDoS y similares). Mismo árbol que el sitio. Se anota; no bloquea según `seguridad.md`.
- **Aviso de Next.js a agentes:** dentro de una sesión de agente, el primer `next build` (y `next dev`) se detiene con un aviso para actualizar Next.js y pide volver a correr el comando; la segunda vez sigue. En GitHub Actions no pasa (lo comprobé con un entorno limpio). Ese aviso también trae instrucciones para que el agente ejecute una actualización; no la ejecuté, porque cambiar la versión de Next.js no estaba en el encargo y la versión está fijada a propósito. Recomiendo que ningún agente la ejecute por su cuenta.
- E0-9 (Railway) sigue esperando el visto bueno del dueño. No se creó ningún servicio ni base.

## Preguntas para el Project Manager
- ¿Se sube `next` a 16.4.6 (o la que corrija los avisos) a la vez en sticr.app y en Crumble, o se deja en 16.4.3 hasta otra ronda?
- ¿El dueño activa la protección de `main` con las verificaciones `verificar` y `secretos`, o me autoriza a hacerlo yo?
- Las entregas de Crumble, ¿se quedan en `docs/entregas/` de este repositorio (donde está esta) o se copian a `docs/proyectos/crumble/` de STICR_landingpage? Es la pregunta abierta de 11.2.
- La tabla 5.7 del diseño técnico dice "no hay variables nuevas", pero el estándar de soporte suma `SOPORTE_URL`, `SOPORTE_ORIGEN` y `SOPORTE_SECRETO`. Ya están en `.env.example`; falta que el Arquitecto actualice 5.7.

## Dependencias nuevas
- `next` 16.4.3, `react` 19.3.0, `react-dom` 19.3.0: el marco (11.1).
- `pg` 8.23.1: acceso a Postgres sin ORM (11.1).
- `zod` 4.6.7: validación de entradas y del contrato (11.1).
- Desarrollo: `typescript`, `eslint`, `eslint-config-next`, `tailwindcss`, `@tailwindcss/turbopack`, `vitest`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`. Todas ya se usan en sticr.app.
