// Revisión de QA de la Etapa 0 (E0-5 y E0-7) contra un servidor real, por cabecera Host.
//
// No es parte de `npm test`: es un script de Playwright que corre QA a mano (Playwright no es
// dependencia del proyecto). Cómo correrlo:
//
//   1. npm run build y arrancar `npm run start` con URL_TIENDA=https://tienda.prueba.local y
//      URL_PANEL=https://panel.prueba.local (como tests/servidor).
//   2. RUTA_PLAYWRIGHT=/ruta/a/node_modules/playwright \
//      URL_SERVIDOR_PRUEBA=http://127.0.0.1:3000 \
//      CARPETA_CAPTURAS=/tmp/capturas \
//      node e2e/qa-etapa0/revision.mjs
//
// El navegador pide https://tienda.prueba.local/... y https://panel.prueba.local/... (la CSP lleva
// upgrade-insecure-requests). Cada petición a esos dos nombres se intercepta y se manda al servidor
// local con la cabecera Host de la dirección; cualquier otra petición cuenta como externa y se corta.
//
// Comprueba en 360, 390, 768, 1024, 1280, 1440 y 1920 px, para la portada y el 404 de la tienda y del
// panel: estado HTTP, desborde horizontal, lang es-CR, un h1, título, fuentes propias y cero
// peticiones externas, signo ₡ dibujado con su fuente de respaldo, favicon e íconos, axe (WCAG 2.2
// AA y buenas prácticas) y, en 390, 1280 y 1440 px, el recorrido con teclado y el foco visible.
// Sale con 1 si algo falla e imprime un resumen JSON.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requerir = createRequire(import.meta.url);
const SERVIDOR = new URL(process.env.URL_SERVIDOR_PRUEBA || "http://127.0.0.1:3000");
const CAPTURAS = process.env.CARPETA_CAPTURAS || path.resolve("qa-capturas");
const { chromium } = requerir(process.env.RUTA_PLAYWRIGHT || "playwright");
const AXE = fs.readFileSync(requerir.resolve("axe-core/axe.min.js"), "utf8");

const HOSTS = { tienda: "tienda.prueba.local", panel: "panel.prueba.local" };
const ANCHOS = [360, 390, 768, 1024, 1280, 1440, 1920];
const ANCHOS_TECLADO = [390, 1280, 1440];
const PAGINAS = [
  { lado: "tienda", ruta: "/", estado: 200, nombre: "tienda-portada" },
  { lado: "tienda", ruta: "/no-existe-qa", estado: 404, nombre: "tienda-404" },
  { lado: "panel", ruta: "/", estado: 200, nombre: "panel-inicio" },
  { lado: "panel", ruta: "/no-existe-qa", estado: 404, nombre: "panel-404" },
];

fs.mkdirSync(CAPTURAS, { recursive: true });

/** Pide una ruta al servidor local con la cabecera Host indicada. */
function pedir(host, ruta, metodo = "GET", cabeceras = {}) {
  return new Promise((resolver, rechazar) => {
    const req = http.request(
      { hostname: SERVIDOR.hostname, port: SERVIDOR.port, path: ruta, method: metodo, headers: { ...cabeceras, host } },
      (res) => {
        const partes = [];
        res.on("data", (c) => partes.push(c));
        res.on("end", () => resolver({ estado: res.statusCode ?? 0, cabeceras: res.headers, cuerpo: Buffer.concat(partes) }));
      },
    );
    req.on("error", rechazar);
    req.end();
  });
}

const fallas = [];
const resultados = [];
const fallar = (donde, que) => fallas.push(`${donde}: ${que}`);

async function nuevoContexto(navegador, ancho) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: ancho <= 390 ? 844 : 900 }, locale: "es-CR" });
  const externas = [];
  const internas = [];
  await contexto.route("**/*", async (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    if (!Object.values(HOSTS).includes(url.hostname)) {
      externas.push(peticion.url());
      return ruta.abort();
    }
    internas.push(url.pathname);
    const cabeceras = { ...peticion.headers() };
    delete cabeceras.host;
    const r = await pedir(url.hostname, url.pathname + url.search, peticion.method(), cabeceras);
    const fuera = {};
    for (const [k, v] of Object.entries(r.cabeceras)) if (v !== undefined) fuera[k] = Array.isArray(v) ? v.join(", ") : String(v);
    await ruta.fulfill({ status: r.estado, headers: fuera, body: r.cuerpo });
  });
  return { contexto, externas, internas };
}

