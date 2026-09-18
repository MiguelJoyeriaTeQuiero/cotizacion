# Panel de fórmulas — puesta en marcha

Panel privado en `/admin` desde el que se editan las fórmulas de la tabla de
precios de la web. Los cambios se publican al instante, sin tocar código ni
volver a desplegar.

---

## 1. Crear el almacenamiento

En el panel de Vercel del proyecto: **Storage → Create Database → Upstash (Redis)**.
Al vincularlo con el proyecto, Vercel inyecta solo las variables de conexión;
no hay que copiar nada a mano.

Con el CLI sería:

```bash
vercel integration add upstash
```

## 2. Configurar el acceso

Se entra con **usuario y contraseña**, en un solo paso. No hay códigos de 6
dígitos ni apps de autenticación.

La contraseña se escribe tal cual en una variable de entorno, así que se puede
cambiar desde el panel de Vercel en cualquier momento, sin tocar código ni
ejecutar ningún script.

En Vercel: **Settings → Environment Variables**, para *Production* y *Preview*:

| Variable | Valor |
|---|---|
| `ADMIN_USER` | El usuario, en minúsculas. Ej.: `miguel` |
| `ADMIN_PASSWORD` | La contraseña. Cuanto más larga, mejor |
| `ADMIN_NAME` | *(opcional)* El nombre que se muestra dentro del panel |
| `GOLDAPI_KEY` | La clave de goldapi.io |

Las de Upstash ya las habrá puesto la integración.

Después de cambiar cualquier variable hay que **volver a desplegar** (en Vercel:
*Deployments* → el último → *Redeploy*) para que la función la lea.

### Si hacen falta varias cuentas

En vez de `ADMIN_USER` / `ADMIN_PASSWORD`, se usa `ADMIN_USERS` con un array
JSON en **una sola línea**:

```
ADMIN_USERS=[{"username":"miguel","name":"Miguel","password":"..."},{"username":"tienda","name":"Tienda","password":"..."}]
```

### Si prefieres que la contraseña no esté en claro (opcional)

```bash
npm run credenciales -- miguel "Miguel Rodríguez"
```

Pide la contraseña por teclado —no se muestra ni queda en el historial del
terminal— e imprime un **hash** que se pega en `ADMIN_PASSWORD` en lugar de la
contraseña. El panel acepta indistintamente las dos formas.

## 4. Desplegar

```bash
git push
```

El panel queda en `https://<tu-dominio>/admin`.

---

## Probar el panel en local

`npm run dev` levanta la web **y** las funciones de `/api`. Lo único que hace
falta es un usuario:

1. Crea un archivo `.env.local` en la raíz del proyecto:

   ```
   ADMIN_USER=miguel
   ADMIN_NAME=Miguel
   ADMIN_PASSWORD=la-que-quieras
   ```

   Opcional, para ver precios de mercado reales en vez de los de respaldo:

   ```
   GOLDAPI_KEY=goldapi-xxxxxxxxxxxx-io
   ```

2. Arranca y entra en <http://localhost:3000/admin>

   ```bash
   npm run dev
   ```

   Si Vite avisa de que el puerto 3000 está ocupado y arranca en otro, usa el
   que indique en pantalla.

Si no hay ningún usuario configurado, en local (y **solo** en local) se activa
una cuenta de emergencia `admin` / `admin` para poder abrir el panel. En Vercel
ese atajo no existe: sin variables no se entra.

`.env.local` está en `.gitignore`: no se sube nunca al repositorio.

Sin Upstash configurado en local, el panel guarda en memoria: puedes probarlo
todo, pero los cambios se pierden al reiniciar el servidor. Es un atajo que
**solo funciona en tu ordenador** — en Vercel, si faltara el almacenamiento, la
función devuelve error en lugar de improvisar (hay una prueba que lo verifica).

Si prefieres trabajar en local contra los datos reales de producción:

```bash
vercel env pull .env.local
npm run dev
```

---

## Cómo funciona la protección

