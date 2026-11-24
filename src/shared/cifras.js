// Leer lo que se teclea en una casilla de cifras del panel.
//
// En un archivo aparte, sin nada más, para que se pueda usar en cualquier
// pantalla sin arrastrar el resto del formato.

/**
 * Lee una cifra tecleada, a la española o no: «3.950», «3950,5», «3.950,50»,
 * «3950.50», «3 950». Con punto y coma a la vez, el último es el decimal. Con
 * solo puntos, son de millar si van cada tres cifras («3.950», «1.234.567») y
 * decimal si no («31.25»): quien escribe un fixing pone «3.950», no 3,95. Con
 * solo una coma, es decimal. Lo que no se entiende, null.
 */
export function leerCifra(texto) {
  let t = String(texto ?? '').replace(/\s/g, '')
  if (!t) return null
  const punto = t.lastIndexOf('.'), coma = t.lastIndexOf(',')
  if (punto >= 0 && coma >= 0) {
    // El separador que va último es el decimal; el otro, de millar.
    const [millar, decimal] = coma > punto ? ['.', ','] : [',', '.']
    const re = millar === '.' ? /^-?[1-9]\d{0,2}(\.\d{3})*,\d+$/ : /^-?[1-9]\d{0,2}(,\d{3})*\.\d+$/
    if (!re.test(t)) return null
    t = t.split(millar).join('').replace(decimal, '.')
  } else if (punto >= 0) {
    if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.split('.').join('')
  } else if (coma >= 0) {
    if (t.indexOf(',') !== coma) return null
    t = t.replace(',', '.')
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