/** Desborde: ancho del documento y elementos visibles que salen del borde. */
async function revisarDesborde(pagina) {
  return pagina.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    const fuera = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const estilo = getComputedStyle(el);
      if (estilo.visibility === "hidden" || estilo.position === "fixed") continue;
      if (r.right > ancho + 1 || r.left < -1) fuera.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} (${Math.round(r.left)}–${Math.round(r.right)})`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, ancho, fuera: fuera.slice(0, 5) };
  });
}

/** Fuente que Chromium usó de verdad para dibujar un nodo (CDP). */
async function fuentesDibujadas(pagina, selector) {
  const cdp = await pagina.context().newCDPSession(pagina);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) return [];
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  await cdp.detach();
  return fonts.map((f) => `${f.familyName}${f.isCustomFont ? " (web)" : " (sistema)"}×${f.glyphCount}`);
}

async function revisarTeclado(pagina, donde) {
  const pasos = [];
  await pagina.keyboard.press("Tab");
  const primero = await pagina.evaluate(() => {
    const el = document.activeElement;
    const r = el.getBoundingClientRect();
    return { texto: el.textContent?.trim(), href: el.getAttribute("href"), ancho: r.width, alto: r.height, dentro: r.top >= 0 && r.left >= 0 };
  });
  pasos.push(`Tab 1 → "${primero.texto}" (${Math.round(primero.ancho)}×${Math.round(primero.alto)})`);
  if (primero.texto !== "Saltar al contenido" || primero.ancho < 20 || !primero.dentro) fallar(donde, `el primer Tab no muestra "Saltar al contenido" visible (${JSON.stringify(primero)})`);
  await pagina.screenshot({ path: path.join(CAPTURAS, `${donde}-foco-saltar.png`) });
  await pagina.keyboard.press("Enter");
  await pagina.waitForTimeout(150);
  const tras = await pagina.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  pasos.push(`Enter → foco en "${tras}"`);
  if (tras !== "contenido") fallar(donde, `Enter en "Saltar al contenido" deja el foco en ${tras}, no en #contenido`);
  // Recorrido completo: cada elemento enfocable con foco visible (contorno o sombra) y dentro de la vista.
  const vistos = [];
  for (let i = 0; i < 15; i++) {
    await pagina.keyboard.press("Tab");
    const info = await pagina.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const e = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const visible = (e.outlineStyle !== "none" && parseFloat(e.outlineWidth) >= 2) || (e.boxShadow && e.boxShadow !== "none");
      return {
        nombre: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 40),
        etiqueta: el.tagName.toLowerCase(),
        visible,
        contorno: `${e.outlineStyle} ${e.outlineWidth} ${e.outlineColor} desfase ${e.outlineOffset}`,
        alto: Math.round(r.height),
      };
    });
    if (!info) break;
    const clave = `${info.etiqueta}:${info.nombre}`;
    if (vistos.includes(clave)) break;
    vistos.push(clave);
    pasos.push(`Tab → ${info.etiqueta} "${info.nombre}" alto ${info.alto} px, foco: ${info.contorno}`);
    if (!info.visible) fallar(donde, `sin foco visible en ${clave}`);
    if (info.alto < 24) fallar(donde, `objetivo táctil de ${info.alto} px en ${clave}`);
    await pagina.screenshot({ path: path.join(CAPTURAS, `${donde}-foco-${vistos.length}.png`) });
  }
  return pasos;
}

