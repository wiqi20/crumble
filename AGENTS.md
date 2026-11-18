<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Nota para los agentes de STI

Esta es Next.js **16.4.3** (la misma versión que sticr.app). Antes de escribir código, lee la guía instalada en `node_modules/next/dist/docs/` (ejecuta `npm ci` primero). Algunos cambios que importan en este proyecto:

- `middleware` ahora se llama **`proxy.ts`** (`01-app/01-getting-started/16-proxy.md`). No es un mecanismo de autorización: los permisos van en cada ruta.
- Manejadores de ruta: `01-app/01-getting-started/15-route-handlers.md`.
- Caché y revalidación: `01-app/01-getting-started/08-caching.md` y `09-revalidating.md`.
- Despliegue: `01-app/01-getting-started/17-deploying.md`.

Las reglas del proyecto están en `CLAUDE.md`.
