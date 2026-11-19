// Configuración de la instalación (E0-2): lee y valida con zod las variables de entorno de
// diseno-tecnico.md 5.7 (más las de soporte). Si falta algo, el servicio NO arranca
// (instrumentation.ts) y el mensaje dice en español qué variable falla, nunca su valor.
//
// Este módulo no importa "server-only" porque también lo usan proxy.ts y next.config.ts no lo
// necesita; aun así, solo debe importarse desde el servidor (nunca desde un componente de cliente):
// ninguna variable de aquí lleva el prefijo NEXT_PUBLIC_, así que Next.js no las envía al navegador.
import { z } from "zod";

export const LARGO_MINIMO_SECRETO = 32;

export type Config = {
  databaseUrl: string;
  /** Origen de la tienda, p. ej. https://crumble.sticr.app (sin barra final). */
  urlTienda: string;
  /** Origen del panel, p. ej. https://crumble-admin.sticr.app (sin barra final). */
  urlPanel: string;
  /** Host (nombre y puerto, en minúsculas) de cada dirección, para enrutar por Host. */
  hostTienda: string;
  hostPanel: string;
  google: { clientId: string; clientSecret: string } | null;
  sessionSecret: string;
  propietariaEmail: string | null;
  ipHashSalt: string;
  retencionPedidosMeses: number;
  modoDemo: boolean;
  demoResetMinutos: number | null;
  estadoServicio: "activo" | "suspendido";
  soporte: { url: string; origen: "crumble" | "pasteleria-demo"; secreto: string } | null;
};

/** Error de configuración: su mensaje lista las variables con problema, sin valores. */
export class ErrorDeConfiguracion extends Error {
  constructor(public readonly problemas: string[]) {
    super(
      "La configuración de Crumble no es válida y el servicio no puede arrancar. Revisa estas variables de entorno (ver .env.example):\n" +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ErrorDeConfiguracion";
  }
}

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Un texto vacío o de solo espacios cuenta como "falta". */
const vacioEsFalta = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const texto = (mensajeFalta = "falta.") =>
  z.preprocess(vacioEsFalta, z.string({ error: (i) => (i.input === undefined ? mensajeFalta : "debe ser texto.") }).trim());

const textoOpcional = () => z.preprocess(vacioEsFalta, z.string({ error: "debe ser texto." }).trim().optional());

const textoSecreto = () =>
  z.string({ error: (i) => (i.input === undefined ? "falta." : "debe ser texto.") }).refine((s) => s.length >= LARGO_MINIMO_SECRETO, {
    error: `es muy corta: debe tener al menos ${LARGO_MINIMO_SECRETO} caracteres aleatorios.`,
  });
const secreto = () => z.preprocess(vacioEsFalta, textoSecreto());
const secretoOpcional = () => z.preprocess(vacioEsFalta, textoSecreto().optional());

const entero = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((s) => /^\d+$/.test(s), { error: "debe ser un número entero." })
    .transform(Number)
    .refine((n) => n >= min && n <= max, { error: `debe estar entre ${min} y ${max}.` });

/** Dirección pública de la instalación: https (http solo en la propia máquina), sin ruta ni consulta. */
const direccionPublica = texto().superRefine((s, ctx) => {
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    ctx.addIssue({ code: "custom", message: "no es una dirección válida (ejemplo: https://crumble.sticr.app)." });
    return;
  }
  const local = HOSTS_LOCALES.has(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    ctx.addIssue({ code: "custom", message: "debe empezar con https:// (http:// solo se acepta en la propia máquina)." });
  }
  if (u.username || u.password) ctx.addIssue({ code: "custom", message: "no debe llevar usuario ni clave." });
  if (u.pathname !== "/" || u.search || u.hash || s.endsWith("/")) {
    ctx.addIssue({ code: "custom", message: "debe ser solo el origen, sin ruta, sin consulta y sin barra final." });
  }
});

const esquema = z
  .object({
    DATABASE_URL: texto().superRefine((s, ctx) => {
      try {
        const u = new URL(s);
        if (!["postgres:", "postgresql:"].includes(u.protocol)) throw new Error();
      } catch {
        ctx.addIssue({ code: "custom", message: "no es una dirección de Postgres válida (postgresql://...)." });
      }
    }),
    URL_TIENDA: direccionPublica,
    URL_PANEL: direccionPublica,
    GOOGLE_CLIENT_ID: textoOpcional(),
    GOOGLE_CLIENT_SECRET: textoOpcional(),
    SESSION_SECRET: secreto(),
    PROPIETARIA_EMAIL: textoOpcional(),
    IP_HASH_SALT: secreto(),
    RETENCION_PEDIDOS_MESES: z.preprocess(vacioEsFalta, z.string({ error: (i) => (i.input === undefined ? "falta." : "debe ser texto.") }).pipe(entero(1, 120))),
    MODO_DEMO: z.preprocess(
      vacioEsFalta,
      z
        .enum(["true", "false"], { error: 'debe ser "true" o "false".' })
        .optional()
        .transform((v) => v === "true"),
    ),
    DEMO_RESET_MINUTOS: z.preprocess(vacioEsFalta, z.string().pipe(entero(5, 1440)).optional()),
    ESTADO_SERVICIO: z.preprocess(
      vacioEsFalta,
      z.enum(["activo", "suspendido"], { error: (i) => (i.input === undefined ? "falta." : 'debe ser "activo" o "suspendido".') }),
    ),
    SOPORTE_URL: textoOpcional(),
    SOPORTE_ORIGEN: z.preprocess(vacioEsFalta, z.enum(["crumble", "pasteleria-demo"], { error: 'debe ser "crumble" o "pasteleria-demo".' }).optional()),
    SOPORTE_SECRETO: secretoOpcional(),
  });

