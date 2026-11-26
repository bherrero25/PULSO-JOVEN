-- Pulso Joven · Revisión de seguridad. SOLO LEE: no cambia nada.
-- Se ejecuta en Supabase (SQL Editor) y devuelve una fila por tabla, función y vista del esquema público, con el resultado.
-- Lo que hay que ver: ✅ en todas las tablas («Cada persona solo lo suyo»). Cualquier ❌ o ⚠️ hay que revisarlo.

with politicas as (
  select tablename, cmd, coalesce(qual, '') || ' ' || coalesce(with_check, '') as condicion, roles
  from pg_policies where schemaname = 'public'
),
tablas as (
  select c.relname as nombre, c.relrowsecurity as rls,
         (select count(*) from politicas p where p.tablename = c.relname) as num,
         (select string_agg(distinct p.cmd, ', ') from politicas p where p.tablename = c.relname) as acciones,
         (select bool_and(p.condicion ~ 'auth\.uid\(\)') from politicas p where p.tablename = c.relname) as con_persona,
         (select bool_or(p.condicion ~ '^\s*true\s' or p.condicion ~ '\strue\s*$') from politicas p where p.tablename = c.relname) as abierta,
         has_table_privilege('anon', c.oid, 'select') as anon_lee
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
)
select 'tabla' as tipo, nombre,
  case when not rls then '❌ RLS desactivado: cualquiera con la clave pública podría leerla y cambiarla'
       when num = 0 then '⚠️ RLS activado pero sin políticas: la app no podrá usarla'
       when abierta then '❌ Tiene una política abierta a todos (true)'
       when not con_persona then '⚠️ Alguna política no comprueba quién es la persona (auth.uid)'
       else '✅ Cada persona solo lo suyo' end as resultado,
  coalesce(acciones, '—') || case when anon_lee and rls then ' · (anon tiene permiso, pero RLS lo frena)' else '' end as detalle
from tablas
union all
select 'función', p.proname,
  case when not p.prosecdef then '✅ Se ejecuta con los permisos de quien la llama'
       when not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%') then '⚠️ Con permisos especiales y sin search_path fijo'
       else '✅ Con permisos especiales y search_path fijo' end,
  case when has_function_privilege('anon', p.oid, 'execute') then 'anon puede llamarla' else 'solo con sesión' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
union all
select 'vista', c.relname, '⚠️ Revisar: una vista puede saltarse RLS si no es «security_invoker»', ''
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm')
order by 1 desc, 2;
