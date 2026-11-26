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
- Icono y modo app: `nueva/manifest.webmanifest` (standalone) e iconos en `nueva/iconos/` (marca: fondo tinta, punto lima y dos ondas). En iPhone el icono se guarda al «Añadir a pantalla de inicio»: si cambia, hay que borrar el acceso y volver a añadirlo.
- «Tu dinero»: `sql/2026-11-cuentas.sql` crea `pj_cuentas` (saldos por cuenta, aparte de ingresos y gastos). Las de banco (`clave` = 'bankinter'…) toman el saldo de la columna Saldo del extracto al importar; las de efectivo o ahorro se apuntan a mano. Si la tabla no existe, la app funciona sin esa tarjeta. La cifra grande de Inicio es el «Balance mensual» (ingresado − gastado del mes), no el saldo.
- Retenidos: `sql/2026-11-retenidos.sql` añade `pj_transacciones.pendiente`. Al importar, el bloque de «movimientos pendientes» de Bankinter entra con `pendiente = true` (cuenta ya en gastos/ingresos). En importaciones posteriores `conciliarRetenidos` convierte en definitivo el retenido con mismo importe y fecha 0–7 días después (conserva la categoría), no repite los que siguen retenidos y borra los que ya no aparecen. «Tu dinero» resta lo retenido al saldo del banco. Sin la columna, la app ignora los retenidos como antes.
- «Tu dinero» y lo apuntado después del extracto: `apuntadoSinExtracto` suma (ingresos) o resta (gastos) en la cuenta de banco con el extracto más reciente lo que sigue como `cuenta = 'manual'` o `'apple_pay'` (sin juntar con el banco todavía), desde 7 días antes de la fecha del saldo. Al tocar la cuenta de banco, la hoja muestra el desglose (saldo del extracto, retenidos y lo apuntado después) y avisa si algo apuntado parece repetido con un movimiento del banco ya guardado (`gemeloEnBanco`), con un botón para quitarlo. No cuentan el efectivo ni lo previsto. La fila del banco dice «+X € apuntado después».
- Dinero de paso (`↩️ Reenviado`, tipo 'ambos' en la app nueva): se puede marcar lo que llega, lo que sale o las dos cosas; nada de ello cuenta como ingreso ni gasto. `resumenMes` calcula `totalPaso = sale − llega` y lo resta de lo ingresado (si sale más, como el alquiler dentro de la mensualidad, resta; si llegó y aún no ha salido, suma hasta que salga). La regla de los 3 últimos días del mes vale para los dos sentidos. La app vieja solo entiende el de salida (un ingreso «Reenviado» lo cuenta como ingreso).
- Casilla «recordar» al cambiar la categoría: viene marcada solo al clasificar algo por revisar; al cambiar un movimiento que ya tenía categoría (p. ej. una transferencia de casa que esta vez es dinero de paso) solo cambia ese salvo que se marque («Cambiar también los otros N iguales y los próximos»).
- Bizum = forma de pago, no categoría: «📱 Bizum enviado/recibido» (lo que pone `categoriaAutomatica`) cuentan como «por revisar» y se reclasifican en categorías reales; hay categorías de ingreso Devoluciones, Regalos y Ventas.
- Coche compartido: categoría de ingreso `🚗 Coche compartido` (BlaBlaCar; `categoriaAutomatica` reconoce «blablacar»/«comuto» en ingresos, los pagos como pasajero siguen en Transporte). Cuenta como ingreso normal y, por `compensa: 'gasolina'`, el Resumen la descuenta en la fila de Gasolina («Recuperado… · te ha costado…»).
- Traspasos: categoría `🔄 Traspaso` («Traspaso entre tus cuentas», vale para ingreso y gasto): no cuenta como ingreso ni gasto del mes (`esTraspaso`). Al elegirla (a mano o al reclasificar) la app pregunta de qué cuenta manual de «Tu dinero» sale el dinero (ingreso → se le resta) o a cuál va (gasto → se le suma) y ajusta su saldo; al quitarle la categoría ofrece deshacerlo. No se guarda como regla. La app vieja (`app.html`) no la conoce y la sigue contando como ingreso/gasto.
- Apuntado a mano: lo que se apunta a mano se guarda con `cuenta = 'manual'` (salvo lo pagado en efectivo, `cuenta = 'efectivo'`; un traspaso en efectivo sí va como 'manual' porque sale en el banco). Al importar un extracto, `emparejarApuntados` lo junta con su movimiento del banco (mismo tipo e importe, fecha del banco de 3 días antes a 7 después): el movimiento guardado toma fecha, concepto, cuenta y `pendiente` del banco y conserva categoría y forma de pago, así que la siguiente importación ya lo reconoce por `claveMovimiento`. También propone, sin marcarlos, «posibles repetidos»: movimientos de ese banco dentro de las fechas del extracto que no aparecen en él (lo apuntado a mano antes de existir la marca). En la vista previa cada pareja tiene una casilla para separarla.
- Movimientos fijos: `sql/2026-11-fijos.sql` crea `pj_fijos` (nombre, tipo, categoría, importe, día del mes, forma de pago, `ultimo`). Cada usuario configura los suyos en Añadir → Automático. Al abrir la app, `generarPrevistos` crea el día que toca un movimiento con `cuenta = 'previsto'` (etiqueta «Previsto», cuenta como uno más) y guarda en `ultimo` la fecha, para no repetirlo; uno nuevo empieza a contar desde la siguiente vez. Al importar, `emparejarApuntados` lo junta con el real con más margen: fecha ±10 días e importe hasta un 50 % distinto; seguro si coincide el importe, la categoría (±20 %) o la categoría del banco es genérica (±10 % y ±5 días); el previsto toma el importe del banco. Sin la tabla, la app funciona sin fijos. Al emparejar se ordena primero por importe exacto, luego lo seguro y luego por puntos, para que un apuntado a mano no pierda su movimiento frente a un previsto de importe parecido.
- Apuntar rápido: botones Gasto / Ingreso / Bizum / Transferencia en Inicio, que abren `#/anadir?tipo=…&medio=…` (también los accesos `shortcuts` del manifiesto, en Android). En el formulario la forma de pago son botones; con Bizum o transferencia los textos dicen Enviado/Recibido y la categoría por defecto es «Lo decido luego» (queda por revisar: Bizum genérico u Otros).
- Varias cuentas (sin cambios en Supabase): cada cuenta de banco se identifica por `clave = banco·últimas4` (p. ej. 'bankinter·1234'); las antiguas (`clave = 'bankinter'`) siguen valiendo. `leerCuentaArchivo` (importar.js) busca el IBAN (también con asteriscos) o la cuenta de 20 cifras encima de los movimientos. `cuentaParaExtracto` decide la cuenta: la que ya tiene ese número; la antigua sin número si sus movimientos coinciden con el archivo (la adopta: `renombrarCuenta` cambia la clave en la cuenta y en sus movimientos al confirmar); una nueva si el número es otro (se le pone nombre en la vista previa); sin número, la única del banco o se pregunta. `prepararImportacion` (anadir.js) recalcula todo para la cuenta elegida. `detectarTraspasos` empareja salidas y entradas del mismo importe entre cuentas propias (±2 días, sin tarjeta ni retenidos) y las marca como `🔄 Traspaso` al confirmar (las dos mitades). Con 2+ cuentas de banco: «Cuenta» al apuntar a mano (`cuenta = 'manual:clave'`; `esManual`/`destinoManual`), nombre de la cuenta en cada movimiento, filtro por cuenta en Movimientos y «Ver sus movimientos» en la hoja de la cuenta. Lo apuntado sin cuenta y Apple Pay van a la cuenta principal (`cuentaPrincipal`).
- Cuenta principal: `sql/2026-11-cuenta-principal.sql` añade `pj_cuentas.principal` (como mucho una por persona, índice único parcial). Con 2+ cuentas de banco, la hoja de cada una tiene «Hacerla mi cuenta principal» (`marcarPrincipal`: primero quita la marca a las demás) y la fila de «Tu dinero» dice «principal». Es la que viene marcada al apuntar a mano y la que recibe lo apuntado sin cuenta y Apple Pay. Si nadie la ha elegido, la más antigua (`creada`), que no cambia al subir el extracto de otra. Sin la columna (`sePuedeElegirPrincipal`), no se ofrece elegirla.
- Cuenta de banco añadida a mano: en «Añadir una cuenta», con tipo Banco se piden el banco (`BANCOS`, con la clave que pone la app al leer su extracto; 'generico' para otros) y las 4 últimas cifras; se guarda con `clave = banco·cifras` y saldo apuntado. `cuentaParaExtracto` la reconoce por el número aunque el formato del archivo sea de otro banco (`numeroDeClave`); un archivo sin número, o con otro número, pregunta si es una de las cuentas aún sin extracto (y si se elige, adopta el número del archivo).
- Nombres limpios: `pj_transacciones.descripcion` guarda el concepto del banco tal cual (sirve para no duplicar con `claveMovimiento` y para las reglas); en pantalla se ve `nombreLimpio(t)` (vía `conceptoVisible`): sin prefijos tipo «COMPRA TARJ.», números de tarjeta, fechas ni referencias; marca conocida si se reconoce (`MARCAS`); «Transferencia de/a …», «Bizum de/a …»; mayúsculas y minúsculas con tildes frecuentes (`TILDES`). Lo apuntado a mano, lo previsto y el efectivo se ven tal cual. Al abrir un movimiento se ve el «Concepto original»; el buscador busca en los dos. Forma de pago: `medioAutomatico(descripcion, tipo)` distingue tarjeta, recibo, transferencia, Bizum, Apple Pay y efectivo (un gasto sin pistas = tarjeta); `medioDe(t)` corrige al enseñarlo lo importado antes como «transferencia».
- Atajo de Apple Pay: `sql/2026-11-atajo-apple-pay.sql` crea `pj_codigos_atajo` y la función `pj_apuntar_pago(codigo, importe, comercio)`, que el atajo de iPhone llama por REST. Los pagos entran con `cuenta = 'apple_pay'` y en «🔧 Otros»; la app los clasifica al abrirse. Al importar un extracto se juntan con su movimiento del banco como lo apuntado a mano (`emparejarApuntados`): toman fecha, concepto, cuenta y `pendiente` (si en el banco aún está retenido, pasan a ser un retenido y se restan en «Tu dinero») y quedan con `medio = 'apple_pay'` para seguir diciendo «Apple Pay» (también al pasar de retenido a cobrado).

