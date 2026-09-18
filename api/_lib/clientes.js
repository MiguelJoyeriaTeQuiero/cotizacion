// Clientes del portal: alta, revisión y sesiones.
//
// Un cliente es una tienda de compro-oro que se registra en la web para vender
// a TQM. El alta la revisa una persona: hasta que no se aprueba, la cuenta
// existe y se puede entrar, pero no habilita nada.
//
// Las sesiones del portal viven en claves aparte de las del panel. Son dos
// mundos distintos y no deben poder confundirse: una sesión de cliente nunca
// puede valer para el panel de administración.

import { redis, hasStorage } from './store.js'
import { randomToken, sha256, codigoLegible, normalizarCodigo } from './crypto.js'

const K = {
  cliente: (id) => `tqm:cliente:${id}`,
  porEmail: (email) => `tqm:cliente:email:${sha256(email.toLowerCase())}`,
  porCif: (cif) => `tqm:cliente:cif:${cif.toUpperCase()}`,
  indice: 'tqm:clientes:indice',
  sesion: (hash) => `tqm:cliente:sesion:${hash}`,
  clave: (hash) => `tqm:cliente:clave:${hash}`,
}

// Lo que dura un código para volver a entrar. Corto a propósito: es la llave de
// una cuenta, y una llave que anda por un buzón no puede valer para siempre.
const CLAVE_TTL = 60 * 60

// Caducidad de la sesión del cliente. Más larga que la del panel: aquí no se
// tocan márgenes, y a una tienda que entra a mirar precios no se le echa cada
// tres cuartos de hora.
const SESION_INACTIVIDAD = 12 * 3600
const SESION_ABSOLUTA = 30 * 24 * 3600

export const ESTADOS = ['pendiente', 'documentacion', 'aprobado', 'rechazado']

// Valores de partida al aprobar. Se ajustan cliente a cliente desde la ficha.
export const LIMITES_DEFECTO = {
  // Por encima de esta cifra, la solicitud se mira con más calma (Fase 2).
  porCierre: 5000,
  // Minutos que aguanta el precio reservado de una solicitud de cierre.
  reservaMinutos: 60,
}

export const MAX_DOCUMENTOS = 10

