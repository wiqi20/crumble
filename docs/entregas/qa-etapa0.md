# Entrega: QA · Crumble, Etapa 0 (E0-1 a E0-9)

- **Fecha:** 19 nov 2026
- **Rama / archivos:** se probó `feat/etapa0` en el commit `9c40f62` de `wiqi20/crumble`. El informe y la prueba nueva están en la rama `docs/qa-etapa0`: `docs/entregas/qa-etapa0.md` y `e2e/qa-etapa0/revision.mjs`. No se cambió código de la aplicación.
- **Veredicto** (solo revisores): **APROBADO** para lo construido en E0-1 a E0-8. Queda un defecto medio (QA-E0-01) y ninguno bloqueante ni alto. **La Etapa 0 no se puede dar por terminada todavía:** E0-9 (Railway y respaldo) y la protección de `main` (parte de E0-8) siguen pendientes, y no son trabajo de QA (ver «Pendientes y riesgos»).

## Resumen
Probé la rama integrada de la Etapa 0 en una máquina limpia (`npm ci`), con un Postgres 16 desechable, un servidor real (`next build` y `next start`) y Chromium con Playwright. Hice todas las peticiones con la cabecera `Host` de la tienda y del panel. Lint, tipos, pruebas y build pasan, y el CI de GitHub está en verde para este commit. Las migraciones son repetibles. Las dos identidades se ven con sus fuentes propias, sin peticiones a otros dominios y sin desbordes de 360 a 1920 px. axe no encuentra fallas y el teclado funciona. Confirmé el hallazgo de Frontend sobre el título de los 404 y lo reporto como defecto medio. Intenté llegar al panel desde la tienda con unas 30 variantes de ruta, `Host` y RSC, y ninguna lo consiguió.

## Qué se entrega
- `docs/entregas/qa-etapa0.md`: este informe.
- `e2e/qa-etapa0/revision.mjs`: prueba de Playwright contra el servidor real, por `Host`. No forma parte de `npm test`, porque Playwright no es dependencia del proyecto. Las instrucciones para correrla están en el encabezado del archivo. Revisa la portada y el 404 de la tienda y del panel a 360, 390, 768, 1024, 1280, 1440 y 1920 px, es decir, 28 combinaciones:
  - estado HTTP, desborde, `lang`, `h1` y título;
  - fuente con la que Chromium dibuja de verdad cada texto (CDP `CSS.getPlatformFontsForNode`) y el signo ₡ en texto y en cifras;
  - peticiones externas, recursos con error y errores en consola;
  - íconos y manifiesto, y el favicon dibujado a 16 y 32 px;
  - axe (WCAG 2.0, 2.1 y 2.2 A y AA, más buenas prácticas);
  - recorrido con teclado y foco visible a 390, 1280 y 1440 px;
  - Host desconocido.

  Hoy sale con 1, **solo** por el defecto QA-E0-01 (28 avisos, dos en cada uno de los 14 casos de 404). Es la prueba que atrapa ese defecto.
- Capturas (fuera del repositorio, como pide el diseño UX 12): `/tmp/claude-0/-home-claude/82513ab1-1ca9-5a1a-8c7b-4c1a5cd4d83f/scratchpad/qa-e0-capturas/`. Hay 28 páginas completas, el foco en «Saltar al contenido» y en cada botón, el ₡ a 390 y 1280 px, el favicon de 16 y 32 px en claro y oscuro, y `resultados.json` con el detalle de cada combinación.

## Cómo se comprobó