- Primeros pasos (`pantallas/primeros.js`): con la cuenta vacía (ningún movimiento salvo los previstos), Inicio enseña una bienvenida con los pasos en lugar del balance a cero y quita las tarjetas vacías; después, una tarjeta «Primeros pasos · N de M» con lo que falta. Pasos: traer movimientos (extracto o a mano), «Cuánto tienes» (cuentas), movimientos fijos, un presupuesto y una meta. Cada uno se marca solo al hacerlo (se mira en los datos, no se guarda nada); los de cuentas y fijos no salen si falta su tabla. «Ocultar» se guarda en `localStorage` por usuario (solo ese dispositivo). Nunca en la demo ni con todo hecho. `#/anadir?pestana=extracto` abre directamente la pestaña del extracto.

## Seguridad

- El concepto de un Bizum o una transferencia lo escribe quien lo envía y llega en el extracto: todo dato que se pinte en HTML va con `esc()` (app nueva, `app.html` e `informe.html`), y `toast`/`mostrarAviso` usan `textContent`. Las tres páginas comparten origen (`bherrero25.github.io`) y sesión de Supabase en `localStorage`, así que un fallo en cualquiera expone la sesión de las otras. `pruebas/prueba_seguridad.py` lo comprueba.
- `sql/revision-seguridad.sql` (solo lee): una fila por tabla/función/vista del esquema público con ✅/⚠️/❌ (RLS activado, políticas con `auth.uid()`, nada abierto con `true`, funciones con permisos especiales con `search_path` fijo).
- En el repositorio público solo está la clave publicable (`sb_publishable_…`), nunca la de servicio.
- `sql/2026-11-seguridad.sql`: quita a `anon` (sin sesión) todo permiso sobre las tablas y secuencias `pj_…` (la app siempre usa `authenticated`; el atajo funciona porque `pj_apuntar_pago` es `security definer`). Las tablas nuevas deben incluir `revoke all … from anon`. Revisión de nov. 2026: todas las tablas `pj_` con RLS y políticas por `auth.uid()`, Security Advisor sin errores.
- El proyecto de Supabase lo comparte otra app (tablas `diet_plan_meals`, `exercise_logs`, `food_logs`, `profiles` y la función `handle_new_user`, con aviso de `search_path`): comparten usuarios (auth). No tocar sus objetos desde aquí. `pj_categorias` existe pero la app no la usa.

