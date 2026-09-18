# Design

Sistema visual de las dos aplicaciones autenticadas: el portal de clientes
(`/portal`) y el panel de TQM (`/admin`). La web pública (`/`) va aparte y no lo
usa.

## Theme

**Claro, siempre.** No es una preferencia estética: las dos superficies se usan
de día, en un despacho o en la trastienda de una joyería, con luz de ventana.
Un panel oscuro ahí es peor de leer y además es el reflejo automático del sector
financiero, que es justo lo que no queremos parecer. No hay modo oscuro.

La metáfora es el **taller de precisión**: papel cálido, tinta fría, reglas
finas, cifras alineadas. Un banco de trabajo donde se mide, no una consola.

## Color

Dos estrategias, una por superficie, que es lo que significa «dos
personalidades»:

- **El panel: Restrained.** Neutros teñidos y un acento por debajo del 10% de la
  superficie. Es una herramienta de ocho horas: el color que no dice nada,
  cansa.
- **El portal: Committed.** El turquesa asume superficie de verdad —la barra
  superior y la banda de bienvenida— y el **ámbar**, que es su complementario en
  el círculo (213° ↔ 62°), enciende la cifra del día encima. Es la cara de
  cliente: tiene que verse desde el otro lado del mostrador y tiene que
  parecerse a una marca, no a un formulario.

En las dos, el resto del color es semántico y aparece solo cuando hay algo que
decir.

Todo en OKLCH. Ningún `#000` ni `#fff`: los neutros del papel van teñidos hacia
el ámbar y los de la tinta hacia el azul, y esa tensión cálido/frío es la que
hace que la pantalla no parezca gris de sistema.

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Papel | `--paper` | `oklch(0.974 0.005 85)` | Fondo de página |
| Superficie | `--surface` | `oklch(0.996 0.002 85)` | Paneles, filas, menús |
| Hundido | `--sunken` | `oklch(0.953 0.006 85)` | Cabeceras de tabla, pozos |
| Raíl | `--rail` | `oklch(0.945 0.005 240)` | Barra lateral y barras de herramientas (neutro más frío que el contenido) |
| Tinta | `--ink` | `oklch(0.24 0.015 240)` | Texto principal |
| Tinta 2 | `--ink-2` | `oklch(0.44 0.012 240)` | Texto secundario, prosa |
| Tinta 3 | `--ink-3` | `oklch(0.53 0.010 240)` | Etiquetas, unidades (AA sobre papel) |
| Tinta 4 | `--ink-4` | `oklch(0.66 0.008 240)` | Marcas de agua, deshabilitado |
| Regla | `--line` | `oklch(0.895 0.006 240)` | Bordes |
| Regla suave | `--line-soft` | `oklch(0.935 0.005 240)` | Separadores dentro de un bloque |
| Regla fuerte | `--line-strong` | `oklch(0.79 0.010 240)` | Bordes de control |
| Acento | `--accent` | `oklch(0.46 0.077 213)` | Acción primaria, selección, foco |
| Acento hundido | `--accent-deep` | `oklch(0.34 0.062 213)` | Texto sobre tinte, estados activos |
| Acento tinte | `--accent-tint` | `oklch(0.958 0.021 213)` | Fondos de selección |
| Oro | `--gold` | `oklch(0.73 0.10 78)` | Pendiente, reservado, sin publicar |
| Oro tinta | `--gold-ink` | `oklch(0.47 0.085 70)` | Texto de aviso |
| Sube | `--up` | `oklch(0.50 0.13 150)` | Mercado al alza |
| Baja | `--down` | `oklch(0.52 0.17 27)` | Mercado a la baja, destructivo |
| Banda | `--band` / `--band-2` | `oklch(0.31 0.055 213)` → `oklch(0.26 0.05 215)` | Superficie de marca del portal: barra y banda |
| Sobre banda | `--on-band` | `oklch(0.965 0.008 85)` | Texto sobre turquesa |
| Ámbar | `--amber` | `oklch(0.78 0.135 62)` | Complementario: cifra del día, marca sobre la banda |

Reglas de uso:

- El **oro es semántico**: dice «esto está a medias» (reserva corriendo, cambios
  sin publicar, expediente pendiente). Nunca es adorno ni gradiente.
- **Verde y rojo solo son mercado** o acción destructiva, y siempre acompañados
  de signo o palabra, nunca solos.
- El acento no pinta superficies grandes: botón primario, fila seleccionada,
  anillo de foco, indicador de sección activa.

## Typography

Dos familias, autoalojadas en `/fonts` (la CSP solo permite `font-src 'self'`),
variables las dos, subconjunto latino.

- **`--font-ui`: IBM Plex Sans** (OFL). Toda la interfaz: títulos, etiquetas,
  botones, tablas, prosa. Es un tipo de ingeniería, con esqueleto técnico y
  numerales inequívocos, y no es la fuente por defecto de todo el software (que
  es lo que hace que algo parezca hecho con plantilla).
