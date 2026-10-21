# AstroBitácora

Diario personal con el cielo de cada momento. Registras cómo te sentiste y qué pasó; la aplicación guarda junto a
cada entrada las posiciones astronómicas reales de ese instante y lugar, y te ayuda a explorar tus propios patrones
(«esta semana me sentí cansado: ¿dónde estaban los astros?»).

Es una **aplicación web instalable (PWA)**: se abre desde un enlace y se puede instalar en Windows, Mac, Android o
iPhone. Todo ocurre **en el dispositivo de cada persona**:

- Los cálculos astronómicos usan Swiss Ephemeris compilado a WebAssembly y funcionan sin conexión.
- Los registros se guardan en el propio navegador (IndexedDB). No hay servidor, cuentas ni base de datos central:
  nadie, ni quien publica la web, puede leer los diarios.
- Cada persona hace y restaura sus copias de seguridad (JSON) desde Configuración, también para pasar sus datos a
  otro dispositivo.

## Uso para desarrollo

Requisitos: Node.js 20+ (y Python 3.11+ solo para el motor de referencia).

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173 con recarga en caliente
npm test           # validación astronómica, horaria y de la bitácora (vitest)
npm run build      # sitio estático en frontend/dist
npm run preview    # sirve dist en http://localhost:4173
```

## Publicación en GitHub Pages

El flujo `.github/workflows/deploy.yml` se ejecuta con cada cambio en `main`:

1. instala dependencias y pasa todas las pruebas (web y motor Python de referencia);
2. compila con `BASE_PATH=/<repositorio>/` y enlaza el código fuente (`VITE_SOURCE_URL`);
3. publica `frontend/dist` en `https://<usuario>.github.io/<repositorio>/`.

Hay que activarlo una vez en el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Estructura

```
frontend/
  src/local/swe.ts          Carga de Swiss Ephemeris (WebAssembly)
  src/local/engine.ts       Posiciones, casas, ascendente, MC, ayanamsa, fase lunar
  src/local/time.ts         Hora local → UTC con reglas IANA (Intl) y zona por coordenadas
  src/local/db.ts           Almacenamiento IndexedDB
  src/local/service.ts      Bitácora: entradas, recálculo trazable, búsqueda, copias, geocodificación
  src/local/analysis.ts     Estadística, «explorar una experiencia», cielo de un periodo, tránsitos
  src/local/test/           Pruebas (vitest) + cartas de referencia exportadas del motor Python
  src/components, src/pages Interfaz (React + Tailwind); cartas en SVG
backend/                    Motor de referencia en Python (pyswisseph) y sus pruebas;
                            tools/export_reference.py genera las cartas con que se valida el motor web
```

## Decisiones técnicas

### Carta
Plantilla de referencia: carta **del Sur de la India** (cuadrícula 4×4, signos fijos con Piscis arriba a la izquierda,
centro libre, Lagna marcado con una diagonal), con la ficha Fecha / Hora / Lugar y Lagna / Chandralagna /
Suryalagna (valores tropical / sideral). También se ofrecen la carta del Norte de la India y la rueda occidental.

### Motor de efemérides
Swiss Ephemeris 2.10.03 (Astrodienst) con la teoría analítica de Moshier integrada (≈1″ en planetas, ≈3″ en la
Luna; años 1 a 2999). En la web se usa `@swisseph/browser`, la misma biblioteca C compilada a WebAssembly (425 KB).
Posiciones geocéntricas aparentes sobre la eclíptica verdadera de la fecha.

- Sideral = tropical − ayanamsa verdadero (con nutación). Las cúspides siderales son las tropicales menos el
  ayanamsa, igual que `swe_houses_ex` con `SEFLG_SIDEREAL`; en signo entero se recalculan desde el signo sideral del
  ascendente.
- La fracción iluminada de la Luna se obtiene del ángulo de fase (Meeus, ec. 48.2–48.3).
- Cada entrada guarda ambas cartas (tropical y sideral): cambiar de sistema nunca pierde información.

### Zonas horarias
Reglas IANA del navegador (`Intl`) con la zona deducida de las coordenadas sin conexión (`@photostructure/tz-lookup`).
Se detectan horas inexistentes y ambiguas en los cambios de horario; antes de 1970 se avisa y se permite un desfase
manual.

### Casos límite
Placidus y Koch no están definidos en latitudes circumpolares: se usa Porfirio y se avisa. El grado se trunca al segundo
de arco (nunca «30°»). El retrógrado aparente se distingue de la rotación retrógrada física.

## Validación

`npm test` (86 pruebas) comprueba:

- **Equivalencia con el motor Python**: 40 cartas (1900–2100, 10 lugares incluidos los polares, 7 sistemas de casas,
  4 ayanamsas, ambos zodiacos) coinciden en longitudes, latitudes, velocidades, casas, cúspides, ascendente, MC y
  ayanamsa con un error menor que 10⁻⁶ grados; 14 conversiones horarias coinciden con `zoneinfo`.
- **Referencias publicadas**: J. Meeus, *Astronomical Algorithms* (ej. 12.a, 25.b, 33.a, 47.a); equinoccio de 2024,
  luna nueva del eclipse del 8-abr-2024, conjunción Júpiter–Saturno de 2020, ingresos de Plutón, Neptuno, Saturno y
  Urano, Mercurio retrógrado en abril de 2024, luna llena del 23-abr-2024; ascendente y MC frente a la fórmula
  trigonométrica independiente.
- **Bitácora**: edición sin alterar las cartas, recálculo con historial, varias entradas por día, búsqueda, patrones y
  copia/restauración exacta.

`backend/` mantiene sus 44 pruebas de Python (`python -m pytest`), que también se ejecutan en GitHub.

## Mis patrones: criterios
- Promedios solo con n ≥ 5 por grupo; de 5 a 19 se marcan como orientativos.
- Una coincidencia debe repetirse al menos 2 veces y superar en 5 puntos porcentuales su frecuencia en el resto.
- Los rasgos presentes en ≥ 80 % de los registros (planetas lentos) se apartan como «fondo».
- Se avisa de que, al comparar muchas posiciones, algunas coincidencias aparecerán por azar.
- Todo es descriptivo: una coincidencia no demuestra causalidad.

## Privacidad
- Los registros no salen nunca del dispositivo. No hay analítica ni cookies.
- Lo único que sale a Internet es el texto de búsqueda de ciudades (OpenStreetMap Nominatim, máximo 1 petición por
  segundo); se puede desactivar e introducir coordenadas.
- La app pide al navegador almacenamiento persistente y recuerda hacer copias de seguridad: si se borran los datos del
  navegador, los registros se pierden.

## Licencia
**AGPL-3.0-or-later** (ver `LICENSE`), obligatoria porque Swiss Ephemeris se distribuye bajo AGPL. Al ofrecer la app
en la web, el código fuente debe estar disponible públicamente: la propia app enlaza al repositorio desde Configuración.

| Componente | Licencia |
|---|---|
| Swiss Ephemeris (`@swisseph/browser`, `pysweph`) | AGPL-3.0 (© Astrodienst AG) |
| @photostructure/tz-lookup | CC0-1.0 |
| idb | ISC |
| React, React Router, Recharts, jsPDF, Vite, Tailwind, Workbox | MIT |
| Cormorant Garamond, EB Garamond | SIL OFL 1.1 |
| Datos de lugares (Nominatim) | ODbL, © colaboradores de OpenStreetMap |
| Datos físicos de los planetas | NASA GSFC Planetary Fact Sheet (dominio público) |
