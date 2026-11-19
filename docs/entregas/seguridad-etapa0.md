# Entrega: Seguridad · Crumble, revisión de la Etapa 0 (E0-1 a E0-8)

- **Fecha:** 19 nov 2026
- **Rama / archivos:** revisado `feat/etapa0` en el commit `9c40f62` de `wiqi20/crumble`. Este informe va en la rama `docs/seguridad-etapa0`, creada desde ese commit: `docs/entregas/seguridad-etapa0.md`.
- **Veredicto:** **APROBADO, con condiciones.** No queda ningún hallazgo crítico ni alto. Hay dos condiciones que deben cumplirse **antes de E0-9** (el primer despliegue en Railway) y **antes de unir la primera ruta real de `/api/admin`**: M1 (repositorio público) y M2 (`main` sin protección). Si alguna de las dos sigue abierta en ese momento, este veredicto pasa a RECHAZADO para E0-9.

## Resumen
Revisé la Etapa 0 contra `docs/estandares/seguridad.md` y las secciones 5 y 11 del diseño técnico. Además de leer el código, la probé contra un servidor real (`next build` + `next start`) y un Postgres 16 desechable. Lo que la Etapa 0 tiene que proteger está bien hecho y resistió los ataques:
- la configuración nunca imprime valores;
- las migraciones son atómicas, usan candado y detectan que se editó una migración ya aplicada (huella);
- los errores salen sin trazas;
- `/api/health` no filtra datos;
- el panel no se sirve en la tienda con ninguna de las 40 variantes de ruta y cabecera que probé;
- no hay SSRF por `X-Forwarded-Host`;
- las cabeceras están en toda respuesta;
- la puerta falla cerrada;
- no hay peticiones externas, ni secretos en el historial, ni dependencias de producción con hallazgos altos.

Los hallazgos son de configuración del repositorio (M1, M2) y de defensa en profundidad (M3 a M6, más los bajos).

## Qué se entrega
- `docs/entregas/seguridad-etapa0.md` (este informe): qué revisé, hallazgos con gravedad, cómo reproducirlos y cómo corregirlos, lo que no revisé y el veredicto.
- No toqué el código del proyecto. Los archivos temporales de prueba quedaron fuera del repositorio y se borraron.

## Hallazgos

### Críticos
Ninguno.

### Altos
Ninguno.

### Medios

**M1. El repositorio `wiqi20/crumble` es público; el diseño técnico (5.1) dice privado.** *(Condición del veredicto; decide el dueño.)*
- Dónde: configuración de GitHub del repositorio.
- Cómo reproducir: `gh api repos/wiqi20/crumble --jq .visibility` → `"public"`. Además, `https://github.com/wiqi20/crumble` responde 200 sin iniciar sesión. `allow_forking: true` y 0 bifurcaciones a hoy.
- Riesgo: hoy no hay secretos (gitleaks y búsqueda manual, abajo), pero cualquier secreto que se suba por error queda público en el acto: los robots barren GitHub en minutos. Una bifurcación no se puede retirar después. También quedan públicos el código que STI piensa vender a otras pastelerías y los documentos de entrega, con rutas internas de trabajo. La seguridad de Crumble no depende de que el código sea secreto, pero esto contradice una decisión escrita y multiplica el daño de cualquier otro error.
- Cómo corregir: el dueño lo vuelve privado (Settings → General → Danger Zone → Change visibility) **antes de cargar cualquier variable real (E0-9)**. Si lo hizo público a propósito (por ejemplo, porque en el plan gratuito de GitHub la protección de ramas de un repositorio privado no se aplica), que quede escrito como decisión del dueño en 5.1, y en ese caso M2 se vuelve imprescindible.

