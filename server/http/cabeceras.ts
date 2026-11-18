// Cabeceras de seguridad (E0-5; diseño técnico 5.3 y 5.4; seguridad.md 4). Las usa next.config.ts
// para todas las respuestas, y proxy.ts para las que responde él mismo (404 y redirecciones).
// Módulo puro: sin "server-only" porque next.config.ts lo importa al compilar.
//
// CSP sin nonces (como sticr.app, guía "Without Nonces" de Next.js 16): los nonces obligan a
// renderizar cada página en cada petición y la tienda se sirve desde caché (5.2). Compromiso:
// 'unsafe-inline' en script-src y style-src (Next.js inserta scripts en línea para hidratar).
// Ningún origen de terceros: ni scripts, ni fuentes, ni imágenes, ni conexiones. El inicio de
// sesión con Google es una navegación (enlace y redirección), que la CSP no limita.

export type Cabecera = { key: string; value: string };

export function politicaDeContenido(desarrollo: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    // En desarrollo (http://localhost) no se fuerza https.
    ...(desarrollo ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function cabecerasDeSeguridad(desarrollo: boolean): Cabecera[] {
  return [
    { key: "Content-Security-Policy", value: politicaDeContenido(desarrollo) },
    // Sin includeSubDomains ni preload: sticr.app tiene otros sistemas que no son de Crumble (5.4).
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
  ];
}

/**
 * Páginas del estado del pedido: el enlace lleva el token del pedido, así que no se envía como
 * Referer a nadie (5.4). Las dos formas porque 11.2 dice pedido/[token] y el ejemplo de 4.1
 * mi-pedido/<token>; la que no se use no estorba.
 */
export const RUTAS_SIN_REFERER = ["/pedido/:token*", "/mi-pedido/:token*"] as const;

export function reglasDeCabeceras(desarrollo: boolean) {
  return [
    { source: "/:path*", headers: cabecerasDeSeguridad(desarrollo) },
    // Va después de la general: con la misma clave, la última regla que coincide es la que queda.
    ...RUTAS_SIN_REFERER.map((source) => ({ source, headers: [{ key: "Referrer-Policy", value: "no-referrer" }] })),
  ];
}