## Pruebas

- `pruebas/` (ver `pruebas/LEEME.md`): `python3 pruebas/ejecutar.py` ejecuta todas (cálculos con node y navegador con Playwright, ~40 s; `--sql` añade los textos SQL en un PostgreSQL local). Nunca tocan la base real: modo demo o Supabase simulado (`comun.Supabase`). La primera vez: `cd pruebas && npm install`.
- Antes de publicar un cambio en la app, ejecutarlas; si algo sale ✗, no se publica. Al añadir una función, añadir sus comprobaciones (invariantes, no cifras de la demo, que cambian con la fecha).

## Pendiente antes de venderla

- [ ] Atajo de Apple Pay compartible por enlace de iCloud (a medias, nov. 2026): un atajo suelto no ve los campos de la transacción (no hay tipo «Transaction»). Falta probar con un pago real si la automatización de Wallet, eligiendo un atajo ya instalado, le pasa importe y comercio como texto; si no, plan B: en la automatización, una acción «Text» con Amount y Merchant y «Run Shortcut». El atajo compartido llevará dirección, apikey y una pregunta de importación para el código.
- [x] Revisar a fondo RLS (cada usuario solo ve lo suyo) — nov. 2026, ver «Seguridad»
- [ ] Proyecto de Supabase propio para Pulso Joven (ahora comparte base y usuarios con otra app de dieta/ejercicio)
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

- La app es para el público: cada solución debe servir a cualquier usuario y cualquier banco. Nada personalizado para una persona concreta (p. ej. su mensualidad) ni pensado solo para Bankinter, aunque sea el único banco probado.
- Commits en español y con formato convencional: `feat:`, `fix:`, `chore:`
- Variables de entorno en `.env` (nunca commitear)