**M2. `main` no tiene protección: las verificaciones del CI no obligan a nada.** *(Condición del veredicto.)*
- Dónde: GitHub, rama `main` (parte de E0-8, que DevOps dejó pendiente).
- Cómo reproducir: `gh api repos/wiqi20/crumble/branches/main --jq .protected` → `false`; `gh api repos/wiqi20/crumble/rulesets` → `[]`.
- Riesgo: el registro de rutas (5.4: "lo que no declara permiso no se sirve"), gitleaks y `npm audit` solo existen como pasos del CI. Sin protección, un empuje directo a `main` puede llevar una ruta del panel sin puerta o un secreto, y E0-9 despliega desde `main`.
- Cómo corregir: el dueño (o DevOps con su visto bueno) activa una regla en `main`: solo por PR, verificaciones obligatorias `verificar` y `secretos`, al menos una aprobación, sin empujes forzados ni borrado, y que también aplique a los administradores. Antes de E0-9.

**M3. El revisor del registro de rutas tiene puntos ciegos: una ruta del panel puede quedar sin puerta y sin que la prueba lo note.**
- Dónde: `tests/ayudas/registro-rutas.ts` (`esDeAdmin`, `urlDeArchivo`).
- Cómo reproducir: armé fuera del repositorio una carpeta `app` con dos rutas sin `rutaAdmin` que devuelven datos: `app/(panel)/panel/exportar/route.ts` y `app/api/[seccion]/[...r]/route.ts`. `revisarRutasAdmin` devuelve `{"metodos":[],"problemas":[]}`, es decir, ningún problema. En el servidor real, la primera la serviría el panel en `crumble-admin…/exportar` (el proxy reescribe a `/panel/exportar`). La segunda atendería `/api/admin/<cualquier cosa>` en el panel, porque el proxy deja pasar toda `/api` en esa dirección. Tampoco se revisan las Server Actions (`"use server"`), que son puntos de entrada POST fuera de `/api/admin`.
- Riesgo: hoy no hay ninguna ruta así (no hay `"use server"` ni `route.ts` fuera de `api/health` y `api/[...resto]`). El riesgo llega con las descargas del panel (plantilla de importación, errores, PDF de factura, 5.4), que es natural poner como `route.ts` junto a sus páginas.
- Cómo corregir (Backend):
  1. Que el revisor cubra **todo** `route.ts` alcanzable desde la dirección del panel: lo que esté bajo `app/(panel)/`, más cualquier ruta de `app/api` cuyo patrón, con segmentos dinámicos (`[x]`, `[...x]`, `[[...x]]`), pueda coincidir con `/api/admin/...`. Exceptuar solo `api/[...resto]`, que se comprueba aparte.
  2. Una prueba que falle si aparece `"use server"` en `app/`, `components/` o `server/` (CLAUDE.md: toda escritura pasa por la API).
  3. Un caso de ejemplo de cada tipo en `tests/permisos/ejemplos/`.

**M4. El panel se sirve con caché compartida de un año (`Cache-Control: s-maxage=31536000`). El diseño (5.2) pide el panel sin caché.**
- Dónde: `app/(panel)/panel/page.tsx`, que el build prerenderiza como estática (`○ /panel`).
- Cómo reproducir: `curl -sD- -o/dev/null -H 'Host: crumble-admin.sticr.app' http://127.0.0.1:<puerto>/` → `Cache-Control: s-maxage=31536000`, `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`.
- Riesgo: hoy la página solo dice "En construcción" y no tiene datos. Pero si se pone un CDN o un proxy con caché delante (Railway no lo trae, Cloudflare sí), el armazón del panel queda guardado hasta un año y no se puede invalidar desde la aplicación. Además, el panel no debe depender de que "cada página que lea la cookie se vuelva dinámica sola".
- Cómo corregir (Backend o Frontend): forzar el panel como dinámico y sin caché en el layout de `(panel)` (`export const dynamic = "force-dynamic"`, según la guía instalada), o poner `Cache-Control: no-store` desde `proxy.ts` en toda respuesta cuya superficie sea `panel`. Agregarlo a `tests/servidor`.

