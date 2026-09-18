import { hashPassword, verifyPassword, checkPassword, burnPasswordTime } from '../../api/_lib/crypto.js'
import { validateFormulas } from '../../api/_lib/validate.js'
import { DEFAULT_FORMULAS, gradePrice, refreshSecondsOf } from '../../api/_lib/defaults.js'
import { parsearLote } from '../../src/shared/lote.js'

let fails = 0
const check = (name, cond) => {
  console.log(`${cond ? 'OK  ' : 'FALLA'}  ${name}`)
  if (!cond) fails++
}

// ── Contraseñas ──
const h = hashPassword('una-frase-larga-y-secreta-2026')
check('hash con formato scrypt$', h.startsWith('scrypt$16384$8$1$'))
check('verifica la contraseña correcta', verifyPassword('una-frase-larga-y-secreta-2026', h) === true)
check('rechaza la contraseña incorrecta', verifyPassword('una-frase-larga-y-secreta-2025', h) === false)
check('rechaza hash corrupto', verifyPassword('x', 'basura') === false)
check('rechaza hash vacío', verifyPassword('x', '') === false)
const h2 = hashPassword('una-frase-larga-y-secreta-2026')
check('mismo password → hash distinto (salt aleatoria)', h !== h2 && verifyPassword('una-frase-larga-y-secreta-2026', h2))

const t0 = Date.now(); verifyPassword('nope', h); const tReal = Date.now() - t0
const t1 = Date.now(); burnPasswordTime('nope'); const tFake = Date.now() - t1
check(`tiempos comparables usuario real (${tReal}ms) vs inexistente (${tFake}ms)`, Math.abs(tReal - tFake) < Math.max(60, tReal))

// ── Contraseña en texto plano (modo sencillo) ──
check('acepta la contraseña en texto plano', checkPassword('TeQuiero2026', 'TeQuiero2026') === true)
check('rechaza una contraseña distinta', checkPassword('TeQuiero2025', 'TeQuiero2026') === false)
check('rechaza contraseña vacía', checkPassword('', '') === false)
check('distingue mayúsculas', checkPassword('tequiero2026', 'TeQuiero2026') === false)
check('sigue aceptando hashes scrypt', checkPassword('una-frase-larga-y-secreta-2026', h) === true)
check('rechaza hash scrypt con contraseña mala', checkPassword('otra', h) === false)

// ── Validación ──
const ok = validateFormulas({ divisor: 31.1, gold: DEFAULT_FORMULAS.gold, silver: DEFAULT_FORMULAS.silver })
check('acepta el documento por defecto', ok.ok === true)
check('normaliza a solo campos conocidos', ok.ok && Object.keys(ok.value.gold[0]).sort().join() === 'f1,f2,f3,fineness,key,label')

const inject = validateFormulas({
  divisor: 31.1,
  gold: [{ key: 'au24', label: 'Oro', fineness: 999, f1: 1, f2: 1, __proto__: { pwned: true }, extra: 'x' }],
  silver: DEFAULT_FORMULAS.silver,
})
check('descarta campos extra', inject.ok && inject.value.gold[0].extra === undefined)
check('no contamina Object.prototype', ({}).pwned === undefined)

check('rechaza factor absurdo', validateFormulas({ divisor: 31.1, gold: [{ key: 'a1', label: 'x', fineness: 999, f1: 99, f2: 1 }], silver: DEFAULT_FORMULAS.silver }).ok === false)
check('rechaza ley negativa', validateFormulas({ divisor: 31.1, gold: [{ key: 'a1', label: 'x', fineness: -5, f1: 1, f2: 1 }], silver: DEFAULT_FORMULAS.silver }).ok === false)
check('rechaza divisor 0', validateFormulas({ divisor: 0, gold: DEFAULT_FORMULAS.gold, silver: DEFAULT_FORMULAS.silver }).ok === false)
check('rechaza tabla vacía', validateFormulas({ divisor: 31.1, gold: [], silver: DEFAULT_FORMULAS.silver }).ok === false)
check('rechaza claves duplicadas', validateFormulas({ divisor: 31.1, gold: [{ key: 'a1', label: 'x', fineness: 999, f1: 1, f2: 1 }, { key: 'a1', label: 'y', fineness: 900, f1: 1, f2: 1 }], silver: DEFAULT_FORMULAS.silver }).ok === false)
check('rechaza nombre gigante', validateFormulas({ divisor: 31.1, gold: [{ key: 'a1', label: 'x'.repeat(500), fineness: 999, f1: 1, f2: 1 }], silver: DEFAULT_FORMULAS.silver }).ok === false)
check('rechaza más de 24 filas', validateFormulas({ divisor: 31.1, gold: Array.from({length:25},(_,i)=>({key:`a${i}b`,label:'x',fineness:999,f1:1,f2:1})), silver: DEFAULT_FORMULAS.silver }).ok === false)
check('rechaza cuerpo no objeto', validateFormulas('hola').ok === false)