### Comandos (estándar de QA y 11.4)
| Comando | Resultado |
| --- | --- |
| `npm ci` (worktree limpio) | Sin errores |
| `npm run lint` | Salida 0, sin avisos. También pasa con `e2e/qa-etapa0/revision.mjs` |
| `npm run typecheck` y `npx tsc --noEmit` | Salida 0 |
| `npm test` con `TEST_DATABASE_URL` hacia un Postgres 16 desechable (127.0.0.1, puerto 55831, `/var/lib/postgresql/qa-e0-crumble-b7f3`) | 9 archivos, **121 pasan** y 10 se omiten (las de servidor real). Una segunda corrida da lo mismo |
| `CI=true npm test` sin `TEST_DATABASE_URL` | Falla con «En CI, TEST_DATABASE_URL es obligatoria» (esperado) |
| `npm run build` | El primer intento se detiene con el aviso de Next.js a agentes, que recomienda actualizar. **No ejecuté la actualización.** El segundo intento compila sin errores ni avisos |
| `npm audit --omit=dev --audit-level=high` | Salida 0. Queda 1 moderado conocido en `next` 16.4.3 (GHSA-mfr8-8qww-v76h y GHSA-vc7v-qv4w-wrv8, de `'use cache'`, que no se usa) |
| `npm run migrate` dos veces sobre una base vacía | 1.ª: «Aplicada 001_base.sql». 2.ª: «Nada que migrar». `pg_dump -s` es idéntico entre las dos (solo cambia la marca aleatoria `\restrict` de pg_dump) |
| Dos `migrate` simultáneos sobre otra base vacía | Uno aplica y el otro dice «Nada que migrar». Las dos salen con 0 y queda una sola fila en `migraciones_aplicadas` |
| Migración aplicada y luego editada (cambio temporal, revertido) | Sale con 1: «ya estaba aplicada y su contenido cambió. No la edites: crea una nueva» |
| `URL_SERVIDOR_PRUEBA=http://127.0.0.1:3917 npx vitest run tests/servidor` contra `next start` | **10 de 10** |
| GitHub Actions, ejecución 44500001661 (push de `feat/etapa0`, commit `9c40f62`) | `verificar` y `secretos` en verde |
| Búsqueda de secretos en el árbol (`git grep` de claves de base, tokens de GitHub, Google, Stripe y AWS, y llaves privadas) | Solo valores falsos de las pruebas y la clave del Postgres efímero del CI. `.env.example` solo tiene nombres. gitleaks no está instalado en esta máquina; en el CI pasó |

### Criterios de aceptación de la Etapa 0 (11.4)
| Historia | Criterio | Resultado | Evidencia |
| --- | --- | --- | --- |
| E0-1 Esqueleto | `npm ci`, lint, `tsc` y build sin errores en una máquina limpia | **Pasa** | Tabla anterior. `next` 16.4.3 y `react` 19.3.0 fijos |
| E0-2 Configuración | Sin `DATABASE_URL`, o con `MODO_DEMO=true` sin lo que pide, no arranca, dice en español qué falta y no muestra valores | **Pasa** | `next start` sin variables (con una `DATABASE_URL` que llevaba la clave `CLAVEQA123`) sale con 1 y lista nueve variables; la clave no aparece. Con `MODO_DEMO=true` sin `DEMO_RESET_MINUTOS`, sale con 1 y dice «DEMO_RESET_MINUTOS: falta (obligatoria con MODO_DEMO=true)» |
| E0-3 Migraciones | Migrar dos veces da el mismo esquema; editar una aplicada detiene el ejecutor; dos ejecuciones simultáneas no chocan | **Pasa** | Tabla anterior, además de las pruebas automáticas |
| E0-4 Errores y salud | Con la base caída, `/api/health` responde 503 `{ "estado": "error" }` sin detalles; un error no controlado da 500 en español sin traza | **Pasa** | Servidor real con la base en un puerto cerrado: 503, `no-store` y el cuerpo `{"estado":"error","error":"servicio-no-disponible","mensaje":"…"}`, sin la clave, la dirección ni el texto de Postgres, y la clave tampoco aparece en el registro. Con la base viva: 200 `{"estado":"ok"}`. El 500 lo cubren las pruebas automáticas; todavía no hay una ruta real que lo provoque |
| E0-5 Host y cabeceras | Host desconocido → 404; panel y `/api/admin` en la tienda → 404; cabeceras en una página de la tienda, una del panel y la API | **Pasa** | `tests/servidor` 10 de 10. Sondeo propio en «Pruebas de ataque» |
| E0-6 Pruebas con base | `npm test` en local y en CI; una ruta sin permiso declarado hace fallar la prueba | **Pasa** | 121 pruebas en local, CI en verde y las rutas de ejemplo malas de `tests/permisos/ejemplos/` |
| E0-7 Identidades | Cada lado con su tipografía y sin pedir nada afuera; 404 de verdad; favicon visible a 16 y 32 px; lint y `tsc` limpios | **Pasa**, con el defecto QA-E0-01 | Sección siguiente |
| E0-8 CI | PR roto en rojo y limpio en verde; `main` protegida | **Parcial** (no es defecto de código) | Verde comprobado en GitHub. El caso rojo solo se comprobó en local (entrega de DevOps). La protección de `main` no se pudo leer (la API responde 403 a esta integración) y DevOps dice que no la activó |
| E0-9 Railway | `/api/health` 200 en los dos proyectos de Railway; respaldo restaurado una vez | **No probado** | No existe todavía: espera el visto bueno del dueño |