**M5. La CSP permite `'unsafe-inline'` en `script-src`, también en el panel.**
- Dónde: `server/http/cabeceras.ts` (`politicaDeContenido`).
- Riesgo: si algún día se cuela un HTML inyectado, la CSP no lo frena. React escapa el texto y hoy no hay `dangerouslySetInnerHTML`, así que no hay un XSS que explotar. Es el mismo compromiso aceptado en sticr.app. En la tienda está justificado por la caché (5.2). En el panel no: va sin caché y es donde están la sesión, los permisos y los datos personales.
- Cómo corregir (Backend, antes de la etapa 8, las pantallas del panel): en la superficie `panel`, una CSP con nonce por petición desde `proxy.ts` (guía de CSP con nonces de Next.js 16), sin `'unsafe-inline'` en `script-src` y con `'strict-dynamic'`. La tienda puede quedar como está.

**M6. `next` 16.4.3 tiene un aviso moderado conocido (GHSA-mfr8-8qww-v76h y GHSA-vc7v-qv4w-wrv8: fuga de caché entre valores de *root params* con `'use cache'` y `unstable_cache`). Se corrige en 16.4.6.**
- Dónde: `package.json` / `package-lock.json`.
- Cómo reproducir: `npm audit --omit=dev` → `next 16.2.0 - 16.4.4, Severity: moderate`, 1 moderado; con `--audit-level=high` sale con 0. Además, `next build` se detiene la primera vez con `SecurityFatalError` y una recomendación de actualizar; la segunda vez compila. **No ejecuté la actualización que propone**, como pedía el encargo.
- Riesgo hoy: nulo, porque no se usan `'use cache'` ni `unstable_cache` (lo busqué en `app`, `server`, `lib` y `components`). Pero 5.2 y 11.1 planean servir la tienda desde caché e invalidar por etiqueta, que es justo el terreno del aviso.
- Cómo corregir: que el Project Manager decida subir a 16.4.6 (o la versión que corrija) en Crumble y sticr.app a la vez, **antes de la primera historia que use `'use cache'` o la caché por etiqueta**. Si no, ese PR queda bloqueado por Seguridad.

### Bajos
- **B1. Una URL con codificación inválida da 500 en inglés y llena el registro.** `GET /%`, `/%E0%A4%A` en la tienda y `/panel/%ZZ` en las dos direcciones → `500 Internal Server Error` (texto plano, en inglés, sin traza y con las cabeceras de seguridad). El servidor escribe `Error: failed to decode param … at ignore-listed frames` en cada petición. No filtra nada. Pero no es el 404 en español que pide E0-4, y cualquiera puede inflar el registro a voluntad. Corrección: cuando `normalizarRuta` devuelve `null`, que el proxy responda su propio 404 (`noEncontrado`) también en una dirección conocida, en vez de reescribir al comodín. Y una prueba.
- **B2. Las respuestas exponen `x-middleware-rewrite`** (`/panel`, `/panel/pedidos`, `/_no-encontrado`), lo que revela la estructura interna. Es lo normal en Next.js y no da acceso a nada. Si se quiere, se quita en el proxy o en la plataforma. Informativo.
- **B3. Migraciones:**
  1. Si una migración trae su propio `BEGIN`/`COMMIT`, rompe la transacción del ejecutor.
  2. Una versión menor que otra ya aplicada (por ejemplo, de una rama atrasada) se aplica sin aviso.
  3. `pg_advisory_lock` espera sin tiempo máximo, así que un despliegue puede quedar colgado.

  Corrección: rechazar archivos con `BEGIN`, `COMMIT` o `ROLLBACK` sueltos, rechazar versiones fuera de orden y poner `lock_timeout` o un tiempo máximo a la espera del candado.
