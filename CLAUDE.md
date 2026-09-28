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
- Se puede reanudar desde el panel hasta el **22/6/2027**; después solo se pueden descargar las copias de seguridad.
- Código: HTML estático (`index.html` = login, `app.html` = app, `informe.html`) con supabase-js y la clave pública `sb_publishable_…`. Se despliega con GitHub Pages desde `main`.

## Pendiente de definir

- [ ] Nombre de marca
- [ ] Pestañas definitivas (repensarlas en profundidad)
- [ ] Si comparte base de código con Pulso adulto o es independiente
- [ ] Modelo de precio exacto
- [ ] Stack del frontend

## Convenciones

- Commits en español y con formato convencional: `feat:`, `fix:`, `chore:`
- Variables de entorno en `.env` (nunca commitear)