// ── Frecuencia de consulta de precios ──
const base = { divisor: 31.1, gold: DEFAULT_FORMULAS.gold, silver: DEFAULT_FORMULAS.silver }
check('acepta una frecuencia válida', validateFormulas({ ...base, refreshSeconds: 300 }).value?.refreshSeconds === 300)
check('sin frecuencia usa el valor por defecto', validateFormulas(base).value?.refreshSeconds === 60)
check('rechaza frecuencia demasiado corta', validateFormulas({ ...base, refreshSeconds: 5 }).ok === false)
check('rechaza frecuencia de más de un día', validateFormulas({ ...base, refreshSeconds: 90000 }).ok === false)
check('rechaza frecuencia no numérica', validateFormulas({ ...base, refreshSeconds: 'a ratos' }).ok === false)
check('acepta el mínimo y el máximo exactos',
  validateFormulas({ ...base, refreshSeconds: 30 }).value?.refreshSeconds === 30 &&
  validateFormulas({ ...base, refreshSeconds: 86400 }).value?.refreshSeconds === 86400)
check('documento antiguo sin el ajuste → valor por defecto', refreshSecondsOf({ divisor: 31.1 }) === 60)
check('acota un valor guardado fuera de rango', refreshSecondsOf({ refreshSeconds: 1 }) === 30)

// ── Factor 3: ajuste fijo en € por gramo ──
const conF3 = (f3) => validateFormulas({
  divisor: 31.1,
  gold: [{ key: 'au24', label: 'Oro 24k', fineness: 999.9, f1: 1, f2: 1, f3 }],
  silver: DEFAULT_FORMULAS.silver,
})
check('acepta un factor 3 negativo', conF3(-0.05).value?.gold[0].f3 === -0.05)
check('acepta un factor 3 positivo', conF3(0.1).value?.gold[0].f3 === 0.1)
check('acepta el factor 3 con coma española', conF3('-0,05').value?.gold[0].f3 === -0.05)
check('sin factor 3 vale 0', validateFormulas({
  divisor: 31.1,
  gold: [{ key: 'au24', label: 'Oro 24k', fineness: 999.9, f1: 1, f2: 1 }],
  silver: DEFAULT_FORMULAS.silver,
}).value?.gold[0].f3 === 0)
check('rechaza un factor 3 desproporcionado', conF3(-500).ok === false)
check('rechaza un factor 3 no numérico', conF3('un poco menos').ok === false)

// El factor 3 resta del precio final, no del fixing ni de los multiplicadores.
const filaF3 = { key: 'au24', label: 'Oro 24k', fineness: 1000, f1: 1, f2: 1, f3: -0.05 }
const sinF3 = { ...filaF3, f3: 0 }
check('el factor 3 resta del € / gramo final',
  Math.abs((gradePrice(3110, sinF3, 31.1) - gradePrice(3110, filaF3, 31.1)) - 0.05) < 1e-12)
check('un factor 3 positivo suma',
  Math.abs((gradePrice(3110, { ...filaF3, f3: 0.2 }, 31.1) - gradePrice(3110, sinF3, 31.1)) - 0.2) < 1e-12)
check('una fila sin factor 3 calcula como siempre', gradePrice(3110, { key: 'x', fineness: 1000, f1: 1, f2: 1 }, 31.1) === 100)
check('el precio nunca sale negativo', gradePrice(3110, { ...filaF3, f3: -100 }, 31.1) === 0)
check('rechaza NaN', validateFormulas({ divisor: 'abc', gold: DEFAULT_FORMULAS.gold, silver: DEFAULT_FORMULAS.silver }).ok === false)
check('acepta coma decimal española', validateFormulas({ divisor: '31,1', gold: [{ key: 'a1', label: 'x', fineness: '999,9', f1: '0,993', f2: '0,99' }], silver: DEFAULT_FORMULAS.silver }).value?.gold[0].f1 === 0.993)

