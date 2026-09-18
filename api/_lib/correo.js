// Envío de correo, con proveedor enchufable y sin dependencias.
//
// El portal necesita mandar exactamente una cosa: el enlace para volver a
// entrar cuando alguien pierde la contraseña. Con tan poco, un SDK sobra: es
// una llamada HTTP.
//
// Si no hay proveedor configurado, esto no revienta ni miente: dice que no se
// ha enviado, y el circuito sigue funcionando por el camino de siempre —TQM
// genera el código desde el panel y lo da por teléfono—. Es la diferencia entre
// una función que hace falta contratar y una que hace falta programar.
//
// Configuración (en Vercel o en .env.local):
//
//   RESEND_API_KEY=re_xxxxxxxx
//   CORREO_DESDE=Te Quiero Metales <no-responder@tudominio.com>
//
// El remitente tiene que ser de un dominio verificado en el proveedor; si no,
// la API lo rechaza y el correo no sale.

const TIEMPO_MAXIMO = 8000

/** ¿Hay un proveedor de correo configurado? */
export function hayCorreo() {
  return Boolean(process.env.RESEND_API_KEY && process.env.CORREO_DESDE)
}

/**
 * Manda un correo de texto plano.
 *
 * Nunca lanza: quien lo llama decide qué contarle al usuario, y un fallo de
 * envío no puede tumbar la petición que lo provocó.
 *
 * @returns {Promise<{enviado: boolean, motivo?: string}>}
 */
export async function enviarCorreo({ para, asunto, texto }) {
  if (!hayCorreo()) return { enviado: false, motivo: 'sin-proveedor' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CORREO_DESDE,
        to: [para],
        subject: asunto,
        text: texto,
      }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO),
    })

    if (!res.ok) {
      // El cuerpo del error trae el motivo real (dominio sin verificar, clave
      // caducada…). Va al registro, no a la pantalla del cliente.
      const detalle = await res.text().catch(() => '')
      console.error(`[correo] ${res.status} → ${detalle.slice(0, 200)}`)
      return { enviado: false, motivo: `respuesta ${res.status}` }
    }

    return { enviado: true }
  } catch (err) {
    console.error('[correo] no se ha podido enviar →', err.message)
    return { enviado: false, motivo: err.message }
  }
}