- **B4. Secretos: solo se comprueba el largo.** `SESSION_SECRET`, `IP_HASH_SALT` y `SOPORTE_SECRETO` pasan con 32 caracteres cualesquiera (por ejemplo, 32 letras "a"), y nada impide usar el mismo valor en las tres. Corrección: rechazar valores repetidos entre sí y de poca variedad (por ejemplo, menos de 16 caracteres distintos).
- **B5. La guarda de la base de pruebas acepta `postgresql:///x_test`** (sin host). En ese caso `pg` toma `PGHOST` del entorno, que podría apuntar a otra máquina. Corrección: exigir el host explícito o rechazar cuando `PGHOST` esté definido.
- **B6. CI:** la imagen `postgres:16` y `ubuntu-latest` no están fijadas por resumen. `tests/servidor`, que prueba el enrutado y las cabeceras contra un servidor real, no corre en el CI (Backend ya lo propuso). Corrección: fijar la imagen por `@sha256:` y sumar el paso de `next start` + `tests/servidor`.
- **B7. `/api/health` responde con cualquier Host y sin límite de intentos.** Es una decisión documentada (Railway llama con su propio Host), el cuerpo es solo `{"estado":"ok"|"error"}` y la vigencia de 3 s con una sola consulta a la vez evita agotar el grupo de conexiones. Lo anoto como riesgo aceptado.

## Cómo se comprobó
Todo en local: worktree propio desde `9c40f62`, Postgres 16 desechable en `/var/lib/postgresql/<nombre único>` con puerto único, y servidores de prueba en puertos propios, con variables ficticias. No hice ninguna prueba ofensiva contra Railway, GitHub ni sistemas de terceros; a GitHub solo le hice consultas de lectura (visibilidad, protección y estado del CI).

**Comprobaciones generales**
- `npm ci`, `npm run lint`, `npm run typecheck` → sin errores.
- `npm test` con `TEST_DATABASE_URL` → **121 pasan**, 10 omitidas (las del servidor real).
- `tests/servidor` contra `next start` con los hosts que espera → **10 de 10**.
- `npm run build` → el primer intento se detiene con el aviso de Next.js (M6) y el segundo compila.
- CI de GitHub para `9c40f62`: ejecución 44500001661 → `success`.

**Variables (E0-2)**
- Sin variables, `next start` sale con 1 y lista las 10 que faltan.
- Con valores inválidos marcados (`VALORSECRETO1` a `VALORSECRETO11`, incluida una `DATABASE_URL` con clave), sale con 1 y lista 11 problemas. `grep -c VALORSECRETO` sobre la salida → **0**.
- Con la configuración inválida, el proxy responde 503 en lugar de servir (`proxy.ts`).
- Ningún nombre de variable del servidor aparece en `.next/static`.

**Migraciones (E0-3)**
- Base vacía → aplica `001`. Segunda vez → "Nada que migrar".
- Edité `001_base.sql` → se detiene con "ya estaba aplicada y su contenido cambió", salida 1 (cambio revertido).
- Dos ejecuciones simultáneas en una base nueva → una aplica y la otra no encuentra nada; una sola fila en `migraciones_aplicadas`.
- Destino remoto sin `--si` → cancela. Con un host caído → muestra solo el código `ECONNREFUSED`, nunca la clave.
- Leí la migración `001_base.sql`: el `CHECK` de `permisos_rol` limita a los 19 permisos delegables (los no delegables no se pueden guardar) y `sesiones` guarda solo el resumen del token, con tope de 7 días en la base.

**Errores y salud (E0-4)**
- Con Postgres detenido, `/api/health` → 503 `{"estado":"error","error":"servicio-no-disponible","mensaje":…}`, sin detalles. Con la base levantada → 200 `{"estado":"ok"}`.
- Leí `respuestaDesdeError` y `registrar`: el error no controlado no lleva mensaje ni traza, y el registro omite correos, teléfonos, tokens y campos con nombre de secreto (además, la prueba del 500 en `tests/unit/errores.test.ts` pasa).
- `/api/<inexistente>` con cualquier método → 404 JSON.

