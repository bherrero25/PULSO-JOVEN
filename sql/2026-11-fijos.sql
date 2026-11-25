-- Pulso Joven · Movimientos fijos: lo que llega o sale cada mes más o menos igual (mensualidad, nómina, beca, alquiler…)
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- pj_fijos: una fila por movimiento fijo de cada persona. La app crea cada mes, el día indicado, un movimiento «previsto»
-- (pj_transacciones.cuenta = 'previsto') y apunta en «ultimo» la fecha del último que ha creado, para no repetirlo.
-- Al importar el extracto, el previsto se junta con el movimiento real del banco y toma su importe.

create table if not exists public.pj_fijos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (length(nombre) between 1 and 60),
  tipo text not null default 'ingreso' check (tipo in ('ingreso', 'gasto')),
  categoria text not null,
  importe numeric not null check (importe > 0),
  dia smallint not null check (dia between 1 and 31),
  medio text not null default 'transferencia',
  activo boolean not null default true,
  ultimo date,
  creado timestamptz not null default now()
);

alter table public.pj_fijos enable row level security;

drop policy if exists "pj_fijos: ver los propios" on public.pj_fijos;
drop policy if exists "pj_fijos: crear los propios" on public.pj_fijos;
drop policy if exists "pj_fijos: cambiar los propios" on public.pj_fijos;
drop policy if exists "pj_fijos: borrar los propios" on public.pj_fijos;
create policy "pj_fijos: ver los propios" on public.pj_fijos for select using (auth.uid() = user_id);
create policy "pj_fijos: crear los propios" on public.pj_fijos for insert with check (auth.uid() = user_id);
create policy "pj_fijos: cambiar los propios" on public.pj_fijos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pj_fijos: borrar los propios" on public.pj_fijos for delete using (auth.uid() = user_id);