async function revisarPagina(navegador, p, ancho) {
  const donde = `${p.nombre}-${ancho}`;
  const { contexto, externas, internas } = await nuevoContexto(navegador, ancho);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const fallidas = [];
  pagina.on("response", (res) => res.status() >= 400 && fallidas.push(`${res.status()} ${new URL(res.url()).pathname}`));
  const respuesta = await pagina.goto(`https://${HOSTS[p.lado]}${p.ruta}`, { waitUntil: "networkidle" });
  const r = { donde, estado: respuesta?.status() };
  if (r.estado !== p.estado) fallar(donde, `estado ${r.estado}, se esperaba ${p.estado}`);
  const html = (await respuesta?.text()) ?? "";
  r.tituloHtml = /<title>([^<]*)<\/title>/.exec(html)?.[1];
  await pagina.waitForTimeout(500);
  r.tituloDocumento = await pagina.title();
  // Defecto QA-E0-01: en los 404, React cambia el título del HTML por el del layout al hidratar.
  if (r.tituloDocumento !== r.tituloHtml) fallar(donde, `document.title "${r.tituloDocumento}" distinto del <title> del HTML "${r.tituloHtml}"`);
  if (p.estado === 404 && !/No encontramos esta página/.test(r.tituloDocumento)) fallar(donde, `el título del 404 no lo dice: "${r.tituloDocumento}"`);
  r.lang = await pagina.evaluate(() => document.documentElement.lang);
  if (r.lang !== "es-CR") fallar(donde, `lang="${r.lang}"`);
  r.h1 = await pagina.locator("h1").count();
  if (r.h1 !== 1) fallar(donde, `${r.h1} h1`);
  r.robots = await pagina.evaluate(() => [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content));
  const d = await revisarDesborde(pagina);
  r.desborde = d;
  if (d.scrollWidth > d.ancho || d.fuera.length) fallar(donde, `desborde horizontal ${JSON.stringify(d)}`);
  r.fuentesH1 = await fuentesDibujadas(pagina, "h1");
  r.fuentesTexto = await fuentesDibujadas(pagina, "main p:not(.rotulo):not(.cifra)");
  const familiasEsperadas = p.lado === "tienda" ? { h1: /Marcellus/, texto: /Jost/ } : { h1: /Onest/, texto: /Onest/ };
  if (!r.fuentesH1.some((f) => familiasEsperadas.h1.test(f) && f.includes("(web)"))) fallar(donde, `h1 no se dibuja con su fuente propia: ${r.fuentesH1}`);
  if (!r.fuentesTexto.some((f) => familiasEsperadas.texto.test(f) && f.includes("(web)"))) fallar(donde, `texto no se dibuja con su fuente propia: ${r.fuentesTexto}`);
  // Signo ₡ (todavía ninguna página lo muestra: se inserta, como hizo Frontend, en texto y en cifra).
  await pagina.evaluate((lado) => {
    const main = document.querySelector("main");
    const texto = document.createElement("p");
    texto.id = "qa-colon-texto";
    texto.textContent = "Desde ₡13 500";
    const cifra = document.createElement("p");
    cifra.id = "qa-colon-cifra";
    cifra.className = lado === "panel" ? "cifra" : "cifras";
    cifra.textContent = "₡36 000";
    main.append(texto, cifra);
  }, p.lado);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(300);
  r.colonTexto = await fuentesDibujadas(pagina, "#qa-colon-texto");
  r.colonCifra = await fuentesDibujadas(pagina, "#qa-colon-cifra");
  for (const [clave, fuentes] of [["texto", r.colonTexto], ["cifra", r.colonCifra]]) {
    if (!fuentes.some((f) => /^Colon /.test(f) && f.includes("(web)"))) fallar(donde, `el ₡ en ${clave} no usa la fuente de respaldo propia: ${fuentes}`);
  }
  if (ancho === 390 || ancho === 1280) await pagina.locator("#qa-colon-texto").screenshot({ path: path.join(CAPTURAS, `${donde}-colon.png`) });
  await pagina.evaluate(() => document.querySelectorAll("[id^=qa-colon]").forEach((n) => n.remove()));
  // Íconos declarados en el head, y que respondan con su tipo.
  r.iconos = await pagina.evaluate(() =>
    [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map((l) => ({ rel: l.rel, href: l.getAttribute("href"), sizes: l.getAttribute("sizes"), tipo: l.getAttribute("type") })),
  );
  for (const rel of ["icon", "apple-touch-icon", "manifest"]) if (!r.iconos.some((i) => i.rel.split(" ").includes(rel))) fallar(donde, `falta <link rel="${rel}">`);
  // axe
  await pagina.evaluate(AXE);
  const axe = await pagina.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } }),
  );
  r.axeViolaciones = axe.violations.map((v) => ({ id: v.id, impacto: v.impact, nodos: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) }));
  r.axeIncompletas = axe.incomplete.map((v) => ({ id: v.id, nodos: v.nodes.length }));
  r.axePasan = axe.passes.length;
  for (const v of r.axeViolaciones) fallar(donde, `axe ${v.id} (${v.impacto}) en ${v.nodos.join(", ")}`);
  await pagina.screenshot({ path: path.join(CAPTURAS, `${donde}.png`), fullPage: true });
  if (ANCHOS_TECLADO.includes(ancho)) {
    await pagina.reload({ waitUntil: "networkidle" });
    r.teclado = await revisarTeclado(pagina, donde);
  }
  r.externas = [...new Set(externas)];
  if (r.externas.length) fallar(donde, `peticiones externas: ${r.externas.join(", ")}`);
  r.fuentesPedidas = [...new Set(internas.filter((x) => /\.(woff2?|ttf|otf)$/.test(x)))].length;
  // El 404 del propio documento deja un aviso en consola; cualquier otra respuesta fallida es defecto.
  r.respuestasFallidas = [...new Set(fallidas)];
  const ajenas = r.respuestasFallidas.filter((f) => f !== `404 ${p.ruta}`);
  if (ajenas.length) fallar(donde, `recursos con error: ${ajenas.join(", ")}`);
  r.erroresConsola = errores;
  const otrosErrores = errores.filter((e) => !/status of 404/.test(e));
  if (otrosErrores.length || errores.length > r.respuestasFallidas.length * 2) fallar(donde, `errores en consola: ${errores.join(" | ")}`);
  resultados.push(r);
  await contexto.close();
}

