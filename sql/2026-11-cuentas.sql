-- Pulso Joven · «Tu dinero»: cuánto tienes en cada sitio (banco, efectivo, ahorro), aparte de los ingresos y gastos del mes
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- pj_cuentas: una fila por cuenta. Las de banco (clave = 'bankinter', 'bbva'…) actualizan su saldo al importar el extracto;
-- las de efectivo o ahorro se apuntan y cambian a mano. El saldo no cuenta como ingreso de ningún mes.

create table if not exists public.pj_cuentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null default 'efectivo' check (tipo in ('banco', 'efectivo', 'ahorro', 'inversion')),
  clave text,
  saldo numeric not null default 0,
  fecha_saldo date not null default current_date,
  creada timestamptz not null default now(),
  unique (user_id, clave)
);

alter table public.pj_cuentas enable row level security;

drop policy if exists "pj_cuentas: ver las propias" on public.pj_cuentas;
drop policy if exists "pj_cuentas: crear las propias" on public.pj_cuentas;
drop policy if exists "pj_cuentas: cambiar las propias" on public.pj_cuentas;
drop policy if exists "pj_cuentas: borrar las propias" on public.pj_cuentas;
create policy "pj_cuentas: ver las propias" on public.pj_cuentas for select using (auth.uid() = user_id);
create policy "pj_cuentas: crear las propias" on public.pj_cuentas for insert with check (auth.uid() = user_id);
create policy "pj_cuentas: cambiar las propias" on public.pj_cuentas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pj_cuentas: borrar las propias" on public.pj_cuentas for delete using (auth.uid() = user_id);
