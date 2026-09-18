// Deja lista una cuenta de cliente aprobada para probar el portal en local.
//
//   npm run dev                                  (en una terminal)
//   npm run demo                                 (en otra)
//   npm run demo -- correo@tienda.es contraseña  (una cuenta a medida)
//   npm run demo -- 3001                         (si Vite eligió otro puerto)
//
// El almacén en memoria vive dentro del servidor de desarrollo, así que la
// cuenta se crea llamando a su propia API: por eso hace falta que esté
// levantado. Al reiniciarlo se pierde, y basta con volver a ejecutar esto.
//
// En Vercel no funciona: la acción solo existe en desarrollo local.

const args = process.argv.slice(2)

// Los argumentos se reconocen por lo que son, sin banderas que recordar: el
// número es el puerto, lo que lleva arroba es el correo y lo que venga detrás,
// la contraseña.
const puerto = args.find(a => /^\d+$/.test(a)) || process.env.PORT || '3000'
const email = args.find(a => a.includes('@'))
const password = email ? args[args.indexOf(email) + 1] : undefined
const base = `http://localhost:${puerto}`

if (email && !password) {
  console.error('\n  Falta la contraseña: `npm run demo -- correo@tienda.es contraseña`\n')
  process.exit(1)
}

console.log(`\nBuscando el servidor de desarrollo en ${base} …`)

let res
try {
  res = await fetch(`${base}/api/portal/cuenta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // La comprobación de origen exige que la petición venga del mismo sitio.
      Origin: base,
    },
    body: JSON.stringify({ accion: 'demo', email, password }),
  })
} catch {
  console.error(
    `\n  No hay nada escuchando en ${base}.\n` +
    '  Arranca el servidor con `npm run dev` y vuelve a intentarlo.\n' +
    '  Si Vite eligió otro puerto, pásalo: `npm run demo -- 3001`\n'
  )
  process.exit(1)
}

const data = await res.json().catch(() => ({}))

if (!res.ok) {
  console.error(`\n  El servidor ha respondido ${res.status}: ${data.error || 'sin detalle'}\n`)
  process.exit(1)
}

console.log(`
  Cliente de prueba listo y APROBADO.

    Portal      ${base}/portal
    Correo      ${data.email}
    Contraseña  ${data.password}

  Ya puede pedir cierres: los gramos se ponen en la casilla de cada ley y la
  solicitud aparecerá en el panel, en Cierres, para confirmarla.
`)