/** Favicon e íconos: que respondan con su tipo y se dibujen a 16 y 32 px. */
async function revisarIconos(navegador) {
  const lista = [
    ["/favicon.ico", /image\/(x-icon|vnd\.microsoft\.icon)/],
    ["/icon.svg", /image\/svg\+xml/],
    ["/apple-icon.png", /image\/png/],
    ["/manifest.webmanifest", /application\/manifest\+json/],
    ["/iconos/icono-192.png", /image\/png/],
    ["/iconos/icono-512.png", /image\/png/],
  ];
  const salida = [];
  for (const lado of ["tienda", "panel"]) {
    for (const [ruta, tipo] of lista) {
      const r = await pedir(HOSTS[lado], ruta);
      const ct = String(r.cabeceras["content-type"]);
      salida.push(`${lado} ${ruta} → ${r.estado} ${ct} ${r.cuerpo.length} B`);
      if (r.estado !== 200 || !tipo.test(ct)) fallar(`iconos-${lado}`, `${ruta} → ${r.estado} ${ct}`);
    }
    const manifiesto = JSON.parse((await pedir(HOSTS[lado], "/manifest.webmanifest")).cuerpo.toString());
    salida.push(`${lado} manifiesto: lang=${manifiesto.lang} nombre="${manifiesto.name}" íconos=${manifiesto.icons?.map((i) => i.sizes).join(",")}`);
  }
  const { contexto } = await nuevoContexto(navegador, 400);
  const pagina = await contexto.newPage();
  await pagina.goto(`https://${HOSTS.tienda}/`, { waitUntil: "networkidle" });
  // Chromium pide /favicon.ico por su cuenta, fuera de la intercepción de Playwright: se dibujan
  // los bytes que sirve el servidor (por Host) como data URL, a 16 y 32 px, en claro y en oscuro.
  const datos = {};
  for (const [ruta, tipo] of [["/favicon.ico", "image/x-icon"], ["/icon.svg", "image/svg+xml"]]) {
    datos[ruta] = `data:${tipo};base64,${(await pedir(HOSTS.tienda, ruta)).cuerpo.toString("base64")}`;
  }
  for (const esquema of ["light", "dark"]) {
    await pagina.emulateMedia({ colorScheme: esquema });
    await pagina.evaluate(({ esq, datos }) => {
      document.body.innerHTML = `<div id="qa-iconos" style="display:flex;gap:16px;padding:16px;background:${esq === "dark" ? "#202124" : "#fff"}">${Object.entries(datos)
        .map(([ruta, src]) => [16, 32].map((t) => `<img data-ruta="${ruta}" src="${src}" width="${t}" height="${t}" alt="">`).join(""))
        .join("")}</div>`;
    }, { esq: esquema, datos });
    const cargadas = await pagina.evaluate(() =>
      Promise.all([...document.querySelectorAll("#qa-iconos img")].map((i) => i.decode().then(() => `${i.dataset.ruta} a ${i.width}px ok`, () => `${i.dataset.ruta} a ${i.width}px FALLA`))),
    );
    salida.push(`dibujo ${esquema}: ${cargadas.join("; ")}`);
    if (cargadas.some((c) => c.includes("FALLA"))) fallar("iconos", `no se dibujan en modo ${esquema}: ${cargadas.join("; ")}`);
    await pagina.locator("#qa-iconos").screenshot({ path: path.join(CAPTURAS, `favicon-16-32-${esquema}.png`), scale: "device" });
  }
  await contexto.close();
  return salida;
}

/** Host desconocido: 404 propio del proxy, con lang es-CR. */
async function revisarHostDesconocido() {
  const r = await pedir("otro.sticr.app", "/");
  const html = r.cuerpo.toString();
  if (r.estado !== 404) fallar("host-desconocido", `estado ${r.estado}`);
  if (!html.includes('lang="es-CR"')) fallar("host-desconocido", "sin lang es-CR");
  return `${r.estado} ${html.slice(0, 120)}`;
}

const navegador = await chromium.launch();
try {
  for (const p of PAGINAS) for (const ancho of ANCHOS) await revisarPagina(navegador, p, ancho);
  const iconos = await revisarIconos(navegador);
  const desconocido = await revisarHostDesconocido();
  fs.writeFileSync(path.join(CAPTURAS, "resultados.json"), JSON.stringify({ resultados, iconos, desconocido, fallas }, null, 2));
  console.log(JSON.stringify({ paginas: resultados.length, iconos, desconocido, fallas }, null, 2));
} finally {
  await navegador.close();
}
process.exit(fallas.length ? 1 : 0);
