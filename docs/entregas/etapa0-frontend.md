# Entrega: Frontend · Crumble, Etapa 0: identidades, fuentes y favicon (E0-7)

- **Fecha:** 17 nov 2026
- **Rama / archivos:** `feat/etapa0-frontend` en `wiqi20/crumble`, que parte de `feat/etapa0-esqueleto`. Sin PR ni unión.
- **Veredicto** (solo revisores): pendiente (QA, Seguridad y SEO)

## Resumen
La tienda y el panel tienen ya cada uno su layout raíz, sus tokens y sus fuentes servidas desde el propio sitio: la tienda usa la identidad de Crumble (blanco, tinta, rosa pálido, Marcellus y Jost) y el panel usa el sistema de STI sin cambios, más `--surface-error`. Las dos identidades no se mezclan, ni en los tokens ni en el CSS que se envía. Están el favicon con la "C" del logo (versión engrosada para tamaños chicos, también en modo oscuro), el apple-touch-icon y el manifiesto. Hay una portada provisional de la tienda con el logo de letras, una página provisional del panel y un 404 real en cada lado. Ninguna de las cuatro fuentes trae el signo ₡, así que cada identidad tiene un respaldo propio de un solo carácter.

## Qué se entrega
- `styles/tienda.css`: tokens de la tienda (diseño UX 2.1 a 2.3 y 3). Colores `--color-blanco`, `tinta`, `tinta-suave`, `rosa`, `rosa-claro`, `linea`, `linea-fuerte`, `error`, `error-fondo` y `exito`; fuentes `--font-titulo` (Marcellus) y `--font-texto` (Jost); escala `portada`, `h1` y `h2` fluida de 360 a 1440 px; `h3`, `grande`, `texto` (16, 17 desde 1440 y 18 desde 1920), `chico` y `micro`; radios `campo` 6, `tarjeta` 14 y `pildora` 999; cortes 768, 1024, 1440 y 1920; foco de 2 px en tinta separado 3 px. También van con los nombres del diseño (`--c-*`, `--t-*`, `--r-*`) para quien escriba CSS a mano. Agrega las utilidades `contenedor` (margen 16, 32, 40 y 48 px; ancho máximo 1200, 1280 y 1440 px), `rotulo` y `cifras`.
- `styles/panel.css`: el `@theme` de `app/globals.css` de sticr.app tal cual (colores, Onest, JetBrains Mono, radios de 5, 8 y 14 px, sombras), la escala de `DESIGN.md`, las superficies (`--surface-canvas`, `paper`, `frost`, `tinted-wash` y `lilac-mist`) y la nueva **`--surface-error: #f8eaea`**, también como colores de Tailwind (`bg-surface-error`). Agrega la utilidad `cifra` (monoespaciada, cifras tabulares).
- En las dos hojas, la paleta, las fuentes y los cortes por defecto de Tailwind se vacían (`--color-*: initial`, etc.), y cada hoja solo mira sus carpetas (`@source` sobre `app/(tienda)` o `app/(panel)`, más `components/<lado>` y `components/comunes`). Así no se cuela una clase ni un color de la otra identidad.
- `styles/fuentes/`: los tres respaldos del ₡ (`colon-league-spartan.woff2`, `colon-inter.woff2` y `colon-noto-sans-mono.woff2`, de 1,2 a 1,5 KB cada uno), sus licencias OFL, `subconjunto.py`, que los regenera, y `LEEME.md`, con la comprobación y el porqué.
- `app/(tienda)/layout.tsx`: el layout raíz de la tienda, con `<html lang="es">`, Marcellus 400 y Jost variable, título con plantilla "… · Crumble cake store", `theme-color` blanco y el enlace "Saltar al contenido".
- `app/(tienda)/page.tsx`: la portada provisional con el estado "vacío" de T1 ("Estamos preparando la tienda"), el logo de letras en la cabecera (40 px, 48 desde 1024) y en el pie (64 px).
- `app/(tienda)/not-found.tsx` y `app/(tienda)/[...resto]/page.tsx`: el 404 de la tienda, con su identidad y estado 404.
- `app/(panel)/layout.tsx`: el layout raíz del panel, con `<html lang="es">`, Onest 300 a 600 y JetBrains Mono 500 y 600, `robots: noindex, nofollow, nocache`, `theme-color` Bone White y "Saltar al contenido".
- `app/(panel)/panel/page.tsx`: la página provisional del panel en `/panel` (barra de 56 px con "Crumble · Panel de la tienda" en texto, sin logo, como pide el diseño UX 8).
- `app/(panel)/panel/not-found.tsx` y `app/(panel)/panel/[...resto]/page.tsx`: el 404 del panel, con el sistema de STI y estado 404.
- `components/tienda/LogoCrumble.tsx`: el logotipo de letras como SVG en línea, con los contornos exactos de `logo/letras/crumble-logotipo.svg` y el relleno en `currentColor`. Nombre accesible "Crumble cake store", o decorativo si va dentro de un enlace con nombre propio.
- `components/tienda/Marco.tsx` (`CabeceraTienda` y `PieTienda`) y `components/panel/Marco.tsx` (`BarraPanel`): los marcos mínimos.
- Favicon (diseño técnico 11.3):
  - `app/favicon.ico`: 16, 32 y 48 px, armado con `favicon-16/32/48.png`, que ya son la versión engrosada. El `.ico` de `logo/favicon/` traía solo 16 px.
  - `app/icon.svg`: la versión engrosada (`crumble-favicon-pequeno.svg`) con los colores de la invertida dentro de `@media (prefers-color-scheme: dark)`. El trazo es idéntico en las dos (comprobado).
  - `app/apple-icon.png`: `favicon-180.png` con las esquinas transparentes rellenas de blanco, porque iOS pinta de negro la transparencia y redondea él mismo.
  - `app/manifest.ts`, con `public/iconos/icono-192.png` y `icono-512.png`.
