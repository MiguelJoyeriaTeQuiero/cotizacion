// Un PDF de una página, escrito a mano.
//
// No hay librería detrás y es a propósito: un justificante de cierre es media
// docena de líneas de texto y unas reglas, y meter un paquete de 300 KB en una
// función sin servidor para eso sale más caro que escribirlo. Aquí solo se usa
// lo que trae el formato de serie —las fuentes base, que están en cualquier
// lector— así que el archivo pesa unos pocos kilobytes y no depende de nada.
//
// Cubre lo que hace falta y nada más: texto en dos pesos, alineado a izquierda
// o derecha, reglas horizontales y rectángulos en gris. Si algún día hace falta
// más de una página o una imagen, esto se queda corto y toca cambiarlo.

// Anchos de las fuentes base (AFM, milésimas de em) del 32 al 126. Sirven para
// alinear a la derecha: sin medir el texto no se puede cuadrar una columna de
// importes, que es justo lo que tiene que quedar bien en este documento.
const ANCHOS_NORMAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const ANCHOS_NEGRITA = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]
const ANCHO_POR_DEFECTO = 556

// Los caracteres del 0x80 al 0x9F no son latin-1: WinAnsi mete ahí el euro, las
// comillas tipográficas y las rayas. Sin esta tabla, un importe en euros sale
// con un cuadradito.
const WINANSI = new Map(Object.entries({
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}))

function aWinAnsi(texto) {
  let salida = ''
  for (const c of String(texto)) {
    const especial = WINANSI.get(c)
    if (especial != null) { salida += String.fromCharCode(especial); continue }
    const punto = c.codePointAt(0)
    salida += punto <= 0xff ? c : '?'
  }
  return salida
}

const escapar = (texto) => aWinAnsi(texto).replace(/([\\()])/g, '\\$1')

/** Ancho de un texto en puntos, para poder alinearlo a la derecha. */
export function ancho(texto, tamano, negrita = false) {
  const tabla = negrita ? ANCHOS_NEGRITA : ANCHOS_NORMAL
  let total = 0
  for (const c of aWinAnsi(texto)) {
    const codigo = c.charCodeAt(0)
    total += codigo >= 32 && codigo <= 126 ? tabla[codigo - 32] : ANCHO_POR_DEFECTO
  }
  return (total * tamano) / 1000
}

/**
 * Una página en construcción. Las coordenadas son las del PDF —el origen abajo
 * a la izquierda— pero la página se escribe de arriba abajo, así que `y` se
 * cuenta desde arriba y se le da la vuelta al escribir.
 */
export class Pagina {
  constructor({ ancho: w = 595.28, alto = 841.89 } = {}) {
    this.w = w
    this.h = alto
    this.ops = []
  }

  /** Texto. `x` es el borde izquierdo, o el derecho si se alinea a la derecha. */
  texto(x, y, texto, { tamano = 10, negrita = false, gris = 0, derecha = false } = {}) {
    const cadena = String(texto ?? '')
    if (!cadena) return this
    const izquierda = derecha ? x - ancho(cadena, tamano, negrita) : x
    this.ops.push(
      `BT ${gris.toFixed(3)} g /${negrita ? 'F2' : 'F1'} ${tamano} Tf ` +
      `1 0 0 1 ${izquierda.toFixed(2)} ${(this.h - y).toFixed(2)} Tm (${escapar(cadena)}) Tj ET`
    )
    return this
  }

  /** Regla horizontal. El grosor fino es el que da el aire de libro de cuentas. */
  regla(x1, y, x2, { grosor = 0.5, gris = 0.75 } = {}) {
    this.ops.push(
      `${gris.toFixed(3)} G ${grosor} w ${x1.toFixed(2)} ${(this.h - y).toFixed(2)} m ` +
      `${x2.toFixed(2)} ${(this.h - y).toFixed(2)} l S`
    )
    return this
  }

  rectangulo(x, y, w, alto, { gris = 0.95 } = {}) {
    this.ops.push(
      `${gris.toFixed(3)} g ${x.toFixed(2)} ${(this.h - y - alto).toFixed(2)} ` +
      `${w.toFixed(2)} ${alto.toFixed(2)} re f`
    )
    return this
  }

  contenido() {
    return this.ops.join('\n')
  }
}

/**
 * Cierra el documento y devuelve los bytes.
 *
 * La tabla xref lleva la posición exacta de cada objeto dentro del archivo, así
 * que hay que ir midiendo en bytes conforme se escribe: por eso se va montando
 * sobre buffers y no sobre una cadena.
 */
export function documento(pagina, { titulo = '', autor = '' } = {}) {
  const contenido = pagina.contenido()
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pagina.w.toFixed(2)} ${pagina.h.toFixed(2)}] ` +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(aWinAnsi(contenido), 'latin1')} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${escapar(titulo)}) /Producer (Te Quiero Metales) /Creator (${escapar(autor)}) >>`,
  ]

  const trozos = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
  let posicion = trozos[0].length
  const posiciones = []

  objetos.forEach((cuerpo, i) => {
    posiciones.push(posicion)
    const trozo = Buffer.from(aWinAnsi(`${i + 1} 0 obj\n${cuerpo}\nendobj\n`), 'latin1')
    trozos.push(trozo)
    posicion += trozo.length
  })

  const inicioXref = posicion
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const p of posiciones) xref += `${String(p).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${objetos.length} 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF\n`
  trozos.push(Buffer.from(xref, 'latin1'))

  return Buffer.concat(trozos)
}