- **`--font-mono`: IBM Plex Mono** (OFL). Solo marcas técnicas: referencias de
  cierre (`TQM-2608-0001`), versión de fórmulas, CIF, IBAN. Nunca cifras de
  dinero: eso es lenguaje de terminal de trading.
- **`--font-display`: Newsreader** (OFL), solo en el portal. Los dos o tres
  momentos grandes de la cara de cliente: el titular y el precio del día. Es la
  voz editorial que separa el portal del panel.

Escala fija en rem, razón ≈1.2, sin `clamp` en producto:

`11 · 12 · 13 · 14 (base) · 15 · 17 · 20 · 24 · 30 · 38`

- **Cifras**: `font-variant-numeric: tabular-nums` en todo número, y
  `--tracking-num: -0.01em`. Las columnas de importe se alinean a la derecha.
- **Etiqueta técnica** (`.eyebrow`): 11px, peso 500, `letter-spacing: 0.09em`,
  versalitas. Es la firma tipográfica del sistema y aparece en cada cabecera de
  panel.
- Prosa a 65–75ch. Tablas pueden ir más anchas.

## Layout

- **Portal**: ancho completo hasta 1360px. Barra turquesa pegajosa, **banda** de
  bienvenida de lado a lado con el precio del día en ámbar, y debajo un taller
  de dos columnas: el lote a la izquierda con todo el ancho que quepa y la
  tarifa en una columna pegajosa de 340px a la derecha, que es lo que se
  consulta mientras se monta. Por debajo de 1100px la tarifa baja debajo; por
  debajo de 560px el precio por gramo se pliega bajo el nombre de la ley. Sin
  sesión, la página se parte en dos: el tablón de precios y el acceso.
- Las superficies del portal levantan más que las del panel (`--shadow-md` de
  serie): allí se entra a hacer una cosa y hay que ver dónde.
- **Panel**: raíl lateral fijo de 220px sobre `--rail`, barra superior con la
  cotización en vivo, contenido a 1220px máximo, y barra de acción inferior
  cuando hay cambios sin publicar.
- Ritmo de espaciado variado, escala de 4: `4 8 12 16 20 24 32 40 56 72`. El
  mismo relleno en todo es monotonía; los bloques importantes respiran más.
- **Reglas antes que tarjetas.** Las listas y las tablas se separan con líneas
  de 1px, no con cajas apiladas. Nada de tarjetas anidadas.

## Components

Vocabulario único en las dos aplicaciones: mismo botón, mismo campo, mismo
estado. Cada control tiene sus siete estados (normal, hover, foco, activo,
deshabilitado, cargando, error).

- **Botón**: radio 6px, altura 34px (`.small` 28px), primario en acento sólido,
  secundario con borde, `ghost` sin borde. La pulsación baja 1px.
- **Campo**: radio 6px, borde `--line-strong`, foco con anillo de 3px al 22% del
  acento. Los numéricos van a la derecha con cifras tabulares.
- **Panel**: superficie, borde de 1px, radio 10px, sombra mínima; cabecera con
  `.eyebrow` y acciones a la derecha.
- **Marca de estado** (`.marca`): píldora con texto, tono por estado.
- **Tabla** (`.mini`): cabecera en versalitas sobre `--sunken`, filas separadas
  por `--line-soft`, hover de fila, importes a la derecha.
- **Carga**: esqueletos con la forma del contenido, nunca un spinner centrado.
- **Vacío**: enseñan qué es esa pantalla y qué hacer, no dicen «no hay datos».
- **Rejilla editable** (`.ledger .row`, fórmulas): las casillas no se dibujan
  hasta que el ratón entra en la fila o algo recibe el foco. Con ocho columnas
  de recuadros lo que se lee son los recuadros, no las cifras, y aquí las cifras
  son el sujeto. La fila entera reacciona al ratón, así que la afordancia no se
  pierde. En un **modo de edición** puntual —ajustar el lote de un cierre— las
  casillas sí se dibujan desde el principio: ahí el recuadro es la señal de que
  se ha entrado a editar.
- **Matrícula** (`.ref`): referencias, CIF, versiones y demás identificadores van
  en la mono. No son prosa ni son dinero. Cuando una referencia titula una ficha
  (`.panel__title.ref`) deja de ser etiqueta y pasa a tinta plena.
- **La puerta** (portal, sin sesión): el precio del día a la izquierda, el acceso
  a la derecha, una regla entre medias y ninguna tarjeta. El precio es público,
  así que se enseña antes de pedir nada: quien llega, llega a eso.

## Motion

- `--fast: 140ms`, `--base: 200ms`. Nada por encima de 260ms en producto.
- Curva única de salida: `--ease: cubic-bezier(0.16, 1, 0.3, 1)`. Sin rebote.
- Solo se anima lo que comunica: aparición de menú, cambio de sección, latido
  del indicador «en vivo», entrada de una fila nueva. No hay coreografía de
  carga de página.
- Nunca se animan propiedades de layout. Solo `opacity`, `transform`, `color`,
  `background`, `border-color`.
- Todo se apaga bajo `prefers-reduced-motion: reduce`.
