import { json, methodNotAllowed } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

// Lo usa el panel al cargar para saber si ya hay sesión abierta.
export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const session = await requireSession(req, res)
  if (!session) return

  return json(res, 200, {
    user: { username: session.username, name: session.name },
  })
}
