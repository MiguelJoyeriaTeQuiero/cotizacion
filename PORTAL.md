# Portal de clientes — Fase 1

Diseño de la primera fase: **alta con revisión** y **solicitud de cierre**. El
cliente se registra en la web, TQM revisa la documentación y aprueba, y a partir
de ahí la tienda monta su lote y pide el cierre. **Lo confirma siempre una
persona de TQM**, con un clic, desde el panel.

En esta fase no hay autoservicio: nadie compromete un precio sin que alguien de
la casa lo confirme. Lo que sí desaparece es dictar gramos por teléfono y
teclearlos a mano.

El pago y la facturación no se tocan: siguen en el ERP, como hasta ahora.

> **Estado.** La Fase 1 está construida y probada de punta a punta: alta con
> revisión, documentos en Vercel Blob, y solicitud de cierre con su bandeja de
> confirmación. Lo siguiente sería la Fase 2 (autoservicio con límites).

---

## 1. El alta

### Qué se le pide

Datos de la empresa, de contacto y documentación. La lista definitiva de
documentos la fija la asesoría —la compraventa de metales preciosos tiene sus
obligaciones de identificación del cliente—; lo que sigue es la estructura, y
los campos concretos se ajustan sin tocar el resto del circuito.

| Bloque | Campos |
|---|---|
| Empresa | Razón social, CIF, nombre comercial, dirección fiscal, epígrafe de IAE |
| Contacto | Persona de contacto, teléfono, correo, teléfono de la tienda |
| Titularidad | Administrador o apoderado, DNI |
| Cobro | IBAN (solo para preparar el pago en el ERP; el portal no mueve dinero) |
| Documentos | Hasta 10 archivos |
| Condiciones | Aceptación expresa, con la versión, la fecha y la hora guardadas |

### Los documentos

- **Hasta 10 archivos** por solicitud.
- **PDF, JPG, PNG y WEBP.** Las fotos hechas con el móvil valen: es lo que va a
  pasar la mitad de las veces.
- **8 MB por archivo**, 40 MB en total. Las imágenes grandes se reducen en el
  navegador antes de subirlas, así que una foto de 12 megapíxeles no obliga a
  nadie a esperar.
- Se suben **de una en una y con barra de progreso**, no todas de golpe al
  enviar el formulario: si falla una, no se pierde el resto.
- Cada archivo se puede **renombrar con una etiqueta** (*«CIF»*, *«DNI
  administrador»*, *«Certificado bancario»*) y quitar antes de enviar.
- Se comprueba el **tipo real del archivo** leyendo su cabecera en el servidor,
  no la extensión ni lo que declare el navegador. Un `.pdf` que por dentro no
  empieza por `%PDF` se rechaza.
- Los archivos **no son públicos**. Solo se abren desde el panel, con sesión de
  TQM; no hay ninguna URL que se pueda pasar por ahí.

### Los estados

```
pendiente ──► aprobado
    │  ▲
    │  └── documentación pedida (el cliente añade y vuelve a enviar)
    └────► rechazado (con motivo)
```

El cliente **puede entrar desde el minuto uno**, aunque esté pendiente: ve en
qué estado está su solicitud y, si le piden documentación, la añade ahí mismo.
Lo que cambia al aprobar no es el acceso, es lo que puede hacer dentro.

No hace falta correo de activación ni de aviso: el estado se ve al entrar.

### La cola de revisión, en el panel

Una sección nueva —**Clientes**— con las altas pendientes arriba y su
antigüedad, para que ninguna se quede olvidada. La ficha muestra los datos, los
documentos (se abren en el propio panel) y tres acciones:

- **Aprobar**, asignando de paso el límite por cierre a partir del cual habrá
  que mirar la operación con más calma.
- **Pedir documentación**, con una nota que el cliente lee tal cual.
- **Rechazar**, con motivo.

Todo queda registrado: quién aprobó, cuándo y desde dónde.

---

## 2. La solicitud de cierre

### Lo que ve el cliente

Los precios en vivo y el lote montado en **dos pasos**: *Quilataje* y
*Resumen*.

En el primero, una casilla por cada ley que compramos —oro y plata en dos
pestañas—, cada una con su precio por gramo a la vista y un campo de peso con
sus botones de **−** y **+** (las flechas del teclado hacen lo mismo). El oro se
mueve de gramo en gramo y la plata de cien en cien, que es como se pesa cada
uno. El **importe se rellena solo** en cuanto hay peso, la casilla se enciende
para que se vea de un vistazo lo que lleva el lote, y abajo el **subtotal** con
los gramos y el total en grande.