function nuevoId() {
  return `cli_${randomToken(6).slice(0, 10)}`
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function getCliente(id) {
  if (!id || !hasStorage()) return null
  try {
    const doc = await redis().get(K.cliente(id))
    return doc && typeof doc === 'object' ? doc : null
  } catch (err) {
    console.error('[clientes] getCliente →', err.message)
    return null
  }
}

export async function getClientePorEmail(email) {
  if (!email || !hasStorage()) return null
  try {
    const id = await redis().get(K.porEmail(email))
    return id ? getCliente(String(id)) : null
  } catch {
    return null
  }
}

export async function cifOcupado(cif) {
  if (!cif || !hasStorage()) return false
  try {
    return Boolean(await redis().get(K.porCif(cif)))
  } catch {
    return false
  }
}

/**
 * Índice ligero para la cola de revisión: lo justo para pintar la lista sin
 * traerse los expedientes enteros.
 */
export async function listarClientes() {
  if (!hasStorage()) return []
  try {
    const lista = await redis().get(K.indice)
    return Array.isArray(lista) ? lista : []
  } catch (err) {
    console.error('[clientes] listarClientes →', err.message)
    return []
  }
}

function resumen(cliente) {
  return {
    id: cliente.id,
    razonSocial: cliente.empresa.razonSocial,
    nombreComercial: cliente.empresa.nombreComercial,
    cif: cliente.empresa.cif,
    poblacion: cliente.empresa.poblacion,
    email: cliente.contacto.email,
    telefono: cliente.contacto.telefono,
    estado: cliente.estado,
    enviadoEn: cliente.enviadoEn ?? null,
    documentos: cliente.documentos.length,
    creadoEn: cliente.creadoEn,
    actualizadoEn: cliente.actualizadoEn,
  }
}

async function reindexar(cliente) {
  const lista = await listarClientes()
  const resto = lista.filter(x => x?.id !== cliente.id)
  // Los más recientes primero: la cola de revisión se lee de arriba abajo.
  const siguiente = [resumen(cliente), ...resto].sort(
    (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
  )
  await redis().set(K.indice, siguiente)
  return siguiente
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export async function crearCliente(datos, { passwordHash, ip, condicionesVersion }) {
  const ahora = new Date().toISOString()
  const cliente = {
    id: nuevoId(),
    estado: 'pendiente',
    // Se crea sin enviar: la solicitud no entra en la cola de TQM hasta que el
    // cliente sube su documentación y la manda. Así nadie revisa expedientes a
    // medio hacer.
    enviadoEn: null,
    empresa: datos.empresa,
    contacto: datos.contacto,
    titular: datos.titular,
    cobro: datos.cobro,
    documentos: [],
    password: passwordHash,
    condiciones: { version: condicionesVersion, aceptadoEn: ahora, ip },
    limites: { ...LIMITES_DEFECTO },
    nota: null,
    historial: [{ at: ahora, por: 'cliente', accion: 'alta', nota: null }],
    creadoEn: ahora,
    actualizadoEn: ahora,
  }

  const r = redis()
  await r.set(K.cliente(cliente.id), cliente)
  await r.set(K.porEmail(cliente.contacto.email), cliente.id)
  await r.set(K.porCif(cliente.empresa.cif), cliente.id)
  await reindexar(cliente)
  return cliente
}

export async function guardarCliente(cliente) {
  const siguiente = { ...cliente, actualizadoEn: new Date().toISOString() }
  await redis().set(K.cliente(siguiente.id), siguiente)
  await reindexar(siguiente)
  return siguiente
}

/**
 * Decisión de TQM sobre un expediente. Queda registrada con autor y fecha: es
 * media documentación de cumplimiento y la otra media, saber a quién preguntar
 * dentro de seis meses.
 */
export async function decidirCliente(cliente, { estado, nota, por, limites }) {
  const ahora = new Date().toISOString()
  const siguiente = {
    ...cliente,
    estado,
    nota: nota || null,
    limites: limites ? { ...cliente.limites, ...limites } : cliente.limites,
    historial: [{ at: ahora, por, accion: estado, nota: nota || null }, ...(cliente.historial || [])].slice(0, 50),
  }
  return guardarCliente(siguiente)
}

// ─── Sesiones del portal ─────────────────────────────────────────────────────

export async function abrirSesionCliente(cliente, req) {
  const token = randomToken(32)
  const record = {
    clienteId: cliente.id,
    email: cliente.contacto.email,
    razonSocial: cliente.empresa.razonSocial,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'desconocida',
    createdAt: Date.now(),
    expiresAt: Date.now() + SESION_ABSOLUTA * 1000,
  }
  await redis().set(K.sesion(sha256(token)), record, { ex: SESION_INACTIVIDAD })
  return { token, record, maxAge: SESION_ABSOLUTA }
}

export async function leerSesionCliente(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null
  if (!hasStorage()) return null

  const hash = sha256(token)
  let record
  try {
    record = await redis().get(K.sesion(hash))
  } catch {
    return null
  }
  if (!record || typeof record !== 'object') return null

  if (!record.expiresAt || Date.now() > record.expiresAt) {
    await cerrarSesionCliente(token)
    return null
  }

  // El expediente manda: si la cuenta ha desaparecido, la sesión no vale.
  const cliente = await getCliente(record.clienteId)
  if (!cliente) {
    await cerrarSesionCliente(token)
    return null
  }

  // Al cambiar la contraseña se cierran las sesiones abiertas antes. Es lo que
  // hace que restablecerla sirva de algo cuando alguien se ha metido dentro:
  // si no, el intruso seguiría con su sesión viva.
  if (cliente.credencialesEn && record.createdAt < cliente.credencialesEn) {
    await cerrarSesionCliente(token)
    return null
  }

  const restante = Math.floor((record.expiresAt - Date.now()) / 1000)
  try {
    await redis().expire(K.sesion(hash), Math.min(SESION_INACTIVIDAD, Math.max(restante, 1)))
  } catch {
    /* renovar el TTL no es crítico */
  }

  return { record, cliente }
}

export async function cerrarSesionCliente(token) {
  if (!token) return
  try {
    await redis().del(K.sesion(sha256(token)))
  } catch {
    /* la cookie se borra igual */
  }
}

// ─── Volver a entrar ─────────────────────────────────────────────────────────
//
// Un código de un solo uso, con caducidad. Se guarda solo su huella, igual que
// las sesiones: quien lea la base de datos no puede entrar en ninguna cuenta.
//
// Sirve para las dos vías: el enlace que se manda por correo y el código que
// TQM dicta por teléfono. Es el mismo mecanismo, así que no hay una puerta de
// atrás distinta para cada uno.

export async function crearCodigoClave(cliente, { por = 'cliente' } = {}) {
  const token = codigoLegible()
  await redis().set(
    K.clave(sha256(normalizarCodigo(token))),
    { clienteId: cliente.id, creadoEn: Date.now(), por },
    { ex: CLAVE_TTL }
  )
  await guardarCliente({ ...cliente, claveSolicitadaEn: new Date().toISOString() })
  return { token, minutos: CLAVE_TTL / 60 }
}

/**
 * Gasta un código y devuelve el cliente al que abría. Un código solo vale una
 * vez: se borra antes de tocar la contraseña.
 */
export async function consumirCodigoClave(token) {
  const limpio = normalizarCodigo(token)
  if (limpio.length < 16) return null
  const hash = sha256(limpio)

  let registro
  try {
    registro = await redis().get(K.clave(hash))
  } catch {
    return null
  }
  if (!registro || typeof registro !== 'object') return null

  try {
    await redis().del(K.clave(hash))
  } catch {
    // Si no se puede borrar, no se sigue: un código de un solo uso que se puede
    // usar dos veces no es un código de un solo uso.
    return null
  }

  const cliente = await getCliente(registro.clienteId)
  return cliente || null
}

/**
 * Deja la contraseña nueva y tumba lo que hubiera abierto: la marca de tiempo
 * la comprueba `leerSesionCliente` en cada petición.
 */
export async function cambiarClave(cliente, passwordHash) {
  return guardarCliente({
    ...cliente,
    password: passwordHash,
    credencialesEn: Date.now(),
    claveSolicitadaEn: null,
    historial: [
      ...(cliente.historial || []),
      { at: new Date().toISOString(), por: 'cliente', accion: 'clave', nota: null },
    ],
  })
}

/** Lo que se le puede contar al propio cliente sobre su expediente. */
export function vistaCliente(cliente) {
  return {
    id: cliente.id,
    estado: cliente.estado,
    enviadoEn: cliente.enviadoEn ?? null,
    nota: cliente.nota,
    empresa: cliente.empresa,
    contacto: cliente.contacto,
    titular: cliente.titular,
    cobro: cliente.cobro,
    documentos: (cliente.documentos || []).map(d => ({
      id: d.id,
      etiqueta: d.etiqueta,
      nombre: d.nombre,
      tipo: d.tipo,
      tamano: d.tamano,
      subidoEn: d.subidoEn,
    })),
    limites: cliente.limites,
    creadoEn: cliente.creadoEn,
  }
}