| Capa | Qué hace |
|---|---|
| Acceso | Usuario y contraseña en un solo paso. La contraseña vive en una variable de entorno de Vercel, nunca en el código ni en la base de datos. |
| Contraseñas | Opcionalmente se pueden guardar como hash **scrypt** con sal aleatoria (`npm run credenciales`), y entonces ni leyendo las variables de entorno se recupera. |
| Sesión | Cookie `HttpOnly` + `Secure` + `SameSite=Strict`. El JavaScript de la página no puede leerla, así que un XSS no la roba. |
| Caducidad | 45 min de inactividad, 12 h como máximo absoluto. |
| Revocación | Quitar o renombrar la cuenta en las variables de entorno corta su sesión abierta en la petición siguiente. |
| Fuerza bruta | Máximo 20 intentos fallidos por IP cada 15 minutos. El contador se pone a cero al acertar, así que una cuenta legítima no se bloquea sola. |
| Enumeración | Usuario inexistente y contraseña incorrecta devuelven el mismo mensaje y tardan lo mismo. |
| CSRF | Se exige cabecera `Origin` del mismo dominio en todo lo que modifica datos. |
| Datos entrantes | Se reconstruyen campo a campo con rangos cerrados: nada de lo que llegue se copia tal cual. |
| Aislamiento | El panel es un bundle aparte. Un visitante no descarga ni una línea de su código. |
| Indexación | Cabecera `noindex` + CSP estricta + `frame-ancestors 'none'`. No hay ningún enlace al panel desde la web. |
| Márgenes | `f1`, `f2` y `f3` no salen nunca del servidor: el endpoint público devuelve el precio ya calculado. |
| Clave de mercado | `GOLDAPI_KEY` vive solo en el servidor. |
| Cuota de la API | La frecuencia de consulta se fija desde el panel y la caché absorbe el tráfico: una subida de visitas no dispara el consumo. |

## Las secciones del panel

A la izquierda hay un menú con siete secciones. La barra de abajo, con los
cambios sin publicar y el botón **Guardar y publicar**, está siempre presente:
se puede editar en una sección, comprobar en otra y publicar desde cualquiera.

| Sección | Para qué |
|---|---|
| **Resumen** | Lo primero que se ve al entrar: cuánto se ha movido el mercado desde la última publicación, el margen de cada ley, avisos y la tendencia de los últimos 30 días. |
| **Cierres** | Las solicitudes de cierre que llegan del portal, con su precio reservado y su reloj: confirmar o rechazar. |
| **Clientes** | Las altas que llegan del portal: revisar la documentación y aprobar, pedir más papeles o rechazar. |
| **Fórmulas** | El editor de siempre: leyes, factores y el precio que quedaría. |
| **Simulador** | Qué pasaría con la tabla si el metal subiera o bajara un tanto por ciento. |
| **Escenarios** | Juegos de fórmulas guardados con nombre, sin publicar, para cargarlos el día que toque. |
| **Historial** | Las últimas 50 publicaciones, con qué cambió cada una y cuánto movió el precio. |
| **Evolución** | Gráfica de lo que se ha ido pagando frente a la cotización del metal. |
| **Opciones** | Los ajustes de la web (consulta de mercado, divisor) y los del propio panel. |

Arriba a la derecha están las cotizaciones del momento, con su variación del día
y un punto que indica si el dato es fresco o retrasado, y el menú de la cuenta.

### Editar y publicar

1. Entrar en `/admin` e identificarse.
2. En **Fórmulas**, elegir **Oro** o **Plata**.
3. Editar nombre, ley o factores. La última columna muestra el precio que
   quedaría; si cambia respecto a lo publicado, debajo aparece cuánto sube o
   baja (verde o rojo) y el precio que está en la web ahora mismo. Si no has
   tocado esa fila, no aparece nada.
4. **Guardar y publicar** (o `Ctrl` + `S`). El cambio se ve en la web en menos
   de un minuto.

Reordenar filas se hace con las flechas ▲ ▼ que aparecen al pasar por encima de
una fila; la primera de la lista es la que sale en la tarjeta de la portada.

### Los tres factores

```
€ / gramo = (ley ÷ 1000) × fixing €/oz × factor 1 × factor 2 ÷ divisor + factor 3
```

| Campo | Qué hace | Rango |
|---|---|---|
| **Factor 1** | Multiplica. Margen comercial. | 0,01 – 2 |
| **Factor 2** | Multiplica. Merma y descuento por quilataje. | 0,01 – 2 |
| **Factor 3** | **Suma o resta una cantidad fija en euros por gramo**, al final del cálculo. | −100 – 100 |

Los dos primeros son proporcionales: al subir el oro, lo que descuentan sube
con él. El **factor 3** es una cantidad cerrada, la misma suba o baje el
mercado. Se pone en negativo para descontar: `-0,05` deja el gramo 5 céntimos
por debajo del precio que saldría sin él. En `0` no hace nada, que es como
vienen todas las leyes de partida.

Se admite tanto el punto como la coma decimal: `-0.05` y `-0,05` valen igual.

Si el ajuste fuera tan grande que dejara el precio en negativo, la web publica
`0` en lugar de un número negativo.

Otras opciones: reordenar filas con las flechas ▲ ▼ que aparecen al pasar por
encima de una fila (la primera es la que sale en la tarjeta de la portada),
añadir o eliminar leyes, y **Historial** para ver los últimos 50 cambios con
autor y fecha, y recuperar cualquier versión anterior.

### Cierres

Cuando un cliente aprobado monta su lote en el portal, la solicitud entra aquí
con el precio ya congelado, y el menú avisa con un número.

