import { json, methodNotAllowed, readJson, isSameOrigin, clientIp, parseCookies, serializeCookie } from '../_lib/http.js'
import { hashPassword, checkPassword, burnPasswordTime } from '../_lib/crypto.js'
import { readRate, bumpRate, clearRate, hasStorage, esDesarrolloLocal } from '../_lib/store.js'
import { validarAlta, CONDICIONES_VERSION, PASSWORD_MIN } from '../_lib/validate-cliente.js'
import {
  crearCliente, getClientePorEmail, cifOcupado, guardarCliente, decidirCliente,
  abrirSesionCliente, leerSesionCliente, cerrarSesionCliente, vistaCliente,
  crearCodigoClave, consumirCodigoClave, cambiarClave,
} from '../_lib/clientes.js'
import { enviarCorreo } from '../_lib/correo.js'
import { modoAlmacen } from '../_lib/documentos.js'

// Cuenta del portal de clientes: alta, entrada, salida y estado.
//
// Las tres acciones viven en la misma función a propósito: son el mismo
// recurso, comparten validación y limitación de intentos, y así el proyecto no
// se llena de funciones de doce líneas.
//
// Nada de esto tiene que ver con el panel de TQM: otra cookie, otras sesiones y
// ningún permiso sobre las fórmulas.

export const COOKIE_CLIENTE = 'tqm_cliente'

const LOGIN_MAX = 20
const LOGIN_VENTANA = 15 * 60
const ALTA_MAX = 5
const ALTA_VENTANA = 60 * 60
const CLAVE_MAX = 5
const CLAVE_VENTANA = 60 * 60

const MISMO_ERROR = 'Correo o contraseña incorrectos'

function ponerCookie(res, token, maxAge) {
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_CLIENTE, token, { maxAge }))
}

// Un CIF distinto por cada cuenta de prueba: el índice por CIF es único, así
// que dos cuentas con el mismo se pisarían. Sale del propio correo para que la
// misma cuenta salga siempre igual. La de siempre conserva el suyo.
function cifDePrueba(email) {
  if (email === 'demo@tequierometales.test') return 'B00000000'
  let n = 0
  for (const c of email) n = (n * 31 + c.charCodeAt(0)) % 100000000
  return `B${String(n).padStart(8, '0')}`
}

