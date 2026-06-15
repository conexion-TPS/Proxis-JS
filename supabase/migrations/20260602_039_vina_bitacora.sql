-- ⚠️ SUPERSEDED 2026-06-15: el estado real de Viña difiere de esta migración (RLS estuvo abierto hasta el 06-15; vina_credentials tiene columnas empresa/rol; faltan tablas nodos/activaciones_nodo/ingresos creadas en Fase 0.1). Ver DISENO_CONSOLIDACION.md para el estado real.
-- Consorcio Viña — bitácora aislada (Opción B: proyecto propio)
-- Aplicar en el proyecto **sgu-vina-prospección** (NO en proxis-dev).
-- Proyecto Supabase dedicado: el aislamiento de Zurich es a nivel de proyecto entero.
-- Acceso solo desde las API routes con service-role => RLS cerrado (sin políticas anon).
-- El seed de vina_credentials (hashes) se aplica aparte y no se versiona aquí.
-- Idempotente.

-- ── Bitácora: semanas, contactos, metas ──
-- (la columna `empresa` se conserva con default 'vina' para no cambiar la lógica del código;
--  en este proyecto dedicado siempre vale 'vina').

create table if not exists reportes (
  id            uuid primary key default gen_random_uuid(),
  asesor        text not null,
  empresa       text not null default 'vina',
  semana_inicio date not null,
  semana_num    int,
  confirmado    boolean not null default false,
  sin_actividad boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (asesor, semana_inicio)
);
create index if not exists idx_reportes_asesor on reportes(asesor);

create table if not exists contactos (
  id            uuid primary key default gen_random_uuid(),
  reporte_id    uuid not null references reportes(id) on delete cascade,
  asesor        text,
  empresa       text not null default 'vina',
  nombre        text not null,
  vinculo       text,
  llamo         boolean not null default false,
  reunion       boolean not null default false,
  prospectos    int not null default 0,
  tipo_contacto text default 'nuevo',
  created_at    timestamptz not null default now()
);
create index if not exists idx_contactos_reporte on contactos(reporte_id);

create table if not exists metas (
  id                    uuid primary key default gen_random_uuid(),
  asesor                text not null unique,
  empresa               text not null default 'vina',
  meta_contactos_semana int,
  meta_prospectos_mes   int,
  meta_ventas_mes       int,
  meta_ingresos         bigint,
  updated_at            timestamptz not null default now()
);

-- ── Credenciales de login (bcrypt + JWT en /api/vina/login) ──
create table if not exists vina_credentials (
  id            uuid primary key default gen_random_uuid(),
  asesor        text not null unique,
  email         text not null unique,
  password_hash text not null,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_vina_cred_email on vina_credentials(email);

-- ── RLS cerrado en todo: solo service-role (las API routes) puede leer/escribir ──
alter table reportes         enable row level security;
alter table contactos        enable row level security;
alter table metas            enable row level security;
alter table vina_credentials enable row level security;
-- Sin políticas para anon/authenticated => acceso denegado salvo service-role.