**Enrutado por Host (E0-5).** Con la tienda en `crumble.sticr.app`, probé que `/panel` no se pueda alcanzar:
- Variantes de ruta: `/PANEL`, `/%70anel`, `/%2570anel`, `//panel`, `/./panel`, `/x/../panel`, `/%2e%2e/panel`, `/panel%2f`, `/panel;x`, `/panel%00`, `/\panel`, `/%5Cpanel`, `/_next/../panel` y `/_next/static/../../panel`.
- Otros caminos: `/panel/_no-encontrado`, `/(panel)/panel`, `/panel/[...resto]` y `RSC: 1`.
- Cabeceras internas de Next o de proxies: `x-middleware-rewrite`, `x-matched-path`, `x-invoke-path`, `x-middleware-subrequest` (variantes `proxy`, `middleware` y `src/proxy`), `next-url`, `x-original-url`, `x-rewrite-url` y `x-forwarded-uri`.
- Una Server Action falsa (`Next-Action`).

Resultado: siempre 404 o 400 con la identidad de la tienda ("Crumble cake store"), nunca el texto del panel. `/api/admin…` en la tienda, también en mayúsculas o codificado → 404 JSON.

Hosts:
- Un Host desconocido, con puerto, con doble punto final, con prefijo o sufijo, codificado o vacío → 404 propio del proxy (o 400).
- En mayúsculas o con un punto final → se normaliza correctamente.
- `X-Forwarded-Host` y `Forwarded` no cambian la superficie: el enrutado solo usa `Host`.

SSRF: con `X-Forwarded-Host`, `Forwarded` y `X-Forwarded-Port` hacia un oyente local mío, las reescrituras del panel siguieron siendo internas. El oyente no recibió **ninguna** petición.

Redirecciones: las 307 y 308 de Next van a rutas relativas, así que no hay redirección abierta.

**Cabeceras.** Revisé la tienda, el panel, los 404 de cada lado, el 404 del Host desconocido, la API, `/pedido/*`, `/favicon.ico` y `/_next/static`:
- En todas: CSP con `frame-ancestors 'none'` y sin orígenes de terceros, HSTS `max-age=31536000` sin `includeSubDomains`, `nosniff`, `X-Frame-Options: DENY`, COOP y CORP `same-origin`, y `Permissions-Policy`.
- `Referrer-Policy` es `no-referrer` en `/pedido/*` y `/mi-pedido/*`.
- `X-Robots-Tag: noindex` en el panel.
- No hay `X-Powered-By`, ni `Access-Control-Allow-*` aunque llegue un `Origin` de otro subdominio.

**Registro de permisos (E0-6)**
- `requierePermiso` siempre lanza 401, y `rutaAdmin` la llama antes que el manejador (prueba "corta con 401 … antes de correr el manejador").
- La prueba con ejemplos malos detecta 6 casos.
- Lo que no detecta está en M3.

**Fuentes y archivos estáticos (E0-7)**
- El HTML de la tienda y del panel no tiene `src` ni `href` externos; la única URL absoluta es el espacio de nombres SVG.
- No hay `url(http…)` ni `@import` externos en `.next/static`, y nadie usa `next/font/google`.
- Las 90 fuentes son locales. `icon.svg` no tiene scripts ni enlaces.
- No hay `dangerouslySetInnerHTML`, `eval` ni `"use client"` / `"use server"`.

**CI (E0-8)**
- Las acciones están fijadas por commit y coinciden con sus etiquetas: `actions/checkout` `3d3c42e…` = v7.0.1 y `actions/setup-node` `949feb2…` = v7.1.0 (`git ls-remote`).
- Permisos `contents: read` y `persist-credentials: false`.
- La suma de gitleaks 8.30.1 coincide con el archivo de sumas oficial de la versión.

**Secretos**
- gitleaks 8.30.1 (suma verificada) sobre **todas** las ramas (`--log-opts=--all`, 18 commits) → "no leaks found".
- Búsqueda manual en `git log --all -p` de direcciones de Postgres con clave, llaves de Google y GitHub, llaves privadas y hosts de Railway → solo valores falsos de las pruebas (`SECRETO`, `CLAVE`, `CLAVE_FALSA`) y la clave del Postgres desechable del CI (`solo-para-ci`).
- `.gitignore` excluye `.env*` (salvo `.env.example`), llaves y volcados. `.env.example` tiene solo nombres.

