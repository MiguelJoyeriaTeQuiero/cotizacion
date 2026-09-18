// Documentos del alta de cliente.
//
// Viven en Vercel Blob con acceso **privado**: no hay ninguna URL que se pueda
// pasar por ahí. Se leen solo a través del panel, con sesión de TQM.
//
// El navegador sube directo al almacén con un token de un solo uso que emite
// este servidor. Así los archivos no pasan por la función, que tiene un tope de
// 4,5 MB por petición y se quedaría corta con un PDF escaneado.
//
// En local, si no hay almacén configurado, se guarda en el almacén en memoria
// para poder probar el circuito entero sin dar de alta nada. Igual que con
// Redis: es un atajo que solo funciona en tu ordenador.

import { get, del } from '@vercel/blob'
import { redis, hasStorage } from './store.js'
import { tipoRealDe, TIPOS_ADMITIDOS, TAMANO_MAXIMO } from './validate-cliente.js'

const K = { local: (id) => `tqm:doc:${id}` }

const esLocal = !process.env.VERCEL && process.env.NODE_ENV !== 'production'

// Sin Blob y en local el archivo viaja por la función, así que hay que
// respetar el tope de cuerpo de petición.
export const TAMANO_MAXIMO_LOCAL = 2.5 * 1024 * 1024

export function hayBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function modoAlmacen() {
  if (hayBlob()) return 'blob'
  if (esLocal) return 'memoria'
  return null
}

/**
 * Comprueba que el archivo subido existe de verdad, que no se ha colado por
 * encima del tamaño y que por dentro es lo que dice ser.
 *
 * Devuelve null si algo no cuadra: el documento no se llega a registrar.
 */
export async function verificarBlob(url) {
  try {
    const res = await get(url, { access: 'private' })
    if (!res || res.statusCode !== 200) return null

    const { size, contentType } = res.blob
    if (!Number.isFinite(size) || size <= 0 || size > TAMANO_MAXIMO) {
      await borrarDocumento({ almacen: 'blob', url })
      return null
    }

    // Solo hacen falta los primeros bytes para saber qué es; el resto del
    // archivo no se descarga.
    const reader = res.stream.getReader()
    const { value } = await reader.read()
    reader.cancel().catch(() => {})

    const tipoReal = tipoRealDe(value || new Uint8Array())
    if (!tipoReal || !TIPOS_ADMITIDOS.includes(tipoReal)) {
      await borrarDocumento({ almacen: 'blob', url })
      return null
    }

    return { tamano: size, tipo: tipoReal, contentType }
  } catch (err) {
    console.error('[documentos] verificarBlob →', err.message)
    return null
  }
}

/** Guarda un archivo en el almacén en memoria (solo desarrollo local). */
export async function guardarLocal(id, base64, tipoDeclarado) {
  if (!esLocal || !hasStorage()) return null
  let buffer
  try {
    buffer = Buffer.from(String(base64), 'base64')
  } catch {
    return null
  }
  if (!buffer.length || buffer.length > TAMANO_MAXIMO_LOCAL) return null

  const tipoReal = tipoRealDe(buffer)
  if (!tipoReal || !TIPOS_ADMITIDOS.includes(tipoReal)) return null
  if (tipoDeclarado && tipoDeclarado !== tipoReal) return null

  await redis().set(K.local(id), buffer.toString('base64'))
  return { tamano: buffer.length, tipo: tipoReal }
}

/**
 * Devuelve el contenido de un documento para servirlo desde el panel.
 * `stream` cuando viene de Blob, `buffer` cuando viene del almacén local.
 */
export async function leerDocumento(doc) {
  if (doc.almacen === 'memoria') {
    const base64 = await redis().get(K.local(doc.id))
    if (!base64) return null
    return { buffer: Buffer.from(String(base64), 'base64'), tipo: doc.tipo }
  }
  try {
    const res = await get(doc.url, { access: 'private' })
    if (!res || res.statusCode !== 200) return null
    return { stream: res.stream, tipo: res.blob.contentType || doc.tipo }
  } catch (err) {
    console.error('[documentos] leerDocumento →', err.message)
    return null
  }
}

export async function borrarDocumento(doc) {
  try {
    if (doc.almacen === 'memoria') {
      await redis().del(K.local(doc.id))
      return
    }
    if (doc.url) await del(doc.url)
  } catch (err) {
    // Que no se pueda borrar el archivo no debe impedir quitarlo del
    // expediente: quedaría un huérfano, no un documento fantasma en la ficha.
    console.warn('[documentos] borrarDocumento →', err.message)
  }
}