Cada solicitud trae quién es, su teléfono, el desglose línea a línea, el total
y **cuánto queda de reserva de precio**. Las que se han pasado del plazo salen
marcadas en rojo.

- **Ajustar el lote.** Lo que se dice por teléfono y lo que dice la báscula no
  siempre coinciden. Antes de confirmar se pueden cambiar los **gramos** y el
  **precio por gramo** de cada línea, quitar líneas y añadir leyes que no se
  habían dicho.
- **Confirmar.** El botón lleva escrito el importe, para que se confirme un
  número, no una idea. A partir de ahí, ese es el precio pase lo que pase en el
  mercado.
- **Rechazar**, con un motivo que el cliente lee tal cual.

Y en cualquier estado, dos cosas más: **Justificante PDF**, que es el mismo
papel que se descarga el cliente, y el bloque **Para el ERP**, con una fila por
línea del lote para copiar o descargar en CSV.

Sobre el ajuste, lo que conviene saber:

- El precio se puede dejar **vacío**: entonces vale el de tarifa, calculado con
  la cotización congelada de ese cierre —no con la de ahora mismo—, así que
  corregir un peso no reabre ni mueve la reserva.
- Un precio escrito a mano queda marcado como tal, con la tarifa al lado para
  ver la diferencia, y **no lo pisa ninguna revalorización**: si la reserva
  vence, el mercado actualiza lo demás y ese número se queda donde lo dejaron.
- **Lo que pidió el cliente se guarda** y se sigue viendo debajo del lote, junto
  a quién ajustó, cuándo y con qué motivo. El cliente ve el lote nuevo y lo que
  él pidió; el nombre de quién lo tocó y el motivo se quedan en casa.
- Solo se ajusta lo que está **pendiente**: un cierre confirmado ya no se toca.

Si la reserva ha vencido, confirmar **no confirma**: el servidor vuelve a
valorar el lote al precio del momento, lo enseña y pide la confirmación otra
vez. Nadie firma un número que ya no está en pantalla. Lo mismo si el total ha
cambiado desde que se abrió la solicitud.

Cuánto dura esa reserva lo decide la ficha de cada cliente (60 minutos por
defecto), en la sección siguiente.

### Clientes

Las tiendas se registran solas en el portal (`/portal`), suben su documentación
y la envían. Aquí llega esa cola, y el menú avisa con un número de cuántas hay
por revisar.

Al abrir una solicitud se ve todo lo que hace falta para decidir: datos
fiscales, contacto, administrador, IBAN, cuándo se envió y los documentos, que
se abren desde el propio panel —nunca son públicos: no hay una URL que se pueda
reenviar—. Abajo, tres decisiones:

- **Aprobar.** El cliente queda habilitado. De paso se fijan sus dos límites: a
  partir de qué importe una operación suya se mira con más calma, y cuántos
  minutos se le reserva el precio cuando pida un cierre (60 por defecto).
- **Pedir documentación.** Lo que se escriba en el motivo es exactamente lo que
  el cliente lee en su pantalla, así que conviene ser concreto.
- **Rechazar**, también con motivo.

Cada decisión queda firmada con quién la tomó y cuándo, en el historial del
expediente. Un expediente aprobado ya no se puede modificar desde el portal: es
la documentación que respalda la decisión.

**Si un cliente no puede entrar**, en su ficha —ya aprobada— hay un bloque
*Acceso al portal* que genera un **código de un solo uso**, válido una hora,
para dictárselo por teléfono: con él elige contraseña nueva desde el portal.
Antes de darlo hay que estar seguro de con quién se habla, porque ese código
abre la cuenta. Se enseña una sola vez y no se guarda en claro en ningún sitio;
si se pierde, se genera otro y el anterior deja de valer al usarse el nuevo.

Cuando es el propio cliente quien lo ha pedido desde el portal, la ficha lo
avisa. Si tenéis configurado el correo saliente, el enlace se lo manda el portal
solo y no hace falta llamar a nadie.

El portal está explicado por separado, en [PORTAL.md](PORTAL.md).

### Qué se ve al entrar

**Resumen** responde a la única pregunta que importa al abrir el panel: si hay
que tocar algo hoy.

- **Cuánto se ha movido el mercado desde la última publicación.** Al publicar se
  congela la cotización de ese instante, y esa es la referencia. Conviene tener
  claro que los precios de la web se recalculan solos con cada cotización: lo
  que pagas por gramo sube y baja con el mercado sin tocar nada. Las fórmulas
  deciden el margen, no el precio.
- **El margen de cada ley**, ordenado de menor a mayor. Compara lo que pagas con
  lo que vale el metal puro de ese gramo. Es `1 − f1 × f2` corregido por el
  factor 3, así que un margen bajo o negativo salta a la vista enseguida.
