// Proxy de Next.js 16 (antes "middleware"; guía 01-app/01-getting-started/16-proxy.md). E0-5:
// - Enruta por Host entre tienda y panel con URL_TIENDA y URL_PANEL (server/http/enrutado.ts).
//   El panel se sirve en la raíz de su dirección: reescritura interna a /panel/....
// - Pone un id a cada petición (x-id-peticion), que las rutas usan en sus registros y que vuelve
//   en la respuesta como X-Id-Peticion. Un id que mande el navegador se reemplaza.
// - En el panel y en la demo agrega X-Robots-Tag: noindex (5.3: no se indexan).
// No es un mecanismo de autorización: los permisos se comprueban en cada ruta (5.4).
import { NextResponse, type NextRequest } from "next/server";
import { obtenerConfig, type Config } from "@/server/config";
import { cabecerasDeSeguridad } from "@/server/http/cabeceras";
import { decidir } from "@/server/http/enrutado";

const CABECERA_ID = "x-id-peticion";
/**
 * Rutas que nunca existen (las carpetas que empiezan con "_" son privadas en el App Router): caen
 * en el comodín [...resto] de cada lado y muestran su 404, con la identidad que corresponde.
 */
const RUTA_NO_ENCONTRADA = { tienda: "/_no-encontrado", panel: "/panel/_no-encontrado" } as const;
const desarrollo = process.env.NODE_ENV === "development";

/** Respuesta propia del proxy (404, 503): lleva las mismas cabeceras de seguridad y no se guarda en caché. */
function respuestaPropia(estado: number, cuerpo: string, tipo: string, id: string): NextResponse {
  const r = new NextResponse(cuerpo, { status: estado, headers: { "Content-Type": tipo, "Cache-Control": "no-store", "X-Id-Peticion": id } });
  for (const { key, value } of cabecerasDeSeguridad(desarrollo)) r.headers.set(key, value);
  return r;
}

function noEncontrado(api: boolean, id: string): NextResponse {
  return api
    ? respuestaPropia(404, JSON.stringify({ error: "no-encontrado", mensaje: "No encontramos lo que buscas." }), "application/json", id)
    : respuestaPropia(
        404,
        '<!doctype html><html lang="es-CR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>No encontrado</title></head><body data-origen="proxy"><h1>No encontramos esta página</h1></body></html>',
        "text/html; charset=utf-8",
        id,
      );
}

/**
 * Destino de una reescritura INTERNA: se parte de nextUrl (no de peticion.url, que en el servidor
 * real trae la dirección local del proceso; con otro origen Next.js la trata como externa y la
 * vuelve a pedir sin el Host de la instalación).
 */
function rutaInterna(peticion: NextRequest, ruta: string, conservarConsulta: boolean) {
  const destino = peticion.nextUrl.clone();
  destino.pathname = ruta;
  if (!conservarConsulta) destino.search = "";
  return destino;
}

/**
 * El panel no se indexa y NUNCA sale en caché (5.2), aunque Next.js haya prerenderizado la página:
 * no-store gana sobre el s-maxage de lo estático. La demo tampoco se indexa.
 */
function marcarSuperficie(r: NextResponse, superficie: "tienda" | "panel" | null, config: Config) {
  if (superficie === "panel") r.headers.set("Cache-Control", "private, no-store, max-age=0");
  if (superficie === "panel" || config.modoDemo) r.headers.set("X-Robots-Tag", "noindex, nofollow");
}

export function proxy(peticion: NextRequest): NextResponse {
  const id = crypto.randomUUID();

  let config: Config;
  try {
    config = obtenerConfig();
  } catch {
    // Con la configuración inválida el servicio no arranca (instrumentation.ts); esto es solo un seguro.
    return respuestaPropia(
      503,
      JSON.stringify({ error: "servicio-no-disponible", mensaje: "El servicio no está disponible en este momento." }),
      "application/json",
      id,
    );
  }

  const decision = decidir({
    host: peticion.headers.get("host"),
    ruta: peticion.nextUrl.pathname,
    hostTienda: config.hostTienda,
    hostPanel: config.hostPanel,
  });

  // Codificación ilegible: se corta aquí con el formato común. Si pasara, Next.js fallaría al
  // decodificar (500 en inglés y una línea de error en el registro por cada petición).
  if (decision.tipo === "ruta-invalida") return noEncontrado(true, id);

  if (decision.tipo === "no-encontrado") {
    // En una dirección conocida, las páginas muestran el 404 de la aplicación (app/not-found):
    // se reescribe a una carpeta privada ("_"), que Next.js nunca sirve. Host desconocido o API:
    // respuesta propia, sin la marca de la tienda.
    if (decision.hostConocido && !decision.api) {
      const r = NextResponse.rewrite(rutaInterna(peticion, RUTA_NO_ENCONTRADA[decision.superficie ?? "tienda"], false));
      r.headers.set("X-Id-Peticion", id);
      marcarSuperficie(r, decision.superficie, config);
      return r;
    }
    return noEncontrado(decision.api, id);
  }

  const cabecerasPeticion = new Headers(peticion.headers);
  cabecerasPeticion.set(CABECERA_ID, id);
  let r: NextResponse;
  if (decision.tipo === "reescribir") {
    r = NextResponse.rewrite(rutaInterna(peticion, decision.ruta, true), { request: { headers: cabecerasPeticion } });
  } else {
    r = NextResponse.next({ request: { headers: cabecerasPeticion } });
  }
  r.headers.set("X-Id-Peticion", id);
  marcarSuperficie(r, decision.superficie, config);
  return r;
}

export const config = {
  // Todo menos los archivos estáticos de Next (no dependen del Host ni llevan datos).
  matcher: ["/((?!_next/static|_next/image).*)"],
};
