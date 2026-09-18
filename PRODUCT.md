# Product

## Register

product

## Users

Dos públicos, dos superficies, un mismo dato debajo.

**El portal (`/portal`).** Joyerías y compro-oros aprobados: gente que compra oro
al público en su mostrador y necesita saber a cuánto se lo pagamos hoy antes de
decidir si cierra. Lo usan de día, en el despacho de la tienda, en un ordenador.
Su trabajo es uno: ver el precio, montar el lote y pedir el cierre antes de que
el precio se mueva. Muchos llevan veinte años haciendo esto por teléfono, así
que la pantalla compite con una llamada: si no es más rápida y más clara que
descolgar, pierde.

**El panel (`/admin`).** Miguel y quien esté con él en Te Quiero Metales.
Sesiones largas de día, pantalla grande. Aquí se decide el margen (las fórmulas
que fijan el precio publicado), se aprueban tiendas y se confirman cierres con
un reloj corriendo. Cada acción mueve dinero real y queda firmada.

## Product Purpose

Sustituir el cierre por teléfono por uno que deja rastro: precio publicado,
solicitud con el precio congelado, confirmación humana y registro de quién hizo
qué. El éxito no es que la pantalla guste: es que una tienda cierre 400 gramos
sin llamar y que TQM pueda cuadrar esa operación seis meses después.

## Brand Personality

**Exacto, veterano, sin postureo.** El tono de quien lleva toda la vida en el
oficio y no necesita adornarlo: se dice el número, se dice de dónde sale y se
dice qué pasa si cambia. Nada de entusiasmo de producto ni de lenguaje de
banco. El texto de la interfaz habla como se habla en el mostrador.

La emoción que hay que producir es **confianza en la cifra**. Todo lo demás
—la marca, el color, la tipografía— está al servicio de que un número parezca lo
que es: medido.

## Anti-references

- **Plantilla de administración.** Bootstrap y derivados: rejillas de tarjetas
  idénticas, iconos de colores, gráficas con degradados, sombras por todas
  partes. Es el aspecto por defecto de «software interno» y lo que hay que
  evitar con más cuidado, porque es a donde se cae solo.
- **Banca online española.** Azul corporativo, esquinas muy redondeadas, mucho
  relleno y poca información por pantalla.
- **Cripto y trading agresivo.** Verdes y rojos neón sobre negro brillante,
  cifras parpadeando, urgencia fabricada.
- **Landing de startup.** Degradados morados, ilustración 3D, animación al
  hacer scroll, texto que se presenta a sí mismo.

Y el reflejo del sector, que es el más peligroso porque parece buena idea:
**oro sobre negro**. Aquí el oro es la mercancía, no la decoración.

## Design Principles

1. **La cifra es el sujeto.** Todo lo que compite con el número, sobra. Cifras
   tabulares, columnas alineadas por la coma, jerarquía que empieza en el
   importe y baja desde ahí.
2. **Reglas, no cajas.** La estructura se construye con líneas finas y aire,
   como un libro de cuentas, no apilando tarjetas. Una tarjeta solo cuando algo
   es de verdad un objeto separable.
3. **El color dice algo o no está.** Turquesa es acción y selección; oro es
   pendiente, reservado, sin publicar; verde y rojo son movimiento de mercado.
   No hay color decorativo.
4. **Dos personalidades, un esqueleto.** Mismos cimientos, distinto registro: el
   portal es la cara de la marca ante el cliente y puede respirar y tener voz;
   el panel es un instrumento y prioriza densidad y velocidad.
5. **Nada se mueve porque sí.** La animación informa de un cambio de estado. Si
   quitarla no cambia lo que el usuario entiende, no debería estar.

## Accessibility & Inclusion

- Objetivo **WCAG 2.2 AA**: contraste 4.5:1 en texto y 3:1 en bordes de control
  y estados. El gris de las etiquetas se ha subido a propósito hasta cumplirlo.
- El estado **nunca depende solo del color**: cada marca de estado lleva su
  palabra («Pendiente», «Confirmado»), y las subidas y bajadas de mercado llevan
  su signo además del color, para daltonismo rojo-verde.
- Foco visible siempre, con anillo propio y `:focus-visible`, sin quitar el
  contorno del navegador sin sustituirlo.
- `prefers-reduced-motion` respetado en todo lo que se mueve.
- Objetivos táctiles de 40 px o más en móvil; los iconos que solo son iconos
  llevan `aria-label`.