No hay nada que aprender ni formato que respetar: el peso va en la ley que le
toca. Si en un campo se escribe algo que no es un peso, esa casilla se marca en
rojo y **Siguiente** espera hasta que se arregle.

El segundo paso es el resumen —ley, gramos, € por gramo e importe— con el total
y el aviso de la reserva. Desde ahí se vuelve atrás a corregir o se pide el
cierre.

Al pulsar **Solicitar cierre**:

1. Se congela el precio de ese instante y **se reserva 60 minutos** (o lo que
   diga la ficha de ese cliente).
2. La solicitud entra en el panel de TQM.
3. El cliente ve su referencia (`TQM-2608-0841`) y el estado: *pendiente de
   confirmación*.

### Lo que ve TQM

En el panel, una **bandeja de solicitudes** con aviso en el menú. Cada una trae
el cliente, el desglose, el precio congelado, el total y el tiempo que le queda
a la reserva. Dos botones: **confirmar** o **rechazar** (con motivo, y con el
teléfono a mano para lo que haga falta hablar).

Antes de decidir, el lote **se puede ajustar**: los gramos que diga la báscula,
el precio por gramo si se ha pactado otro, quitar líneas y añadir leyes que no
se habían dicho. Lo que pidió el cliente se guarda y se sigue viendo al lado, y
el cliente ve las dos cosas —lo suyo y lo ajustado— cuando abre su cierre. El
apartado *Cierres* de [PANEL.md](PANEL.md) lo cuenta entero.

### El precio, sin trampa para ninguno

- Si TQM confirma **dentro de la ventana reservada**, vale el precio congelado.
- Si se pasa el plazo, la solicitud **se revaloriza** al precio del momento y se
  vuelve a mostrar antes de confirmar. Nadie firma a ciegas y nadie se come una
  bajada por una demora.
- Confirmado el cierre, el precio es ese. Lo que pase después en el mercado da
  igual.

### Después de confirmar

El cliente ve el cierre confirmado con su desglose y **se descarga el
justificante en PDF**: una hoja con el lote, el precio de cada ley, el total, la
cotización que quedó congelada y, si el lote se ajustó, lo que él había pedido.
No es una factura y el propio documento lo dice.

TQM tiene la operación cuadrada y lista para pasar al ERP: en la ficha del
cierre hay un **bloque de datos** con una fila por línea del lote —punto y coma
y coma decimal, sin separador de miles— que se copia de un botón o se descarga
en CSV. El PDF y el CSV salen del mismo sitio, así que el papel del cliente y lo
que entra en contabilidad no pueden discrepar.

Lo que llegue después —recepción, pesaje, ensayo y pago— sigue como hasta ahora.
La conciliación de *cerrado contra recibido* es Fase 3.

---

## 3. Cómo encaja con lo que ya hay

| Pieza | Estado |
|---|---|
| Precios y fórmulas | Ya está. El portal usa el mismo endpoint público que la web. |
| Serie histórica | Ya está. Da el precio exacto de cualquier momento si hay discusión. |
| Panel | Se le añaden dos secciones: **Clientes** y **Solicitudes**. |
| Acceso de clientes | Nuevo, y **separado del de TQM**: otra cookie, otras sesiones, otros permisos. Un cliente no puede tocar nada del panel. |
| Documentos | Nuevo. Almacenamiento de archivos aparte de Redis. |
| ERP | Sin cambios. Recibe la operación ya cerrada. |

### Datos que se guardan

- **Cliente**: datos fiscales y de contacto, estado, documentos, límites,
  historial de decisiones (quién aprobó y cuándo) y aceptación de condiciones
  con su versión.
- **Cierre**: referencia, cliente, líneas (ley, gramos, € por gramo aplicado),
  total, cotización congelada, versión de fórmulas aplicada, estados con sus
  horas y quién confirmó.

### El precio lo pone el servidor

Del navegador solo se acepta **qué ley y cuántos gramos**. El precio por gramo y
el importe se calculan en el servidor con las fórmulas publicadas y la
cotización del momento, y lo que venga en la petición se ignora. Hay una prueba
que envía un precio disparatado y comprueba que no se cuela.

Si en ese instante la cotización no es fiable —la API de mercado no responde y
solo hay un dato viejo— **no se acepta la solicitud**: un compromiso de precio
no se firma con un dato dudoso.

### Protección

Lo mismo que ya protege el panel, aplicado al portal: contraseñas con hash
scrypt, cookie `HttpOnly` propia, límite de intentos por IP, comprobación de
origen en todo lo que modifica datos, y validación campo a campo de lo que
llega. Los documentos, privados y servidos solo con sesión.

