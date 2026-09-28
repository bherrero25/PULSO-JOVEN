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
