import { json, methodNotAllowed, readJson, isSameOrigin, clientIp } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'
import { getFormulas, saveFormulas, hasStorage } from '../_lib/store.js'
import { validateFormulas } from '../_lib/validate.js'
import { refreshSecondsOf } from '../_lib/defaults.js'

// GET  → fórmulas completas, con f1 y f2. Solo con sesión válida.
// PUT  → guarda una versión nueva tras validarla.

export default async function handler(req, res) {
  const session = await requireSession(req, res)
  if (!session) return

  if (req.method === 'GET') {
    const doc = await getFormulas()
    return json(res, 200, {
      divisor: doc.divisor,
      refreshSeconds: refreshSecondsOf(doc),
      gold: doc.gold,
      silver: doc.silver,
      version: doc.version ?? null,
      updatedAt: doc.updatedAt ?? null,
      updatedBy: doc.updatedBy ?? null,
      // Cotización congelada al publicar: con ella el panel calcula cuánto se
      // ha movido el mercado desde el último cambio.
      fixingAtPublish: doc.fixingAtPublish ?? null,
      source: doc.source,
    })
  }

  if (req.method === 'PUT') {
    if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })
    if (!hasStorage()) return json(res, 503, { error: 'Almacenamiento no disponible' })

    let body
    try {
      body = await readJson(req)
    } catch (err) {
      const msg = err.code === 'BODY_TOO_LARGE' ? 'Los datos enviados son demasiado grandes' : 'Petición no válida'
      return json(res, 400, { error: msg })
    }

    const result = validateFormulas(body)
    if (!result.ok) {
      return json(res, 422, { error: 'Hay valores no válidos', details: result.errors })
    }

    // Bloqueo optimista: si otra persona ha guardado mientras editabas, se
    // rechaza el envío en lugar de pisar sus cambios sin avisar.
    const current = await getFormulas()
    const expected = body.expectedVersion
    if (expected != null && Number(expected) !== Number(current.version ?? 0)) {
      return json(res, 409, {
        error: 'Otra persona ha guardado cambios mientras editabas. Recarga el panel para no pisarlos.',
        currentVersion: current.version ?? null,
        updatedBy: current.updatedBy ?? null,
        updatedAt: current.updatedAt ?? null,
      })
    }

    try {
      const saved = await saveFormulas(result.value, {
        username: session.username,
        ip: clientIp(req),
      })
      return json(res, 200, {
        divisor: saved.divisor,
        refreshSeconds: refreshSecondsOf(saved),
        gold: saved.gold,
        silver: saved.silver,
        version: saved.version,
        updatedAt: saved.updatedAt,
        updatedBy: saved.updatedBy,
        fixingAtPublish: saved.fixingAtPublish ?? null,
      })
    } catch (err) {
      console.error('[formulas] guardado →', err.message)
      return json(res, 500, { error: 'No se han podido guardar los cambios' })
    }
  }

  return methodNotAllowed(res, ['GET', 'PUT'])
}