**Contraseñas olvidadas**: hay dos caminos y son el mismo mecanismo, un código
de un solo uso que caduca en una hora.

- **Solo**: en el acceso, *He olvidado la contraseña*. Se pide el correo y sale
  un enlace. La respuesta es idéntica exista la cuenta o no, para que esto no
  sirva para averiguar qué tiendas trabajan con TQM.
- **Por teléfono**: si el correo no llega —o si no hay proveedor contratado—, la
  tienda llama y TQM genera el código desde su ficha y se lo dicta. La petición
  del cliente queda marcada en la ficha, para que se sepa que ha llamado.

El código son cuatro grupos de cuatro (`F8BN-9SZN-QJCW-5NKP`), con un alfabeto
sin caracteres que se confundan al leerlos en voz alta —ni O ni 0, ni I ni L ni
1— porque la mitad de las veces se va a dictar por teléfono. Al teclearlo da
igual mayúsculas, guiones o espacios.

Al cambiarla se cierran las sesiones que hubiera abiertas: si alguien se había
metido dentro, restablecerla lo echa. El código se guarda solo como huella, se
gasta al usarlo y nunca se enseña dos veces.

El envío de correo es **opcional y enchufable** (`RESEND_API_KEY` y
`CORREO_DESDE`). Sin configurar, no se rompe nada: queda la vía del teléfono.

---

## 4. Decisiones tomadas

| Asunto | Decisión |
|---|---|
| Dónde viven los documentos | **Vercel Blob**, con acceso privado. El navegador sube directo al almacén, así que un PDF escaneado no choca con el tope de 4,5 MB por petición de las funciones. |
| Orden de entrega | Primero el alta con revisión —ya está—, después la solicitud de cierre. |
| Reserva de precio | **60 minutos**, y ajustable cliente a cliente desde su ficha (entre 5 minutos y 24 horas). |
| Límite por cierre | 5.000 € de partida, también por cliente. En esta fase es informativo: todo lo confirma una persona. |

Los campos exactos del alta y qué documentos son obligatorios los fija la
asesoría; el circuito no cambia por eso.

## 5. Puesta en marcha

1. **Activar el almacén de documentos.** En Vercel: *Storage → Create Database
   → Blob*, y vincularlo con el proyecto. Eso inyecta `BLOB_READ_WRITE_TOKEN`.
   Después hay que **volver a desplegar** para que la función la lea.
2. **Desplegar.** El portal queda en `https://<tu-dominio>/portal`.
3. **Probar el circuito** con una tienda de confianza: que se registre, suba dos
   documentos y los envíe. En el panel aparecerá en **Clientes**, con el aviso
   en el menú.

Sin el token de Blob, en Vercel la subida avisa de que falta configurar el
almacén en lugar de improvisar. En local, sin token, los documentos se guardan
en el almacén en memoria: se puede probar todo el circuito, pero se pierden al
reiniciar y no se admiten archivos de más de 2,5 MB.

### Para probarlo en local

En una terminal, el servidor. En otra, la cuenta de prueba:

```bash
npm run dev
```

```bash
npm run demo
```

El segundo comando deja **una cuenta de cliente ya aprobada** y escribe sus
credenciales en pantalla, para poder entrar en <http://localhost:3000/portal> y
pedir cierres sin tener que registrarse y aprobarse a mano.

Si prefieres unas credenciales tuyas, se pasan detrás —el correo y la
contraseña, de ocho caracteres o más—:

```bash
npm run demo -- correo@tienda.es contraseña
```

La cuenta se crea aprobada igual; si ya existía, se le pone esa contraseña.

Y para no tener que acordarse de nada, en `.env.local`:

```
CLIENTE_DEMO=correo@tienda.es:contraseña
```

Con esa línea, el servidor de desarrollo crea esa cuenta —aprobada— cada vez que
arranca, y lo dice al levantarse. En Vercel no hace nada.

Solo funciona en local, y solo con el servidor levantado: la cuenta vive en el
almacén en memoria, que es del propio proceso. Al reiniciar el servidor se
pierde y basta con volver a ejecutarlo. Si Vite eligió otro puerto:
`npm run demo -- 3001`.

Para probar el circuito completo tal y como lo verá un cliente de verdad
—registro, documentación, revisión y aprobación— el registro es público: se crea
la cuenta desde el portal y se aprueba desde `/admin`, con las credenciales de
`ADMIN_USER` y `ADMIN_PASSWORD`.

## 6. Lo que queda de la Fase 1

La **solicitud de cierre**: los dos pasos donde el cliente reparte los gramos
por quilataje y revisa el resumen, la reserva de precio y la bandeja de
confirmación en el panel. El apartado 2 de este documento es su diseño.