- **Avisos**: cotización retrasada, cambios sin publicar, alguna ley pagándose
  por encima del valor del metal, o mucho tiempo sin tocar las fórmulas.

### Simulador

Un deslizador de −10 % a +10 % que recalcula toda la tabla. Sirve para ver el
precio que se pagaría y, sobre todo, qué pasa con el margen.

Con el factor 3 a cero el margen no se mueve: es exactamente `1 − f1 × f2`, la
misma proporción suba o baje el metal. Solo el factor 3, al ser una cantidad
fija en euros, hace que el margen varíe según cotice. La última columna indica
la cotización a la que el margen de esa ley llegaría a cero, y solo aparece con
un factor 3 positivo.

### Escenarios

Guardar el editor tal y como está, con un nombre, **sin publicar nada**. Caben
doce; repetir el nombre reemplaza el anterior.

Cada escenario se puede **comparar** con lo que hay publicado (se ve qué campos
cambian y cuánto se movería el precio de cada ley) o **cargar** en el editor,
que lo deja listo para revisar y publicar cuando se quiera.

### Historial y comparación

Las últimas 50 publicaciones, con autor y fecha. **Ver qué cambió** abre la
comparación con la versión anterior: los campos modificados y, a la derecha, el
efecto real en euros por gramo con la cotización de ahora. Cualquier versión
antigua se puede cargar en el editor.

### Evolución

Una gráfica de lo que se ha ido pagando por gramo frente a la cotización del
metal, en ventanas de 7, 30 o 90 días.

Las muestras las escribe el propio sitio web: cada vez que refresca la
cotización guarda una foto del fixing y del precio publicado, **como mucho una
por hora**, y se conservan las últimas mil (unos cuarenta días). Es decir, la
gráfica se llena sola con el tráfico normal, sin tareas programadas, pero
**empieza vacía**: los primeros días no habrá gran cosa que ver.

Mientras las fórmulas no se toquen, las dos líneas dibujan la misma forma. Un
escalón en la del precio que la cotización no acompaña es un cambio hecho desde
el panel.

## Opciones

Dos naturalezas distintas, y en la pantalla se distinguen:

- **Ajustes de la web**: la frecuencia de consulta del mercado y el divisor.
  Cambian lo que ve el visitante, así que hay que publicarlos con el botón de
  siempre.
- **Este panel**: sección de inicio, altura de las filas, columna de margen y si
  se pregunta antes de eliminar una ley. Solo afectan a quien las cambia, tienen
  efecto al instante y se guardan en su navegador (no en el servidor, y nunca
  junto a nada de la sesión).

### Cada cuánto se consulta el precio de mercado

En **Opciones**, bajo *Ajustes de la web*, hay un desplegable que decide cada
cuánto se le pide la cotización del oro y la plata a
goldapi.io. Va de 30 segundos a una vez al día, y por defecto es cada minuto.

Es el ajuste que gobierna el gasto de cuota de la API: entre una consulta y la
siguiente, el precio que ve el visitante sale de la caché del servidor, así que
el tráfico de la web no se traduce en más llamadas. Debajo del desplegable se
indica el techo de consumo mensual de la opción elegida.

**No afecta a la rapidez con la que se ven tus cambios de fórmula:** eso sigue
siendo cuestión de menos de un minuto aunque el mercado se consulte una vez al
día, porque son dos cachés distintas.

Se guarda con el resto de los cambios, con el mismo botón **Guardar y publicar**,
y queda registrado en el historial como una versión más.

Si las dos personas editan a la vez, quien guarde en segundo lugar recibe un
aviso en lugar de pisar el trabajo del otro.

## Pruebas

```bash
npm test
```

Comprueba el hashing, la comprobación de contraseñas en sus dos formatos, la
validación de datos y el ciclo completo de los endpoints: login, sesión,
guardado, permisos, bloqueo por fuerza bruta, que el endpoint público no filtre
los márgenes, los escenarios (validación, reemplazo por nombre, borrado y que
guardar uno no publique nada) y el registro de muestras de evolución, incluido
que no se apunte una por visita.

## Detalles técnicos

- **Nada externo.** El panel no descarga ni una petición fuera del dominio: la
  tipografía (Lato, licencia OFL) se sirve desde `/fonts`, y las gráficas y los
  iconos son SVG escritos a mano. Es lo que permite mantener la CSP estricta de
  `vercel.json` sin excepciones.
- **Qué se guarda en Redis**: las fórmulas vigentes, el historial de 50
  versiones, la caché de cotización, hasta 12 escenarios y hasta 1000 muestras
  de evolución (una por hora como mucho).
- **Las preferencias del panel** (sección de inicio, densidad, etc.) viven en el
  `localStorage` del navegador. La sesión sigue viajando solo en la cookie
  `HttpOnly`.
