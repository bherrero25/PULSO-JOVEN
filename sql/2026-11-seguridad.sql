-- Pulso Joven · Quitar a las visitas sin sesión (rol «anon») el acceso a las tablas de Pulso Joven
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- La app siempre trabaja con la sesión iniciada (rol «authenticated»), así que «anon» no necesita ver estas tablas.
-- RLS ya impedía que leyera nada, pero así ni siquiera puede ver que existen (aviso «Public Can See Object in GraphQL
-- Schema» del Security Advisor). No cambia nada en la app: el atajo de Apple Pay sigue funcionando porque su función
-- (pj_apuntar_pago) se ejecuta con permisos propios. Solo toca las tablas de Pulso Joven (las que empiezan por pj_).

do $$
declare o record;
begin
  for o in select tablename as nombre from pg_tables where schemaname = 'public' and tablename like 'pj\_%' loop
    execute format('revoke all on table public.%I from anon', o.nombre);
  end loop;
  for o in select sequencename as nombre from pg_sequences where schemaname = 'public' and sequencename like 'pj\_%' loop
    execute format('revoke all on sequence public.%I from anon', o.nombre);
  end loop;
end $$;

-- Comprobación: debe salir «no» en todas las filas de la columna anon y «sí» en la de authenticated
select tablename as tabla,
       case when has_table_privilege('anon', format('public.%I', tablename), 'select') then 'sí' else 'no' end as anon,
       case when has_table_privilege('authenticated', format('public.%I', tablename), 'select') then 'sí' else 'no' end as authenticated
from pg_tables where schemaname = 'public' and tablename like 'pj\_%' order by 1;