### Tienda y panel en el navegador (E0-7), por `Host`
Las 28 combinaciones son tienda y panel, portada y 404, a 360, 390, 768, 1024, 1280, 1440 y 1920 px.
- **Estado:** las portadas responden 200 y los 404, 404. El 404 lleva `<meta name="robots" content="noindex">` y el panel además `noindex, nofollow, nocache`.
- **Desborde:** en las 28, `scrollWidth` es igual al ancho de la ventana y ningún elemento visible queda fuera del borde.
- **`lang="es-CR"`:** en las 28, en el 404 propio del proxy (Host desconocido) y en el manifiesto. Un solo `h1` por página.
- **Fuentes propias:** fuente que Chromium usó de verdad para dibujar:
  - tienda: `h1` en Marcellus y texto en Jost (las dos web);
  - panel: `h1` en Onest Light y texto en Onest.

  **Ninguna petición a otro dominio** en las 28 combinaciones: la intercepción corta y cuenta todo lo que no sea de la tienda ni del panel. Tampoco hubo recursos con error, salvo el 404 del propio documento en las páginas 404.
- **Signo ₡** (todavía ninguna página lo muestra, así que lo inserté como hizo Frontend):
  - tienda: «Desde ₡13 500» se dibuja con «Colon League Spartan» y el resto en Jost; la cifra «₡36 000» también;
  - panel: el texto usa «Colon Inter» con Onest, y la cifra (`.cifra`) usa «Colon Noto Sans Mono» con JetBrains Mono.

  No sale ningún cuadro vacío en los 28 casos. Captura: `panel-404-390-colon.png`.
- **Favicon e íconos:** el `<head>` de las dos superficies trae `favicon.ico` (48×48), `icon.svg` (`any`), `apple-touch-icon` de 180×180 y el manifiesto. `/favicon.ico`, `/icon.svg`, `/apple-icon.png`, `/manifest.webmanifest` y `/iconos/icono-192.png` y `-512.png` responden 200 con su tipo, por los dos `Host`. El `.ico` trae 16, 32 y 48 px en PNG y se dibuja a 16 y 32 px, igual que el SVG (`favicon-16-32-light.png` y `-dark.png`).
- **axe:** **0 violaciones** y 0 casos sin resolver en las 28 combinaciones. Pasan entre 31 y 37 reglas, `color-contrast` incluida.
- **Contraste:** axe no marca nada. El texto secundario del 404 del panel está en Iron sobre Bone White (el arreglo de Frontend) y el de la tienda en tinta suave sobre blanco.
- **Teclado** (390, 1280 y 1440 px):
  - El primer Tab muestra «Saltar al contenido», visible (150×45 en la tienda y 148×44 en el panel). Con Enter, el foco pasa a `#contenido`.
  - En la tienda, el segundo Tab sin saltar llega al logo («Crumble cake store, ir a la portada»), de 48 px, con contorno de 2 px en tinta y 3 px de separación.
  - En los 404, el siguiente Tab llega al botón: «Ir a la portada» (48 px, contorno de 2 px) o «Ir al inicio del panel» (44 px, contorno de 2 px). Todos tienen foco visible.
  - Al activar los botones del 404, con clic o con Enter, se llega a la portada de la tienda o al inicio del panel (`https://panel…/` muestra «Panel de la tienda»).

