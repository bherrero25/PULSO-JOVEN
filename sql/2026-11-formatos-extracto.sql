-- Pulso Joven · Formatos de extracto: qué columna es cada cosa en el archivo de un banco que la app no reconoce sola
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- pj_formatos_extracto: una fila por formato de archivo de cada persona. Se guarda cuando alguien elige las columnas en
-- «Añadir → Extracto» con «Recordar» marcado, para que la próxima vez no se lo pregunte (en cualquier dispositivo).
-- «firma» son los títulos de las columnas del archivo (no lleva datos de movimientos); «formato» dice qué columna es la
-- fecha, el concepto, el importe (o cargo y abono) y el saldo. Sin esta tabla, la app lo recuerda solo en el dispositivo.

create table if not exists public.pj_formatos_extracto (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  firma text not null check (length(firma) between 1 and 2000),
  formato jsonb not null check (jsonb_typeof(formato) = 'object'),
  actualizado timestamptz not null default now(),
  unique (user_id, firma)
);

alter table public.pj_formatos_extracto enable row level security;
revoke all on table public.pj_formatos_extracto from anon; -- sin sesión no hace falta (ver sql/2026-11-seguridad.sql)

drop policy if exists "pj_formatos_extracto: ver los propios" on public.pj_formatos_extracto;
drop policy if exists "pj_formatos_extracto: crear los propios" on public.pj_formatos_extracto;
drop policy if exists "pj_formatos_extracto: cambiar los propios" on public.pj_formatos_extracto;
drop policy if exists "pj_formatos_extracto: borrar los propios" on public.pj_formatos_extracto;
create policy "pj_formatos_extracto: ver los propios" on public.pj_formatos_extracto for select using (auth.uid() = user_id);
create policy "pj_formatos_extracto: crear los propios" on public.pj_formatos_extracto for insert with check (auth.uid() = user_id);
create policy "pj_formatos_extracto: cambiar los propios" on public.pj_formatos_extracto for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pj_formatos_extracto: borrar los propios" on public.pj_formatos_extracto for delete using (auth.uid() = user_id);
