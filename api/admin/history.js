import { json, methodNotAllowed } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'
import { getHistory } from '../_lib/store.js'

// Registro de cambios: quién guardó, cuándo y con qué valores.
// Sirve tanto de auditoría como de mecanismo para volver atrás.
export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const session = await requireSession(req, res)
  if (!session) return

  const entries = await getHistory()
  return json(res, 200, { entries })
}