**Dependencias**
- `npm audit --omit=dev` → 1 moderado (M6), 0 altos y 0 críticos.
- `npm audit` completo → 8 moderados, 0 altos (al 19 nov).
- El `package-lock.json` está versionado, con las 508 entradas de `registry.npmjs.org` con `integrity`, y las versiones en `package.json` son exactas.

## Lo que no revisé (y por qué)
- **Sesión, cookies `__Host-`, Google OAuth, `Origin` y `Sec-Fetch-Site` (CSRF), límites de intentos, bitácora, permisos por rol y costos ocultos:** todavía no existen (historias B2 a B4 de la sección 11.5). Se revisan en la etapa 2, con las pruebas obligatorias de 5.4.
- **Aislamiento entre clientes:** el diseño usa una instalación y una base por cliente (3.1), así que no hay una consulta multiempresa que atacar en la Etapa 0. Se revisa con E0-9: que cada servicio de Railway tenga su propia `DATABASE_URL` y que la demo no alcance la base de Crumble.
- **Demo (`MODO_DEMO` + `instalacion.es_demo`, restablecimiento), `ESTADO_SERVICIO=suspendido`, imágenes, importación, webhooks y pagos:** no hay código todavía. Hoy `ESTADO_SERVICIO` se valida pero no tiene efecto, y la comprobación cruzada de la demo al arrancar no existe (etapa 10).
- **Railway (E0-9), dominios, respaldos y la protección de datos personales en producción (Ley 8968):** no hay despliegue. `/privacidad` y el aviso todavía no existen en el código.
- **El comportamiento detrás del proxy de Railway** (qué `Host` y qué `X-Forwarded-*` llegan de verdad). Lo probé solo en local. Conviene correr `tests/servidor` contra el servicio desplegado.
- **Los registros de las ejecuciones de GitHub Actions:** solo vi el estado (`success`) por la API, no el contenido.

## Decisiones tomadas
- **APROBADO con condiciones, y no RECHAZADO.** No hay nada crítico ni alto que se pueda explotar en lo construido. M1 y M2 son configuración del repositorio, dependen del dueño y se vuelven bloqueantes justo antes de E0-9, que es cuando entran valores reales y despliegue desde `main`.
- **M1 como medio y no como alto.** No hay secretos ni datos en el repositorio y la seguridad no depende de esconder el código. Lo que aumenta es el daño de cualquier error futuro. Si el dueño lo deja público, M2 pasa a ser imprescindible.
- **M6 como medio aunque npm lo marque "moderado".** El diseño planea usar justo la caché afectada. Lo ato a la primera historia de caché, no a esta etapa.

## Pendientes y riesgos
- **Para el dueño:** M1 (visibilidad) y M2 (protección de `main`), antes de E0-9.
- **Para Backend:** M3 y M4 antes de la etapa 2; M5 antes de la etapa 8; B1, B3, B4 y B5 cuando convenga.
- **Para DevOps:** B6. Además, correr `tests/servidor` contra Railway en E0-9.
- **Para el Project Manager:** M6 (subir `next` en los dos repositorios antes de usar la caché).
- Cuando Crumble tenga datos reales de clientes y pagos registrados, recomiendo, además de la revisión de la etapa 11, una prueba de penetración externa antes de vender la instalación a otras pastelerías.

## Preguntas para el Project Manager
- ¿El repositorio público fue una decisión del dueño? Si sí, hay que actualizar 5.1; si no, que el dueño lo vuelva privado antes de E0-9.
- ¿Quién activa la protección de `main`, y cuándo? Propongo que sea antes de unir `feat/etapa0` a `main`.
- ¿Se agenda la subida a `next` 16.4.6 (Crumble y sticr.app) antes de las historias de caché de la tienda?

## Dependencias nuevas
- Ninguna. Seguridad no agrega dependencias. gitleaks 8.30.1 se usó como binario temporal con suma verificada, fuera del repositorio.