- Se borran `app/layout.tsx`, `app/page.tsx` y `app/globals.css`, que reemplazan los dos layouts, y los `.gitkeep` de las carpetas que ya tienen archivos.
- `tests/unit/identidades.test.ts`: comprueba los tokens de cada lado, que no se mezclan, el respaldo del ₡ en cada lado, que no se piden fuentes externas y el manifiesto.

## Cómo se comprobó
- `npm run lint` → sin errores ni avisos.
- `npm run typecheck` → sin errores.
- `npm test` → 2 archivos y 6 pruebas, todas pasan.
- `npm run build` → el primer intento se detiene con el aviso de Next.js a agentes (el mismo de la entrega de DevOps). No ejecuté la actualización que propone. El segundo intento compila sin errores ni avisos: `○ /`, `○ /panel`, `ƒ /[...resto]`, `ƒ /panel/[...resto]`, `○ /icon.svg`, `○ /apple-icon.png`, `○ /manifest.webmanifest` y `ƒ /api/health`.
- **GitHub Actions, ejecución 44208527648** sobre `feat/etapa0-frontend` (commit 44452f9) → **verde**: `verificar` en 1 min 47 s y `secretos` en 5 s.
- `npm audit --omit=dev --audit-level=high` → sale con 0. Sigue el mismo hallazgo moderado de `next` 16.4.3 que ya estaba; las fuentes no suman ninguno.
- `next start` y `curl`:
  - `/` y `/panel` → 200.
  - `/no-existe` y `/panel/no-existe` → 404, cada uno con su identidad y `<meta name="robots" content="noindex">`.
  - `/favicon.ico`, `/icon.svg`, `/apple-icon.png` y `/manifest.webmanifest` → 200, con su tipo correcto.
  - `/api/health` → 200.
  - El `<head>` de las dos páginas lleva `favicon.ico`, `icon.svg` (`sizes="any"`), `apple-touch-icon` de 180×180 y el manifiesto. El panel lleva además `noindex, nofollow, nocache`.
- El CSS que se envía está separado: la portada carga una sola hoja (12,5 KB, con la tinta, Jost y "Colon League Spartan", sin nada de STI) y el panel otra (31,8 KB, con Coastal Teal y Onest, sin nada de Crumble).
- Revisión con Playwright (Chromium) de `/`, `/panel` y los dos 404 a 360, 390, 768, 1024, 1440 y 1920 px:
  - Sin desplazamiento horizontal y ningún elemento fuera del borde, en las 24 combinaciones.
  - `lang="es"` y un solo `h1` por página.
  - **Cero peticiones a otros dominios**: todas las fuentes salen de `/_next/static/media/`.
  - El título de la tienda va en Marcellus (36 px a 360 y 72 px desde 1440) y el texto en Jost (16, 17 y 18 px). El panel va en Onest con títulos en peso 300.
