// Interpreta un lote dictado como se dicta por teléfono.
//
//   100 18k, 20 14k, 300 9k
//   100gr de 18kts y 0,5 kg de plata 925
//   300 de 9 kilates
//
// La idea es que quien escribe no tenga que aprender ningún formato: se teclea
// lo que se diría en voz alta y el resultado se ve al momento en la tabla, con
// su nombre y su precio. Si algo no se entiende, se dice cuál y por qué, en vez
// de tragarlo en silencio.

const UNIDADES = {
  kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, kilogramos: 1000,
  g: 1, gr: 1, grs: 1, gramo: 1, gramos: 1,
}

// Quilates → milésimas. 18k son 750 milésimas, y así con todo.
const quilatesAMilesimas = (k) => (k / 24) * 1000

// Al comparar leyes hay que dar margen: la tabla puede tener 999,9 o 916,7 y
// por teléfono se dice «999» y «916».
const TOLERANCIA = 3

function numero(texto) {
  const n = Number(String(texto).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Parte el texto en fragmentos, uno por línea del lote.
 *
 * La coma hace dos trabajos —separar y marcar decimales— así que solo separa
 * cuando no está entre cifras: «100,5 de 18k, 20 de 14k» son dos líneas, no
 * tres.
 */
function fragmentar(texto) {
  return String(texto || '')
    .split(/[;\n+]+|,(?!\d)|\s+y\s+/i)
    .map(f => f.trim())
    .filter(Boolean)
}

function buscarLey(fragmento, tablas) {
  const texto = fragmento.toLowerCase()

  // Metal dicho con todas las letras: manda sobre cualquier deducción.
  let metalPedido = null
  if (/\b(plata|ag|silver)\b/.test(texto)) metalPedido = 'silver'
  else if (/\b(oro|au|gold)\b/.test(texto)) metalPedido = 'gold'

  // 1. Quilates: 18k, 18 kt, 18 kilates, 18 quilates…
  const quilates = texto.match(/(\d{1,2})\s*(?:k|kt|kts|kilates?|quilates?)\b/)
  if (quilates) {
    return {
      milesimas: quilatesAMilesimas(Number(quilates[1])),
      metal: metalPedido || 'gold',
      consumido: quilates[0],
      dicho: `${quilates[1]}k`,
    }
  }

  // 2. Milésimas sueltas: 925, 750, 999… Se busca la que exista en la tabla.
  for (const bruto of texto.match(/\d{3,4}(?:[.,]\d+)?/g) || []) {
    const valor = numero(bruto)
    if (valor == null || valor < 300 || valor > 1000) continue
    const encaja = (metal) =>
      (tablas[metal] || []).some(l => Math.abs(Number(l.fineness) - valor) <= TOLERANCIA)

    // Con el metal dicho, no hay nada que adivinar.
    if (metalPedido && encaja(metalPedido)) {
      return { milesimas: valor, metal: metalPedido, consumido: bruto, dicho: bruto }
    }
    if (!metalPedido) {
      // 900 existe en las dos tablas. Sin más pistas gana el oro, que es la
      // mayor parte del negocio, y en la tabla se ve qué se ha entendido.
      if (encaja('gold')) return { milesimas: valor, metal: 'gold', consumido: bruto, dicho: bruto }
      if (encaja('silver')) return { milesimas: valor, metal: 'silver', consumido: bruto, dicho: bruto }
    }
  }

  return null
}

function buscarGramos(fragmento, consumido) {
  // Se quita el trozo que ya se ha usado para la ley: lo que quede es la
  // cantidad.
  const resto = consumido ? fragmento.replace(consumido, ' ') : fragmento
  const m = resto
    .toLowerCase()
    .match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilogramos?|grs?|gramos?|g)?\b/)
  if (!m) return null
  const cantidad = numero(m[1])
  if (cantidad == null || cantidad <= 0) return null
  const factor = UNIDADES[m[2]] ?? 1
  return Math.round(cantidad * factor * 1000) / 1000
}

/**
 * @param {string} texto  Lo que ha escrito la persona.
 * @param {object} tablas { gold: [{key,label,fineness,pricePerGram}], silver: [...] }
 */
export function parsearLote(texto, tablas) {
  const lineas = []

  for (const fragmento of fragmentar(texto)) {
    const ley = buscarLey(fragmento, tablas)
    if (!ley) {
      lineas.push({ texto: fragmento, error: 'No se entiende qué ley es' })
      continue
    }

    const gramos = buscarGramos(fragmento.toLowerCase(), ley.consumido)
    if (gramos == null) {
      lineas.push({ texto: fragmento, error: 'Falta el peso en gramos' })
      continue
    }
    if (gramos > 100000) {
      lineas.push({ texto: fragmento, error: 'Ese peso parece un error (más de 100 kg)' })
      continue
    }

    // De todas las leyes de ese metal, la que más se acerca a lo dicho.
    const candidatas = tablas[ley.metal] || []
    let fila = null
    let mejor = Infinity
    for (const l of candidatas) {
      const distancia = Math.abs(Number(l.fineness) - ley.milesimas)
      if (distancia < mejor) { mejor = distancia; fila = l }
    }

    if (!fila || mejor > TOLERANCIA) {
      lineas.push({
        texto: fragmento,
        error: `No compramos ${ley.dicho}: no está en la tabla`,
      })
      continue
    }

    const precioGramo = Number(fila.pricePerGram)
    lineas.push({
      texto: fragmento,
      metal: ley.metal,
      key: fila.key,
      label: fila.label,
      fineness: Number(fila.fineness),
      gramos,
      precioGramo: Number.isFinite(precioGramo) ? precioGramo : null,
      importe: Number.isFinite(precioGramo) ? gramos * precioGramo : null,
    })
  }

  const validas = lineas.filter(l => !l.error)
  return {
    lineas,
    validas,
    errores: lineas.filter(l => l.error),
    total: validas.reduce((suma, l) => suma + (l.importe || 0), 0),
    gramos: validas.reduce((suma, l) => suma + l.gramos, 0),
  }
}
