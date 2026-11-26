-- Pulso Joven · Para qué es cada dinero de paso
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- pj_transacciones.paso: en lo marcado como «Dinero de paso», para qué es («Ordenador», «Dentista y luz»…). Lo que llega
-- y lo que sale para lo mismo se compensan; lo que llega y aún no ha salido queda en espera. Lo que sale sin decir para
-- qué es de tu dinero (como la parte del alquiler que va dentro de la mensualidad) y resta de lo que te entra.
-- Sin esta columna la app funciona, pero sin poder decir para qué es cada uno.

alter table public.pj_transacciones add column if not exists paso text check (paso is null or length(paso) between 1 and 60);
