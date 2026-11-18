# Crumble

Tienda en línea de pastelería con panel administrativo, construida por STI. Este repositorio tiene **solo el código**.

## Dónde están las reglas y los documentos

Las reglas, los estándares y los documentos del proyecto **no viven aquí**: viven en el repositorio **`wiqi20/STICR_landingpage`**. Antes de empezar cualquier tarea, lee allí:

1. `CLAUDE.md` y `docs/CONTEXTO.md`: qué es STI y las decisiones ya tomadas.
2. `docs/AGENCIA.md`: cómo trabaja el equipo de agentes (roles, flujo, puertas del dueño).
3. `docs/estandares/`: el estándar de tu rol, más `seguridad.md`, `soporte.md` y `terminado.md`.
4. `docs/proyectos/crumble/`: brief, `diseno-tecnico.md` (manda en alcance, modelo de datos, API y plan de construcción, sección 11), `diseno-ux.md`, maquetas, textos legales y logo.

Si algo de este repositorio contradice esos documentos, mandan los documentos: avisa al Project Manager antes de seguir.

## Reglas de este repositorio

- **Todo texto va en español**: interfaz, mensajes de error, comentarios, documentación, commits y entregas.
- Next.js 16 cambió: lee `AGENTS.md` y la guía instalada en `node_modules/next/dist/docs/` antes de escribir código (por ejemplo, el antiguo `middleware` ahora es `proxy.ts`).
- Ningún secreto en el código ni en los documentos. Todo va en variables de entorno; `.env.example` lleva solo los nombres.
- Los permisos se comprueban en el servidor, en la primera línea de cada ruta de `/api/admin/*` (`requierePermiso`, diseño técnico 5.4).
- Toda escritura pasa por la API (`app/api/**`); SQL siempre parametrizado con `pg`, sin ORM.
- Cada historia en su rama (`feat/...`) y PR a `main` con CI en verde. Nadie aprueba su propio PR.
- Antes de pedir revisión: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` sin errores.
- Las entregas usan la plantilla `docs/plantillas/entrega.md` de `wiqi20/STICR_landingpage` y se guardan en `docs/entregas/` de este repositorio (o en `docs/proyectos/crumble/` de STICR_landingpage, si el Project Manager así lo decide).