// ── Cálculo idéntico al de la web anterior ──
// ── Intérprete de lotes ──
//
// Es lo que traduce lo que se dicta por teléfono. Cada caso de aquí es una
// forma real de decirlo.
const TABLAS = {
  gold: [
    { key: 'au24', label: 'Oro 24k', fineness: 999.9, pricePerGram: 108.14 },
    { key: 'au22', label: 'Oro 22k', fineness: 916.7, pricePerGram: 98.1 },
    { key: 'au216', label: 'Oro 21,6k', fineness: 900, pricePerGram: 96.8 },
    { key: 'au18', label: 'Oro 18k', fineness: 750, pricePerGram: 78.55 },
    { key: 'au14', label: 'Oro 14k', fineness: 585, pricePerGram: 60.68 },
    { key: 'au9', label: 'Oro 9k', fineness: 375, pricePerGram: 38.9 },
  ],
  silver: [
    { key: 'ag1000', label: 'Plata 1000', fineness: 1000, pricePerGram: 0.83 },
    { key: 'ag925', label: 'Plata 925', fineness: 925, pricePerGram: 0.719 },
    { key: 'ag900', label: 'Plata 900', fineness: 900, pricePerGram: 0.661 },
  ],
}
const lote = (texto) => parsearLote(texto, TABLAS)

let r = lote('100 18k, 20 14k, 300 9k')
check('el dictado de siempre se entiende entero', r.validas.length === 3 && r.errores.length === 0)
check('cada línea lleva su ley y su peso',
  r.validas[0].key === 'au18' && r.validas[0].gramos === 100 &&
  r.validas[1].key === 'au14' && r.validas[1].gramos === 20 &&
  r.validas[2].key === 'au9' && r.validas[2].gramos === 300)
check('el total suma lo que debe', Math.abs(r.total - (100 * 78.55 + 20 * 60.68 + 300 * 38.9)) < 1e-9)

check('«100gr de 18kts»', lote('100gr de 18kts').validas[0]?.key === 'au18')
check('«300 de 9 kilates»', lote('300 de 9 kilates').validas[0]?.key === 'au9')
check('«20 quilates» no está en la tabla', lote('50 de 20 quilates').errores.length === 1)

// La coma hace dos trabajos: separar líneas y marcar decimales.
r = lote('100,5 de 18k, 20 de 14k')
check('la coma decimal no parte la línea', r.validas.length === 2 && r.validas[0].gramos === 100.5)

check('los kilos se pasan a gramos', lote('0,5 kg de plata 925').validas[0]?.gramos === 500)
check('«2 kilos»', lote('2 kilos de 18k').validas[0]?.gramos === 2000)
check('la «y» también separa', lote('100 18K y 20 14k').validas.length === 2)
check('el signo + también separa', lote('100 18k + 20 14k').validas.length === 2)

// Milésimas dichas a secas, con el redondeo de la tabla.
check('«999» es el 24k de la tabla (999,9)', lote('50 de 999').validas[0]?.key === 'au24')
check('«916» es el 22k de la tabla (916,7)', lote('100 de 916').validas[0]?.key === 'au22')
check('«925» sin decir el metal se entiende como plata', lote('1,2kg de 925').validas[0]?.key === 'ag925')
check('decir «plata 900» no lo confunde con el oro de 900',
  lote('300 de plata 900').validas[0]?.key === 'ag900')

// Lo que no se entiende se dice, no se traga.
check('sin ley no hay línea válida', lote('cien gramos de oro').errores.length === 1)
check('una ley que no compramos se avisa', lote('20 de 12k').errores[0]?.error.includes('12k'))
check('un peso disparatado se rechaza', lote('500 kilos de 18k').errores.length === 1)
check('el texto vacío no da líneas', lote('   ').lineas.length === 0)

const legacy = (fix, g) => (g.fineness / 1000) * fix * g.f1 * g.f2 / 31.1
let sameMath = true
for (const g of [...DEFAULT_FORMULAS.gold, ...DEFAULT_FORMULAS.silver]) {
  const fix = g.key.startsWith('au') ? 3082 : 29.92
  if (Math.abs(gradePrice(fix, g, 31.1) - legacy(fix, g)) > 1e-12) sameMath = false
}
check('los precios coinciden exactamente con la fórmula anterior', sameMath)
console.log('\n  Oro 24k @ fixing 3082 €/oz →', gradePrice(3082, DEFAULT_FORMULAS.gold[0], 31.1).toFixed(2), '€/g')
console.log('  Plata 925 @ fixing 29,92 €/oz →', gradePrice(29.92, DEFAULT_FORMULAS.silver[1], 31.1).toFixed(3), '€/g')

console.log(fails === 0 ? '\nTodas las comprobaciones pasan.' : `\n${fails} COMPROBACIONES FALLIDAS`)
process.exit(fails === 0 ? 0 : 1)
