-- Pulso Joven · Pagos con Apple Pay desde la app Atajos del iPhone
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- 1) pj_codigos_atajo: un código personal por persona, para que el atajo pueda apuntar pagos sin iniciar sesión.
-- 2) pj_apuntar_pago(codigo, importe, comercio): lo llama el atajo. Solo apunta un gasto; no devuelve ni deja leer nada.
--    Los pagos entran con la categoría «🔧 Otros» y la cuenta «apple_pay»; la app los clasifica al abrirse.

create table if not exists public.pj_codigos_atajo (
  user_id uuid primary key references auth.users (id) on delete cascade,
  codigo uuid not null unique default gen_random_uuid(),
  creado timestamptz not null default now()
);

alter table public.pj_codigos_atajo enable row level security;
revoke all on table public.pj_codigos_atajo from anon; -- sin sesión no hace falta (ver sql/2026-11-seguridad.sql)

drop policy if exists "pj_codigos_atajo: ver el propio" on public.pj_codigos_atajo;
drop policy if exists "pj_codigos_atajo: crear el propio" on public.pj_codigos_atajo;
drop policy if exists "pj_codigos_atajo: cambiar el propio" on public.pj_codigos_atajo;
create policy "pj_codigos_atajo: ver el propio" on public.pj_codigos_atajo for select using (auth.uid() = user_id);
create policy "pj_codigos_atajo: crear el propio" on public.pj_codigos_atajo for insert with check (auth.uid() = user_id);
create policy "pj_codigos_atajo: cambiar el propio" on public.pj_codigos_atajo for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.pj_apuntar_pago(codigo uuid, importe text, comercio text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  persona uuid;
  limpio text;
  cantidad numeric;
begin
  select c.user_id into persona from public.pj_codigos_atajo c where c.codigo = pj_apuntar_pago.codigo;
  if persona is null then
    raise exception 'Código no válido' using errcode = '28000';
  end if;

  -- Acepta «12,50 €», «€12.50», «1.234,56 €» o «-3,20»
  limpio := regexp_replace(coalesce(importe, ''), '[^0-9,.]', '', 'g');
  if limpio ~ ',[0-9]{1,2}$' then
    limpio := replace(replace(limpio, '.', ''), ',', '.');
  else
    limpio := replace(limpio, ',', '');
  end if;
  if limpio !~ '^[0-9]+(\.[0-9]+)?$' then
    raise exception 'Importe no válido: %', importe using errcode = '22023';
  end if;
  cantidad := round(limpio::numeric, 2);
  if cantidad <= 0 or cantidad > 10000 then
    raise exception 'Importe fuera de rango: %', importe using errcode = '22023';
  end if;

  insert into public.pj_transacciones (user_id, fecha, descripcion, importe, tipo, categoria, medio, cuenta)
  values (persona, (now() at time zone 'Europe/Madrid')::date,
          left(coalesce(nullif(trim(comercio), ''), 'Pago con Apple Pay'), 120),
          cantidad, 'gasto', '🔧 Otros', 'tarjeta', 'apple_pay');

  return 'Apuntado en Pulso Joven: ' || replace(cantidad::text, '.', ',') || ' €';
end;
$$;

revoke all on function public.pj_apuntar_pago(uuid, text, text) from public;
grant execute on function public.pj_apuntar_pago(uuid, text, text) to anon, authenticated;
