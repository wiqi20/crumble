-- 001_base.sql: tablas base de la Etapa 0 (E0-3; diseño técnico 3.3 y 11.4):
-- instalacion, negocio, usuarios, sesiones, permisos_rol, bitacora y limites.
-- La tabla migraciones_aplicadas la crea el ejecutor (scripts/migrate.mjs).
--
-- Convenciones (3.2): fechas en UTC (timestamptz); dinero en céntimos enteros; una fila única con
-- CHECK (id = 1). Esta migración ya aplicada NO se edita: cualquier cambio va en una nueva.
-- Columnas de negocio que apuntan a tablas que aún no existen (bodega_venta_id,
-- bodega_produccion_id, logo_imagen_id) llegan con la migración que crea esas tablas.

-- Instalación: una fila. es_demo es el segundo seguro del restablecimiento de la demo (5.6):
-- nace en falso; solo la preparación de la demo lo pone en verdadero.
CREATE TABLE instalacion (
  id        smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  es_demo   boolean NOT NULL DEFAULT false,
  creada_en timestamptz NOT NULL DEFAULT now()
);
INSERT INTO instalacion (id) VALUES (1);

-- Datos del negocio: una fila (la crea la instalación o la semilla de la demo, B5).
CREATE TABLE negocio (
  id                        smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre                    text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  descripcion_corta         text CHECK (char_length(descripcion_corta) <= 300),
  whatsapp                  text CHECK (whatsapp ~ '^\+[0-9]{8,15}$'),
  telefono                  text CHECK (telefono ~ '^\+[0-9]{8,15}$'),
  correo_contacto           text CHECK (char_length(correo_contacto) <= 254),
  direccion                 text CHECK (char_length(direccion) <= 300),
  mapa_url                  text CHECK (char_length(mapa_url) <= 500 AND mapa_url ~ '^https://'),
  instagram                 text CHECK (char_length(instagram) <= 200),
  facebook                  text CHECK (char_length(facebook) <= 200),
  tiktok                    text CHECK (char_length(tiktok) <= 200),
  moneda                    char(3) NOT NULL DEFAULT 'CRC' CHECK (moneda = 'CRC'),
  plazo_base_horas          integer NOT NULL DEFAULT 24 CHECK (plazo_base_horas BETWEEN 0 AND 720),
  margen_anticipo_horas     integer NOT NULL DEFAULT 0 CHECK (margen_anticipo_horas BETWEEN 0 AND 168),
  -- Sin ruta que lo cambie (3.3).
  anticipo_porcentaje       integer NOT NULL DEFAULT 50 CHECK (anticipo_porcentaje BETWEEN 0 AND 100),
  intervalo_retiro_minutos  integer NOT NULL DEFAULT 30 CHECK (intervalo_retiro_minutos BETWEEN 5 AND 240),
  max_dias_adelanto         integer NOT NULL DEFAULT 30 CHECK (max_dias_adelanto BETWEEN 1 AND 365),
  -- Solo la propietaria lo cambia (5.4).
  iva_porcentaje            numeric(5,2) NOT NULL DEFAULT 13.00 CHECK (iva_porcentaje BETWEEN 0 AND 13),
  -- Interruptor "Descontar inventario al marcar Listo": falso de fábrica (en la demo, verdadero).
  descontar_inventario_listo boolean NOT NULL DEFAULT false,
  saldo_favor_dias          integer NOT NULL DEFAULT 60 CHECK (saldo_favor_dias BETWEEN 1 AND 365),
  saldo_favor_horas_minimas integer CHECK (saldo_favor_horas_minimas BETWEEN 1 AND 168),
  aviso_alergenos           text CHECK (char_length(aviso_alergenos) <= 1000),
  aviso_privacidad_version  text CHECK (char_length(aviso_privacidad_version) <= 40),
  actualizado_en            timestamptz NOT NULL DEFAULT now()
);

-- Usuarios del panel (5.4). El correo se guarda en minúsculas para compararlo sin ambigüedad.
CREATE TABLE usuarios (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  correo         text NOT NULL UNIQUE CHECK (correo = lower(correo) AND char_length(correo) BETWEEN 3 AND 254 AND correo LIKE '%_@_%'),
  nombre         text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  rol            text NOT NULL CHECK (rol IN ('propietaria', 'encargado')),
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  ultimo_ingreso timestamptz
);

