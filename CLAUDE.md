# Pulso Joven — Contexto del Proyecto

## ¿Qué es?

App de finanzas personales para jóvenes de 18 a 28 años, sencilla y visual. Es una línea de producto de **Pulso** (la app de finanzas para adultos, en `~/Documents/Pulso`). Estado: **prácticamente terminada**, se pausó por falta de uso y se retoma en septiembre de 2026 para uso familiar (uso previsto bajo). Código en GitHub (`bherrero25/PULSO-JOVEN`), publicado en GitHub Pages: https://bherrero25.github.io/PULSO-JOVEN/

> Este proyecto es independiente de **Casquito** (`~/Proyectos/CASQUITO`) y de **SportMatch**. No mezclar código, claves ni bases de datos.

## Perfil de usuaria/o

- 20-25 años, estudiante o con su primer empleo
- Preguntas clave: "¿llego a fin de mes?" y "¿cuándo puedo irme de viaje?"
- Hace todo desde el móvil y espera un diseño moderno y rápido
- Puede tener sus primeras inversiones (fondos indexados)

## Pestañas previstas

- **Inicio**: semáforo del mes, saldo actual y próxima meta de ahorro
- **Gastos e ingresos**: categorías visuales con emoji, sencillo
- **Presupuesto**: límite por categoría (ocio, comida, transporte...)
- **Viajes**: meta de ahorro con cuenta atrás y barra de progreso
- **Metas**: ahorro para coche, piso, gadget, experiencias...
- **Inversiones**: opcional, para quien empieza con fondos indexados

## Lo que NO tendría

Seguros, leasing, bonus anual, hipoteca, hijos ni patrimonio complejo.

## Diferencias con Pulso adulto

- Diseño distinto: más colorido, pensado primero para el móvil y moderno
- Precio más bajo o freemium: 3 €/mes, o gratis con límite de transacciones
- Posiblemente con otra marca (no necesariamente "Pulso Juvenil")

## Infraestructura

- **Supabase**: proyecto "Pulso Joven", transferido el 28/9/2026 a la organización **Sportmatchapp.es** (plan Pro, +10 $/mes) desde una organización Free propia donde estaba pausado.
- `project-ref`: `tqjukdleqgbpseaipfel` (en el panel el proyecto se llama "Pulso", no confundir con la organización Pulso de la app adulta). URL: `https://tqjukdleqgbpseaipfel.supabase.co`
- Reactivado el 28/9/2026. Tablas: `pj_transacciones`, `pj_metas`, `pj_presupuestos`, `pj_reglas_categoria`.
- Código: HTML estático (`index.html` = login, `app.html` = app, `informe.html`) con supabase-js y la clave pública `sb_publishable_…`. Se despliega con GitHub Pages desde `main`.

## Funcionamiento clave (sep. 2026)

- Importación del Excel de Bankinter (`importarCuenta`): ignora el bloque de "movimientos pendientes" del principio.
- Categorías automáticas en `categoriaAutomatica` + reglas aprendidas por usuario en `pj_reglas_categoria` (clave normalizada con `claveConcepto`, sin la fecha final de Bankinter).
- Familia: `💰 Mensualidad` (ingreso) y `↩️ Reenviado` (gasto que no es gasto) quedan fuera de ingresos/gastos generales y se muestran aparte; lo de los últimos 3 días del mes cuenta para el siguiente (`mesEfectivo`). Las reglas con nombres reales viven solo en la base de datos, nunca en el código (repo público).
- Los extractos reales van en `datos/` (ignorado por git).
- Supabase devuelve como máximo 1.000 filas por consulta: las lecturas de listas usan `leerTodas()` (páginas de 1.000, con orden estable), también en `informe.html`.
- Presupuestos: cada límite vale desde el mes en que se guarda hasta que se cambie (`getPresupuestos` coge el más reciente de cada categoría).
- Toda llamada a Supabase comprueba `error` y avisa con `avisarError()`; nada debe fallar en silencio.

## App nueva (`nueva/`, nov. 2026)

- Rediseño «Tinta y lima» según el croquis, publicado aparte en `…/PULSO-JOVEN/nueva/` mientras `app.html` sigue en uso. Misma base de datos y mismo formato de datos (categorías con emoji, `↩️ Reenviado` = «dinero de paso»).
- Sin compilación: módulos ES en `nueva/js/` → `logica.js` (cálculos puros), `datos.js` (Supabase y modo demo), `importar.js` (extractos), `pantallas/*.js` (una por pantalla) y `app.js` (estado, rutas `#/…` y acciones con `data-accion`, `data-entrada`, `data-cambio`). Modo demo con `?demo`.
- «Tu dinero»: `sql/2026-11-cuentas.sql` crea `pj_cuentas` (saldos por cuenta, aparte de ingresos y gastos). Las de banco (`clave` = 'bankinter'…) toman el saldo de la columna Saldo del extracto al importar; las de efectivo o ahorro se apuntan a mano. Si la tabla no existe, la app funciona sin esa tarjeta. La cifra grande de Inicio es el «Balance mensual» (ingresado − gastado del mes), no el saldo.
- Retenidos: `sql/2026-11-retenidos.sql` añade `pj_transacciones.pendiente`. Al importar, el bloque de «movimientos pendientes» de Bankinter entra con `pendiente = true` (cuenta ya en gastos/ingresos). En importaciones posteriores `conciliarRetenidos` convierte en definitivo el retenido con mismo importe y fecha 0–7 días después (conserva la categoría), no repite los que siguen retenidos y borra los que ya no aparecen. «Tu dinero» resta lo retenido al saldo del banco. Sin la columna, la app ignora los retenidos como antes.
- Bizum = forma de pago, no categoría: «📱 Bizum enviado/recibido» (lo que pone `categoriaAutomatica`) cuentan como «por revisar» y se reclasifican en categorías reales; hay categorías de ingreso Devoluciones, Regalos y Ventas.
- Atajo de Apple Pay: `sql/2026-11-atajo-apple-pay.sql` crea `pj_codigos_atajo` y la función `pj_apuntar_pago(codigo, importe, comercio)`, que el atajo de iPhone llama por REST. Los pagos entran con `cuenta = 'apple_pay'` y en «🔧 Otros»; la app los clasifica al abrirse y, al importar un extracto, descarta los que coinciden en importe con fecha 0–4 días después.

## Pendiente antes de venderla

- [ ] Revisar a fondo RLS (cada usuario solo ve lo suyo)
- [ ] Probar importación con otros bancos (solo probado Bankinter)
- [ ] Cobro del plan Pro (la portada lo anuncia, no existe)
- [ ] Política de privacidad y condiciones (RGPD)
- [ ] Nombre propio (ahora "Pulso", igual que la app adulta)
- [ ] Repo privado + despliegue en Vercel

## Pendiente de definir

- [ ] Nombre de marca
- [ ] Pestañas definitivas (repensarlas en profundidad)
- [ ] Si comparte base de código con Pulso adulto o es independiente
- [ ] Modelo de precio exacto
- [ ] Stack del frontend

## Convenciones

- Commits en español y con formato convencional: `feat:`, `fix:`, `chore:`
- Variables de entorno en `.env` (nunca commitear)