### Pruebas de ataque al enrutado (permisos y aislamiento de esta etapa)
Todavía no hay sesiones ni rutas de `/api/admin`, así que en esta etapa el aislamiento es entre la tienda y el panel. Todas las respuestas de abajo se pidieron al servidor real con `curl --path-as-is`:
- **Desde la tienda nunca se llega al panel.** Todas estas rutas dan el 404 de la tienda:
  - `/panel`, `/_next/../panel`, `/api/../panel`, `/./panel` y `/_next/static/../../panel`;
  - `/%2fpanel`, `/%2Fpanel`, `/panel%2f`, `/%5cpanel` y `/%2570anel`;
  - `/panel.`, `/panel%00`, `/panel;x` y `/panel?x=1`;
  - `/(panel)/panel`, `/_no-encontrado` y `/panel/_no-encontrado`;
  - `/panel` con la cabecera `x-middleware-subrequest` (las variantes `proxy` y `middleware`).

  `/Panel/` da 308 hacia `/Panel`, que es 404.
- **Navegación del lado del cliente** (`window.next.router.push`) desde la tienda hacia `/panel`, `/Panel` y `/%70anel`: el navegador recibe la carga RSC del 404 de la tienda. Ninguna respuesta trae contenido del panel.
- **`/api/admin` en la tienda:** `/api/admin%2fx` y `/api/ADMIN/x` dan 404 JSON. `/api//admin/x` da 308 hacia `/api/admin/x`, que también es 404.
- **En el panel:** `/panel` y `/../../panel` dan el 404 del panel. `/api/admin/x` da 404 JSON, también con `POST` y un `Origin` ajeno.
- **`/api/health`:** `DELETE` y `POST` dan 405.
- **Host:**
  - vacío, desconocido o `tienda.prueba.local:443`: 404 del proxy;
  - en mayúsculas y con punto final: se reconoce como la tienda;
  - `X-Forwarded-Host` del panel en la tienda: se ignora y se sirve la tienda.

## Defectos

### QA-E0-01 · En los 404, el título de la pestaña vuelve al del layout · **Medio** · Abierto
- **Pasos:**
  1. Arrancar `npm run start` con `URL_TIENDA=https://tienda.prueba.local` y `URL_PANEL=https://panel.prueba.local`.
  2. En Chromium, abrir `https://tienda.prueba.local/no-existe-qa` (o la del panel) con la cabecera Host, como hace `e2e/qa-etapa0/revision.mjs`.
  3. Esperar a que cargue y leer `document.title`.
- **Esperado:** «No encontramos esta página · Crumble cake store» en la tienda y «No encontramos esta página · Panel de Crumble» en el panel. Es lo que trae el HTML.
- **Obtenido:**
  - El título queda en «Crumble cake store» en la tienda y en «Panel de la tienda · Crumble» en el panel. En el panel parece el título del inicio.
  - Pasa en los 7 anchos y en los dos lados. También con `/panel` en la tienda, que se reescribe al mismo 404.
  - Con JavaScript apagado, el título es el correcto. Un `MutationObserver` muestra el momento del cambio: a los 43 ms, «No encontramos esta página · Crumble cake store»; a los 167 ms, «Crumble cake store». Es decir, React lo reemplaza al hidratar.
- **Por qué es medio:**
  - Es lo que anuncia el lector de pantalla al cargar, lo que queda en el historial y en la pestaña, y WCAG 2.4.2 (nivel A) pide que el título describa la página.
  - No llega a alto: el `h1` sí dice «No encontramos esta página», y no afecta el SEO porque los 404 llevan `noindex`.
- **Evidencia:** `resultados.json` (campos `tituloHtml` y `tituloDocumento` de `tienda-404-*` y `panel-404-*`) y la salida de `revision.mjs`, que falla solo por esto.
- **Pista para Frontend (no la comprobé):** la ruta `[...resto]/page.tsx` llama a `notFound()` y no exporta `metadata`. Es probable que al hidratar el cliente resuelva el título de la ruta (layout más página sin título) en vez del de `not-found.tsx`. Al corregirlo, `e2e/qa-etapa0/revision.mjs` debe salir con 0.