-- Sesiones (5.4): en la base solo el resumen (sha256 en hexadecimal) del token de la cookie.
-- vence_en se corre con el uso (12 h sin uso), pero nunca pasa de 7 días desde creado_en.
CREATE TABLE sesiones (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  bigint NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  creado_en   timestamptz NOT NULL DEFAULT now(),
  vence_en    timestamptz NOT NULL,
  revocada_en timestamptz,
  CHECK (vence_en > creado_en AND vence_en <= creado_en + interval '7 days')
);
CREATE INDEX sesiones_usuario_idx ON sesiones (usuario_id);
CREATE INDEX sesiones_vence_idx ON sesiones (vence_en);

-- Permisos delegables del encargado (5.4). Solo filas del rol encargado; el CHECK restringe el
-- permiso al catálogo de permisos DELEGABLES: los no delegables no se pueden guardar aquí.
-- Debe coincidir con server/auth/permisos.ts (hay una prueba que lo comprueba).
CREATE TABLE permisos_rol (
  rol             text NOT NULL CHECK (rol = 'encargado'),
  permiso         text NOT NULL CHECK (permiso IN (
                    'pedidos.ver', 'pedidos.gestionar', 'pagos.registrar', 'pagos.anular',
                    'facturas.registrar', 'facturas.anular', 'catalogo.ver', 'catalogo.editar',
                    'opciones.disponibilidad', 'negocio.editar', 'inventario.ver', 'inventario.mover',
                    'articulos.editar', 'recetas.ver', 'recetas.editar', 'compras.registrar',
                    'compras.importar', 'proveedores.editar', 'produccion.registrar')),
  permitido       boolean NOT NULL,
  actualizado_por bigint REFERENCES usuarios (id),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rol, permiso)
);

-- Valores de fábrica del encargado (tabla de 5.4).
INSERT INTO permisos_rol (rol, permiso, permitido) VALUES
  ('encargado', 'pedidos.ver', true),
  ('encargado', 'pedidos.gestionar', true),
  ('encargado', 'pagos.registrar', true),
  ('encargado', 'pagos.anular', false),
  ('encargado', 'facturas.registrar', true),
  ('encargado', 'facturas.anular', false),
  ('encargado', 'catalogo.ver', true),
  ('encargado', 'catalogo.editar', true),
  ('encargado', 'opciones.disponibilidad', true),
  ('encargado', 'negocio.editar', false),
  ('encargado', 'inventario.ver', true),
  ('encargado', 'inventario.mover', true),
  ('encargado', 'articulos.editar', false),
  ('encargado', 'recetas.ver', true),
  ('encargado', 'recetas.editar', false),
  ('encargado', 'compras.registrar', true),
  ('encargado', 'compras.importar', true),
  ('encargado', 'proveedores.editar', true),
  ('encargado', 'produccion.registrar', true);

-- Bitácora de cambios del panel (3.3). SIN datos personales de compradores.
CREATE TABLE bitacora (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id bigint REFERENCES usuarios (id),
  accion     text NOT NULL CHECK (char_length(accion) BETWEEN 1 AND 60),
  entidad    text CHECK (char_length(entidad) <= 60),
  entidad_id text CHECK (char_length(entidad_id) <= 60),
  detalle    jsonb,
  creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bitacora_creado_idx ON bitacora (creado_en DESC);
CREATE INDEX bitacora_usuario_idx ON bitacora (usuario_id);

-- Límite de intentos (versión 2 del diseño): la clave es un resumen con sal (la IP nunca se guarda).
CREATE TABLE limites (
  clave_hash text NOT NULL CHECK (char_length(clave_hash) BETWEEN 16 AND 128),
  ventana    timestamptz NOT NULL,
  cuenta     integer NOT NULL DEFAULT 0 CHECK (cuenta >= 0),
  PRIMARY KEY (clave_hash, ventana)
);
CREATE INDEX limites_ventana_idx ON limites (ventana);
