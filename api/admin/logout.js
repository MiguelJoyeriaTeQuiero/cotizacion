import { json, methodNotAllowed, isSameOrigin } from '../_lib/http.js'
import { endSession } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  if (!isSameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' })

  await endSession(req, res)
  return json(res, 200, { ok: true })
}