/**
 * Reglas entre variables. Se revisan sobre los textos crudos (aparte del esquema) para que el
 * mensaje liste TODO lo que falta de una vez, aunque otra variable también falle.
 */
function problemasCruzados(e: Record<string, string | undefined>): Map<string, string> {
  const valor = (k: string) => {
    const s = e[k];
    return typeof s === "string" && s.trim() !== "" ? s.trim() : undefined;
  };
  const problemas = new Map<string, string>();
  const falta = (variable: string, motivo: string) => problemas.set(variable, `${variable}: falta (${motivo}).`);

  if (valor("MODO_DEMO") === "true") {
    if (!valor("DEMO_RESET_MINUTOS")) falta("DEMO_RESET_MINUTOS", "obligatoria con MODO_DEMO=true");
  } else {
    // Fuera de la demo se entra con Google y la primera propietaria sale de PROPIETARIA_EMAIL (5.4).
    for (const k of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "PROPIETARIA_EMAIL"]) {
      if (!valor(k)) falta(k, "obligatoria fuera de la demo");
    }
  }
  const correo = valor("PROPIETARIA_EMAIL");
  if (correo && !z.email().safeParse(correo).success) problemas.set("PROPIETARIA_EMAIL", "PROPIETARIA_EMAIL: no es un correo válido.");

  // Soporte: las tres juntas o ninguna (el botón llega en una etapa posterior; soporte.md).
  const soporte = ["SOPORTE_URL", "SOPORTE_ORIGEN", "SOPORTE_SECRETO"];
  if (soporte.some((k) => valor(k)) && !soporte.every((k) => valor(k))) {
    for (const k of soporte) if (!valor(k)) falta(k, "las tres variables de soporte van juntas");
  }
  const soporteUrl = valor("SOPORTE_URL");
  if (soporteUrl) {
    let ok = false;
    try {
      ok = new URL(soporteUrl).protocol === "https:";
    } catch {}
    if (!ok) problemas.set("SOPORTE_URL", "SOPORTE_URL: debe ser una dirección https://.");
  }

  // Tienda y panel deben ser direcciones distintas: el enrutado por Host depende de eso (5.3).
  const tienda = valor("URL_TIENDA");
  const panel = valor("URL_PANEL");
  if (tienda && panel) {
    try {
      if (new URL(tienda).host === new URL(panel).host) {
        problemas.set("URL_PANEL", "URL_PANEL: debe tener un nombre distinto del de URL_TIENDA.");
      }
    } catch {}
  }
  return problemas;
}

/** Variables que lee la configuración (para mensajes y pruebas). */
export const VARIABLES = Object.keys(esquema.shape) as (keyof typeof esquema.shape)[];

/**
 * Lee y valida la configuración. Lanza ErrorDeConfiguracion con la lista de variables con
 * problema. Nunca incluye valores en el mensaje (ni siquiera los que fallan).
 */
export function leerConfig(entorno: Record<string, string | undefined> = process.env): Config {
  const datos = Object.fromEntries(VARIABLES.map((k) => [k, entorno[k]]));
  const r = esquema.safeParse(datos);
  const problemas = new Map<string, string>();
  for (const issue of r.success ? [] : r.error.issues) {
    const variable = String(issue.path[0] ?? "configuración");
    // Una línea por variable: el primer problema es el que importa.
    if (!problemas.has(variable)) problemas.set(variable, `${variable}: ${issue.message}`);
  }
  for (const [variable, texto] of problemasCruzados(entorno)) if (!problemas.has(variable)) problemas.set(variable, texto);
  if (!r.success || problemas.size > 0) throw new ErrorDeConfiguracion([...problemas.values()].sort());
  const v = r.data;
  const tienda = new URL(v.URL_TIENDA);
  const panel = new URL(v.URL_PANEL);
  return {
    databaseUrl: v.DATABASE_URL,
    urlTienda: tienda.origin,
    urlPanel: panel.origin,
    hostTienda: tienda.host.toLowerCase(),
    hostPanel: panel.host.toLowerCase(),
    google: v.GOOGLE_CLIENT_ID && v.GOOGLE_CLIENT_SECRET ? { clientId: v.GOOGLE_CLIENT_ID, clientSecret: v.GOOGLE_CLIENT_SECRET } : null,
    sessionSecret: v.SESSION_SECRET,
    propietariaEmail: v.PROPIETARIA_EMAIL ? v.PROPIETARIA_EMAIL.toLowerCase() : null,
    ipHashSalt: v.IP_HASH_SALT,
    retencionPedidosMeses: v.RETENCION_PEDIDOS_MESES,
    modoDemo: v.MODO_DEMO,
    demoResetMinutos: v.DEMO_RESET_MINUTOS ?? null,
    estadoServicio: v.ESTADO_SERVICIO,
    soporte:
      v.SOPORTE_URL && v.SOPORTE_ORIGEN && v.SOPORTE_SECRETO
        ? { url: v.SOPORTE_URL, origen: v.SOPORTE_ORIGEN, secreto: v.SOPORTE_SECRETO }
        : null,
  };
}

let guardada: Config | null = null;

/** Configuración validada de este proceso (se valida una vez y se guarda). */
export function obtenerConfig(): Config {
  guardada ??= leerConfig();
  return guardada;
}

/** Solo para pruebas: olvida la configuración guardada para volver a leer process.env. */
export function reiniciarConfig(): void {
  guardada = null;
}
