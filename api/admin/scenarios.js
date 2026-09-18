import { json, methodNotAllowed, readJson, isSameOrigin } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'
import { getScenarios, putScenario, deleteScenario, hasStorage, SCENARIOS_MAX } from '../_lib/store.js'
import { validateFormulas } from '../_lib/validate.js'

// Escenarios: juegos de fórmulas guardados con nombre que NO están publicados.
// Sirven para preparar una subida de márgenes, compararla con lo que hay en la
// web y cargarla el día que toque.
//
// GET    → lista
// PUT    → guarda (o reemplaza) uno
// DELETE → borra uno por nombre

const NAME_MAX = 40

// Se limpia a mano en vez de confiar en lo que llega: fuera controles y
// espacios raros, que acaban en la interfaz y en el almacén.
function cleanName(input) {
  const name = String(input ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name || name.length > NAME_MAX) return null
  return name
}

export default async function handler(req, res) {
  const session = await requireSession(req, res)
  if (!session) return

  if (req.method === 'GET') {
    const list = await getScenarios()
    return json(res, 200, { scenarios: list, max: SCENARIOS_MAX })
  }

  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return methodNotAllowed(res, ['GET', 'PUT', 'DELETE'])
  }

  if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })
  if (!hasStorage()) return json(res, 503, { error: 'Almacenamiento no disponible' })

  let body
  try {
    body = await readJson(req)
  } catch (err) {
    const msg = err.code === 'BODY_TOO_LARGE' ? 'Los datos enviados son demasiado grandes' : 'Petición no válida'
    return json(res, 400, { error: msg })
  }

  const name = cleanName(body.name)
  if (!name) return json(res, 422, { error: `El nombre no puede estar vacío ni pasar de ${NAME_MAX} caracteres` })

  try {
    if (req.method === 'DELETE') {
      const list = await deleteScenario(name)
      return json(res, 200, { scenarios: list, max: SCENARIOS_MAX })
    }

    // Un escenario pasa por la misma validación que una publicación: no tiene
    // sentido poder guardar algo que después no se va a poder publicar.
    const result = validateFormulas(body.snapshot)
    if (!result.ok) {
      return json(res, 422, { error: 'Hay valores no válidos', details: result.errors })
    }

    const list = await putScenario({ name, snapshot: result.value, username: session.username })
    return json(res, 200, { scenarios: list, max: SCENARIOS_MAX })
  } catch (err) {
    console.error('[scenarios] →', err.message)
    return json(res, 500, { error: 'No se ha podido guardar el escenario' })
  }
}