## Observaciones (no son defectos de esta etapa)
- **Dos `meta robots` en el 404 del panel** (`noindex, nofollow, nocache` del layout y `noindex` de Next.js). No se contradicen. Lo anoto para SEO.
- **Cabeceras internas expuestas:** las respuestas reescritas traen `x-middleware-rewrite: /_no-encontrado` y `x-nextjs-rewritten-path`. Las pone Next.js y solo revelan el nombre de una ruta privada. Lo anoto para Seguridad.
- **Un `Host` con puerto (`tienda.prueba.local:443`) cae en «Host desconocido»** (404). Falla cerrado, lo cual está bien, pero DevOps debe confirmar en E0-9 que Railway entrega el `Host` sin puerto, o la tienda daría 404 en producción. Lo detecta `tests/servidor` corrido contra el servicio desplegado.
- **El favicon en modo oscuro:** emulé el modo oscuro y dibujé `icon.svg` en un `<img>`. Chromium mostró la variante clara (fondo blanco y C oscura), que igual se ve bien sobre fondo oscuro. No pude confirmar si la pestaña real usa la variante invertida.
- El aviso de Next.js a agentes pide ejecutar una actualización de Next.js y preguntarle al usuario. **No la ejecuté ni pregunté**: el encargo lo prohíbe y la versión está fijada a propósito. La subida a 16.4.6 sigue siendo una decisión pendiente del Project Manager.

## Decisiones tomadas
- **La prueba nueva es un script `.mjs` y no un `.spec.ts` de `@playwright/test`.** El proyecto no tiene Playwright como dependencia y un `.ts` en `e2e/` entraría en `tsc`. Así no se suman dependencias, y lint y tipos siguen limpios.
- **El favicon se dibuja desde sus bytes (data URL).** Chromium pide `/favicon.ico` por su cuenta, fuera de la intercepción de Playwright. Esa petición iba a la red y daba un falso negativo. Los bytes son exactamente los que sirve el servidor por `Host`.
- **Sumé 1280 px** a los anchos pedidos, porque `qa.md` exige capturas en 1280 y 390 px.
- **Inserté el ₡ en la página**, porque ninguna lo muestra todavía, y verifiqué qué fuente lo dibuja de verdad con CDP, no por el CSS declarado.
- **Veredicto APROBADO** para lo construido: no aplica ningún flujo crítico de un sistema vendido (demo, compra, pago, suspensión, sesión), no hay defectos bloqueantes ni altos, y los cuatro comandos pasan. Que la etapa esté **terminada** lo decide el Project Manager con lo pendiente de E0-8 y E0-9.

## Pendientes y riesgos
- **E0-9 sin hacer:** no hay servicios en Railway, `/api/health` desplegado ni respaldo restaurado. Hasta entonces no se cumple «Terminado de la etapa 0». Cuando existan, conviene correr `tests/servidor` y `e2e/qa-etapa0/revision.mjs` contra el servicio desplegado (por el `Host` con puerto y por el aviso de Backend sobre `next start -H`).
- **E0-8:** falta activar la protección de `main` (decisión del dueño, según DevOps) y ver en GitHub un PR en rojo.
- **QA-E0-01 abierto:** cuando Frontend lo corrija, repito la revisión completa de la tienda y el panel, no solo el título.
- **No probé:**
  - Firefox, Safari ni un lector de pantalla real;
  - la pestaña real del navegador en modo oscuro;
  - un error 500 no controlado en una ruta real (todavía no existe ninguna; lo cubren las pruebas automáticas);
  - gitleaks en local (no está instalado; pasó en el CI);
  - los permisos por rol (no hay sesiones ni rutas de `/api/admin` hasta B2 y B3).

## Preguntas para el Project Manager
- ¿Se cierra la Etapa 0 con E0-9 pendiente, o se espera a Railway y al respaldo? Con lo de arriba, QA no tiene nada que bloquee.
- ¿Se suma al CI un paso con `next start` más `tests/servidor` y esta revisión? Hoy se corren a mano. Pedirlo es de DevOps.

## Dependencias nuevas
- Ninguna. La prueba usa el Playwright y el Chromium de la máquina de QA, y el `axe-core` que ya trae el árbol de desarrollo (dependencia transitiva de `eslint-config-next`).
