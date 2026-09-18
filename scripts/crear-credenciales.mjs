#!/usr/bin/env node
//
// OPCIONAL. Convierte una contraseña en un hash scrypt, por si prefieres que la
// contraseña del panel no aparezca en claro en las variables de entorno.
//
//   npm run credenciales -- miguel "Miguel Rodríguez"
//
// El panel funciona igual de bien con la contraseña en texto plano en
// ADMIN_PASSWORD; esto es solo un extra. La contraseña se pide por teclado y NO
// se muestra, NO se guarda en ningún archivo y NO queda en el historial del
// terminal: lo único que se imprime es el hash, del que no se puede reconstruir.

import readline from 'node:readline'
import { hashPassword } from '../api/_lib/crypto.js'

const [, , usernameArg, nameArg] = process.argv

if (!usernameArg) {
  console.error('Uso: node scripts/crear-credenciales.mjs <usuario> ["Nombre visible"]')
  process.exit(1)
}

const username = usernameArg.trim().toLowerCase()
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error('El usuario debe tener entre 3 y 32 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
  process.exit(1)
}
const name = (nameArg || usernameArg).trim()

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) {
        process.stdin.removeListener('data', onData)
      } else {
        // Reescribe la línea sin revelar lo tecleado.
        process.stdout.write('\x1b[2K\x1b[200D' + question)
      }
    }
    process.stdin.on('data', onData)
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

const password = await askHidden('Contraseña nueva: ')
if (password.length < 8) {
  console.error('\nLa contraseña debe tener al menos 8 caracteres.')
  process.exit(1)
}
const repeat = await askHidden('Repite la contraseña: ')
if (password !== repeat) {
  console.error('\nLas contraseñas no coinciden.')
  process.exit(1)
}

const hash = hashPassword(password)

console.log('\n─────────────────────────────────────────────────────────────')
console.log('Una sola cuenta — pega estas tres líneas en .env.local o en Vercel:\n')
console.log(`ADMIN_USER=${username}`)
console.log(`ADMIN_NAME=${name}`)
console.log(`ADMIN_PASSWORD=${hash}`)
console.log('\n─────────────────────────────────────────────────────────────')
console.log('Varias cuentas — usa ADMIN_USERS, todo en UNA SOLA LÍNEA:\n')
console.log(`ADMIN_USERS=${JSON.stringify([{ username, name, password: hash }])}`)
console.log('\nPara añadir esta cuenta a otras que ya existan, mete su bloque')
console.log('dentro de los mismos corchetes, separado por una coma.')
console.log('─────────────────────────────────────────────────────────────\n')