export default async function handler(req, res) {
  // Estado de la sesión: lo primero que pregunta el portal al cargar.
  if (req.method === 'GET') {
    const sesion = await leerSesionCliente(parseCookies(req)[COOKIE_CLIENTE])
    if (!sesion) {
      ponerCookie(res, '', 0)
      return json(res, 401, { error: 'Sin sesión' })
    }
    return json(res, 200, { cliente: vistaCliente(sesion.cliente), almacen: modoAlmacen() })
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])
  if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })

  let body
  try {
    body = await readJson(req)
  } catch (err) {
    const msg = err.code === 'BODY_TOO_LARGE' ? 'Los datos enviados son demasiado grandes' : 'Petición no válida'
    return json(res, 400, { error: msg })
  }

  const accion = String(body.accion || '')
  const ip = clientIp(req)

  // ─── Salir ─────────────────────────────────────────────────────────────────
  if (accion === 'salir') {
    await cerrarSesionCliente(parseCookies(req)[COOKIE_CLIENTE])
    ponerCookie(res, '', 0)
    return json(res, 200, { ok: true })
  }

  if (!hasStorage()) return json(res, 503, { error: 'El registro no está disponible ahora mismo' })

  // ─── Entrar ────────────────────────────────────────────────────────────────
  if (accion === 'entrar') {
    const bucket = `portal:login:${ip}`
    const previo = await readRate(bucket)
    if (previo.count >= LOGIN_MAX) {
      return json(res, 429, { error: 'Demasiados intentos. Prueba dentro de un rato.', retryAfter: previo.ttl })
    }

    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const cliente = await getClientePorEmail(email)

    // Cuenta inexistente y contraseña incorrecta responden lo mismo y tardan lo
    // mismo: desde fuera no se puede averiguar quién está dado de alta.
    if (!cliente) {
      burnPasswordTime(password)
      await bumpRate(bucket, LOGIN_VENTANA)
      return json(res, 401, { error: MISMO_ERROR })
    }
    if (!checkPassword(password, cliente.password)) {
      await bumpRate(bucket, LOGIN_VENTANA)
      return json(res, 401, { error: MISMO_ERROR })
    }

    await clearRate(bucket)
    const { token, maxAge } = await abrirSesionCliente(cliente, req)
    ponerCookie(res, token, maxAge)
    return json(res, 200, { cliente: vistaCliente(cliente), almacen: modoAlmacen() })
  }

  // ─── Contraseña olvidada ───────────────────────────────────────────────────
  //
  // Se responde siempre lo mismo, exista la cuenta o no: si no, esto sería una
  // forma cómoda de averiguar qué tiendas trabajan con TQM.
  //
  // Si hay proveedor de correo configurado, sale un enlace. Si no lo hay, la
  // solicitud queda marcada en la ficha y TQM da el código por teléfono, que es
  // como se hace hoy. En los dos casos el cliente lee lo mismo.
  if (accion === 'olvide') {
    const bucket = `portal:clave:${ip}`
    const previo = await readRate(bucket)
    if (previo.count >= CLAVE_MAX) {
      return json(res, 429, { error: 'Demasiadas peticiones. Prueba dentro de un rato.', retryAfter: previo.ttl })
    }
    await bumpRate(bucket, CLAVE_VENTANA)

    const email = String(body.email || '').trim().toLowerCase()
    const cliente = email ? await getClientePorEmail(email) : null

    if (cliente) {
      const { token, minutos } = await crearCodigoClave(cliente, { por: 'cliente' })
      const base = req.headers.origin || `https://${req.headers.host}`
      await enviarCorreo({
        para: email,
        asunto: 'Volver a entrar en el portal de Te Quiero Metales',
        texto: [
          `Hola, ${cliente.contacto.persona || cliente.empresa.razonSocial}:`,
          '',
          'Has pedido volver a entrar en el portal. Abre este enlace y elige una',
          `contraseña nueva. Caduca en ${minutos} minutos y solo sirve una vez:`,
          '',
          `${base}/portal/?clave=${token}`,
          '',
          'Si no has sido tú, no hace falta que hagas nada: mientras no se abra ese',
          'enlace, tu contraseña sigue siendo la de siempre.',
          '',
          'Te Quiero Metales',
        ].join('\n'),
      })
    }

    return json(res, 200, { ok: true })
  }

  // ─── Contraseña nueva ──────────────────────────────────────────────────────
  if (accion === 'restablecer') {
    const bucket = `portal:restablecer:${ip}`
    const previo = await readRate(bucket)
    if (previo.count >= CLAVE_MAX * 4) {
      return json(res, 429, { error: 'Demasiados intentos. Prueba dentro de un rato.', retryAfter: previo.ttl })
    }
    await bumpRate(bucket, CLAVE_VENTANA)

    const password = String(body.password || '')
    if (password.length < PASSWORD_MIN) {
      return json(res, 422, { error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` })
    }
    if (password.length > 200) return json(res, 422, { error: 'La contraseña es demasiado larga' })

    // El código se gasta antes de tocar nada: si algo falla después, no queda
    // un código vivo por ahí.
    const cliente = await consumirCodigoClave(String(body.token || ''))
    if (!cliente) {
      return json(res, 400, { error: 'Ese código ya no vale. Pide otro o llámanos.' })
    }

    const siguiente = await cambiarClave(cliente, hashPassword(password))
    await clearRate(`portal:login:${ip}`)

    // Se entra directamente: quien acaba de demostrar que tiene el correo no
    // necesita escribir la contraseña que acaba de elegir.
    const { token, maxAge } = await abrirSesionCliente(siguiente, req)
    ponerCookie(res, token, maxAge)
    return json(res, 200, { cliente: vistaCliente(siguiente), almacen: modoAlmacen() })
  }

  // ─── Cliente de prueba (solo en local) ─────────────────────────────────────
  //
  // Deja una cuenta aprobada y lista para probar el circuito de cierres sin
  // tener que registrarse y aprobarse a mano cada vez que se reinicia el
  // servidor. Igual que el almacén en memoria: es un atajo que SOLO existe en
  // tu ordenador. En Vercel esta acción no responde.
  if (accion === 'demo') {
    if (!esDesarrolloLocal()) return json(res, 404, { error: 'Acción no reconocida' })

    // Sin nada, la cuenta de siempre. Con correo y contraseña, una a medida:
    // así se prueba con las credenciales que uno quiera sin pasar por el alta y
    // la aprobación a mano. Si la cuenta ya existe, se le pone la contraseña
    // pedida: es de prueba, y lo que hace falta es poder entrar.
    const email = String(body.email || 'demo@tequierometales.test').trim().toLowerCase()
    const password = String(body.password || 'demo1234')
    const razonSocial = String(body.razonSocial || 'Joyería de Prueba SL').trim()

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
      return json(res, 422, { error: 'Correo no válido o contraseña de menos de 8 caracteres' })
    }

    let cliente = await getClientePorEmail(email)

    if (!cliente) {
      cliente = await crearCliente({
        empresa: {
          razonSocial, cif: cifDePrueba(email), nombreComercial: 'Compro Oro Demo',
          direccion: 'Calle de Prueba 1', poblacion: 'Santa Cruz de Tenerife',
          provincia: 'Santa Cruz de Tenerife', cp: '38001', iae: '491.1',
        },
        contacto: { persona: 'Cliente de prueba', telefono: '922000000', telefonoTienda: '', email },
        titular: { nombre: 'Cliente de prueba', dni: '00000000T' },
        cobro: { iban: 'ES9121000418450200051332' },
      }, { passwordHash: hashPassword(password), ip, condicionesVersion: CONDICIONES_VERSION })
    } else if (!checkPassword(password, cliente.password)) {
      cliente = await guardarCliente({ ...cliente, password: hashPassword(password) })
    }

    if (cliente.estado !== 'aprobado') {
      cliente = await decidirCliente(cliente, {
        estado: 'aprobado',
        nota: '',
        por: 'demo',
        limites: { porCierre: 5000, reservaMinutos: 60 },
      })
    }

    return json(res, 200, { email, password, cliente: vistaCliente(cliente) })
  }

  // ─── Enviar a revisión ─────────────────────────────────────────────────────
  if (accion === 'enviar') {
    const sesion = await leerSesionCliente(parseCookies(req)[COOKIE_CLIENTE])
    if (!sesion) return json(res, 401, { error: 'Sin sesión' })

    const { cliente } = sesion
    if (cliente.estado === 'aprobado') return json(res, 409, { error: 'La solicitud ya está aprobada' })
    if (!(cliente.documentos || []).length) {
      return json(res, 422, { error: 'Sube al menos un documento antes de enviar la solicitud' })
    }

    const siguiente = await guardarCliente({
      ...cliente,
      // Volver a enviar tras una petición de documentación devuelve el
      // expediente a la cola con el reloj a cero.
      estado: 'pendiente',
      nota: cliente.estado === 'documentacion' ? null : cliente.nota,
      enviadoEn: new Date().toISOString(),
    })
    return json(res, 200, { cliente: vistaCliente(siguiente), almacen: modoAlmacen() })
  }

  // ─── Alta ──────────────────────────────────────────────────────────────────
  if (accion === 'alta') {
    const bucket = `portal:alta:${ip}`
    const previo = await readRate(bucket)
    if (previo.count >= ALTA_MAX) {
      return json(res, 429, { error: 'Demasiadas solicitudes desde esta conexión.', retryAfter: previo.ttl })
    }

    const resultado = validarAlta(body)
    if (!resultado.ok) {
      return json(res, 422, { error: 'Revisa el formulario', details: resultado.errores })
    }

    const { value, password } = resultado
    if (await getClientePorEmail(value.contacto.email)) {
      return json(res, 409, { error: 'Ya hay una cuenta con ese correo. Entra con ella o usa otro.' })
    }
    if (await cifOcupado(value.empresa.cif)) {
      return json(res, 409, { error: 'Ya hay una solicitud con ese CIF. Si es tuya, entra con su correo.' })
    }

    await bumpRate(bucket, ALTA_VENTANA)

    const cliente = await crearCliente(value, {
      passwordHash: hashPassword(password),
      ip,
      condicionesVersion: CONDICIONES_VERSION,
    })

    // Se entra directamente: los documentos se suben ya con la sesión abierta,
    // y el estado de la solicitud se consulta desde el primer momento.
    const { token, maxAge } = await abrirSesionCliente(cliente, req)
    ponerCookie(res, token, maxAge)
    return json(res, 201, { cliente: vistaCliente(cliente), almacen: modoAlmacen() })
  }

  return json(res, 400, { error: 'Acción no reconocida' })
}