- Signo ₡ con las fuentes reales, insertado en las dos páginas: en la tienda se dibuja con "Colon League Spartan" en peso normal y negrita; en el panel, con "Colon Inter" en el texto y "Colon Noto Sans Mono" en las cifras. Los tres archivos se descargan solo cuando la página muestra un ₡. Captura en `colon-tienda.png` y `colon-panel.png`.
- Teclado: el primer Tab muestra "Saltar al contenido" con foco visible; con Enter el foco pasa a `#contenido`. En la tienda, el siguiente Tab va al logo ("Crumble cake store, ir a la portada") y después al botón del 404.
- Favicon dibujado a 16 y 32 px, el `.ico` y el SVG en claro y en oscuro: la "C" se lee en los dos tamaños (`favicon-16-32.png`).
- Contraste: el texto secundario del 404 del panel estaba en Slate sobre Bone White (4,4:1, por debajo de 4,5) y pasó a Iron (#404040, unas 8:1). En la tienda, la tinta suave da 7:1 sobre blanco.
- Capturas revisadas una por una (no van en el repositorio, como pide el diseño UX 12): `/tmp/claude-0/-home-claude/82513ab1-1ca9-5a1a-8c7b-4c1a5cd4d83f/scratchpad/crumble-fe-e0-capturas/`. Son `tienda-390.png`, `tienda-1440.png`, `panel-390.png`, `panel-1440.png`, los dos 404 en 390 y 1440, las tres de teclado, las dos del ₡ y la del favicon.
- **No se comprobó:** axe (no está instalado; lo corre QA con Playwright), lector de pantalla real, Safari ni Firefox, y el favicon en una pestaña real en modo oscuro (se comprobó dibujando el SVG con y sin la regla oscura).

## Decisiones tomadas
- **Dos layouts raíz (`app/(tienda)/layout.tsx` y `app/(panel)/layout.tsx`) y ningún `app/layout.tsx`.** Es la forma que da la guía de Next.js 16 (`route-groups.md`) de tener dos `<html>` con estilos distintos. Entre tienda y panel se recarga la página entera, cosa que no importa porque están en dominios distintos.
- **El 404 de cada lado sale de una ruta comodín (`[...resto]`) que llama a `notFound()`.** Con dos layouts raíz no hay un 404 global que armar, y la otra salida, `global-not-found`, es experimental y pide tocar `next.config.ts`, que es de Backend. Las rutas más específicas siempre ganan (`/api/health`, `/panel`, los íconos). Efecto que Backend debe conocer: hoy una ruta de la API que no existe (`/api/nada`) devuelve el 404 **en HTML** de la tienda. Si la API quiere 404 en JSON, basta con un `app/api/[...resto]/route.ts`.
- **Las fuentes con `@fontsource`**, que es lo que pide el diseño técnico 11.1, en las mismas versiones que el sitio para Onest (5.3.1) y JetBrains Mono (5.3.0), y fijadas exactas. Se cargan desde el layout como en sticr.app, para que las direcciones de los archivos las resuelva Next.js.
- **El respaldo del ₡ es de un solo carácter, de fuentes OFL elegidas por parecido.** Las comparé dibujando el ₡ junto a cada fuente. Para Jost, League Spartan, que es geométrica y tiene la misma "C" redonda; Lexend quedaba muy gruesa. Para Onest, Inter. Para JetBrains Mono, Noto Sans Mono; IBM Plex Mono y Source Code Pro se veían más anchas o más finas. Son variables, así que siguen el peso del texto, y llevan `unicode-range: U+20A1`. Pesan unos 1,3 KB y no suman ninguna dependencia, porque los paquetes de origen se usaron una sola vez fuera del proyecto.
- **Favicon oscuro dentro del mismo `icon.svg`.** Si se declaraba la variante oscura en `metadata.icons`, Next.js dejaba de poner `icon.svg` y `apple-icon.png` en el `<head>` (comprobado). La regla `prefers-color-scheme` dentro del SVG da el mismo resultado sin perder los íconos por archivo.
- **El logo va como SVG en línea con `currentColor`**, como pide el diseño UX 2.4, y no como `<img>`, que no hereda el color. Son unos 26 KB de trazo que se comprimen bien y no piden nada más al servidor.
- **`lang="es"`**, como pidió el encargo. El diseño UX 11 dice `lang="es-CR"`: lo dejo como pregunta.
- **La portada provisional usa el texto del estado "vacío" de T1, sin el botón de WhatsApp,** porque el número real de Crumble está pendiente. No inventa precios ni secciones.
- **El enlace del 404 del panel apunta a `/panel`.** Si el enrutado por Host de Backend (E0-5) termina sirviendo el panel en la raíz de `crumble-admin`, hay que cambiarlo a `/`.

## Pendientes y riesgos
- **El separador de miles:** el diseño UX pide espacio fino de no separación (U+202F) y ninguna fuente lo trae. `Intl.NumberFormat("es-CR")` usa U+00A0, que Jost y Onest sí tienen. Si `lib/dinero.ts` (B1) usa U+202F, el navegador lo toma de una fuente del sistema: no se ve un cuadro vacío, pero el ancho puede variar. Recomiendo U+00A0.
- **El ₡ en títulos con Marcellus** se dibuja con la sans de respaldo, porque no hay una serif con ₡ parecida en el proyecto. Se nota poco ("Desde ₡13 500" en la captura); el diseño pone los precios en Jost.
- **El favicon y el manifiesto de la demo** (Pastelería Demo, sin la "C", elegido con `MODO_DEMO`) esperan el ajuste 31 del Diseñador. Hoy la demo mostraría la "C" de Crumble y el nombre "Crumble cake store" en el manifiesto.
- **Menú de la tienda, barra lateral del panel, cuatro estados de cada pantalla y capturas en `docs/proyectos/crumble/capturas/`:** llegan con F2 a F6. Esta etapa solo deja la base.
- **El aviso de Next.js a agentes** sigue deteniendo el primer `next build` dentro de una sesión de agente. No ejecuté la actualización: la versión está fijada a propósito y el cambio a 16.4.6 es una decisión pendiente del Project Manager (entrega de DevOps).
- **No toqué** `proxy.ts`, `next.config.ts`, `server/` ni `scripts/`, que son de Backend.

## Preguntas para el Project Manager
- ¿`lang="es"`, como dice el encargo, o `lang="es-CR"`, como pide el diseño UX 11? Es un cambio de una línea en cada layout.
- ¿Las respuestas 404 de la API deben ser JSON? Si es así, Backend agrega `app/api/[...resto]/route.ts` (E0-4).
- ¿El panel vive en `/panel` también en el dominio `crumble-admin`, o el proxy lo sirve en la raíz? De eso depende el enlace del 404 del panel.
- ¿Se confirma usar U+00A0 como separador de miles en `lib/dinero.ts`, en lugar del espacio fino?

## Dependencias nuevas
- `@fontsource/marcellus` 5.3.0: títulos de la tienda (diseño UX 2.2, licencia OFL). Pedida en el diseño técnico 11.1.
- `@fontsource-variable/jost` 5.3.0: texto de la tienda, un solo archivo variable para todos los pesos (OFL). Pedida en 11.1.
- `@fontsource/onest` 5.3.1: texto del panel (sistema de STI, OFL), la misma versión que sticr.app. Pedida en 11.1.
- `@fontsource/jetbrains-mono` 5.3.0: cifras y montos del panel (OFL), la misma versión que sticr.app. Pedida en 11.1.
- Ninguna otra. Los respaldos del ₡ son archivos del repositorio, no paquetes.

## Ajustes tras la integración en `feat/etapa0` (19 nov 2026)
- `lang="es-CR"` en los dos layouts y en el manifiesto (decisión del PM; responde la primera pregunta).
- El panel se sirve en la raíz de su dirección (`proxy.ts` de Backend): el enlace del 404 del panel va a `/`. No había otros enlaces internos con `/panel`.
- El comodín `[...resto]` convive con `app/api/[...resto]/route.ts` de Backend: `/api/nada` y `/api/admin/no-existe` dan 404 JSON `no-encontrado` en la tienda, en el panel y con un Host desconocido. Las páginas inexistentes dan el 404 de su lado, y un Host desconocido da el 404 propio del proxy.
- Comprobado en la rama integrada:
  - `npm ci`, lint y tipos sin errores.
  - `npm test` con un Postgres 16 desechable: 121 pruebas pasan y 10 se omiten (las del servidor real).
  - `npm run build` compila al segundo intento, por el aviso de Next.js a agentes. No se ejecutó ninguna actualización.
  - `tests/servidor` contra `npm run start`: 10 de 10.
  - Playwright por cabecera Host (tienda y panel, a 390 y 1440 px): sin desbordes, `lang="es-CR"`, fuentes propias y cero peticiones externas.
- Hallazgo menor para QA y SEO: en los 404, el HTML trae el título correcto ("No encontramos esta página · …"), pero en el navegador `document.title` queda con el título por defecto del layout después de cargar.

## Corrección de QA-E0-01 (19 nov 2026)
- **Defecto:** en los 404, el HTML traía el título correcto, pero al hidratar, React lo cambiaba por el del layout.
- **Causa:** las rutas comodín `[...resto]` no declaraban título. Al hidratar, el cliente usaba el de la ruta (el del layout) y no el de `not-found.tsx`.
- **Arreglo:** `app/(tienda)/[...resto]/page.tsx` y `app/(panel)/panel/[...resto]/page.tsx` exportan `metadata` con el mismo título que el `not-found` de su lado. Ahora `document.title` queda en «No encontramos esta página · Crumble cake store» en la tienda y en «No encontramos esta página · Panel de Crumble» en el panel.
- Se trae a esta rama la prueba de QA `e2e/qa-etapa0/revision.mjs` (de `docs/qa-etapa0`).
- **Comprobado:**
  - lint y tipos sin errores.
  - `npm test` con un Postgres 16 desechable: 121 pasan y 10 se omiten.
  - `npm run build` compila al segundo intento, por el aviso de Next.js a agentes; no se actualizó Next.js.
  - `tests/servidor`: 10 de 10.
  - `node e2e/qa-etapa0/revision.mjs` contra `npm run start`: 28 páginas y `"fallas": []`, sale con 0.
