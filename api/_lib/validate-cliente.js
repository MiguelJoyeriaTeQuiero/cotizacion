// Validación del alta de cliente.
//
// Misma regla de oro que en las fórmulas: no se copia nada del cuerpo de la
// petición. Se construye un objeto nuevo campo a campo, con su longitud y su
// forma comprobadas, así que lo que llegue de más se queda fuera solo.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const CIF_RE = /^[A-Z0-9][0-9]{7}[A-Z0-9]$/
const CP_RE = /^\d{5}$/
const TEL_RE = /^\+?[\d\s.-]{7,20}$/
const DNI_RE = /^[A-Z0-9]{7,12}$/
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/

export const PASSWORD_MIN = 8
export const CONDICIONES_VERSION = '2026-08'

// Se limpia lo que llega antes de mirarlo: espacios de sobra y caracteres de
// control que no pintan nada en un nombre ni en un CIF.
function limpio(valor, max) {
  return String(valor ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function texto(errores, valor, { campo, etiqueta, min = 2, max = 120, obligatorio = true }) {
  const v = limpio(valor, max)
  if (!v) {
    if (obligatorio) errores.push(`Falta ${etiqueta}`)
    return ''
  }
  if (v.length < min) errores.push(`${etiqueta}: demasiado corto`)
  return v
}

export function validarAlta(input) {
  const errores = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errores: ['El formulario no ha llegado completo'] }
  }

  const e = input.empresa || {}
  const c = input.contacto || {}
  const t = input.titular || {}
  const b = input.cobro || {}

  const empresa = {
    razonSocial: texto(errores, e.razonSocial, { etiqueta: 'la razón social' }),
    cif: limpio(e.cif, 12).toUpperCase().replace(/[\s-]/g, ''),
    nombreComercial: texto(errores, e.nombreComercial, { etiqueta: 'el nombre comercial', max: 80, obligatorio: false }),
    direccion: texto(errores, e.direccion, { etiqueta: 'la dirección fiscal', min: 4, max: 160 }),
    poblacion: texto(errores, e.poblacion, { etiqueta: 'la población', max: 80 }),
    provincia: texto(errores, e.provincia, { etiqueta: 'la provincia', max: 60 }),
    cp: limpio(e.cp, 5),
    iae: texto(errores, e.iae, { etiqueta: 'el epígrafe de IAE', max: 20, obligatorio: false }),
  }
  if (!CIF_RE.test(empresa.cif)) errores.push('El CIF no tiene el formato esperado (por ejemplo B12345678)')
  if (!CP_RE.test(empresa.cp)) errores.push('El código postal debe tener cinco cifras')

  const contacto = {
    persona: texto(errores, c.persona, { etiqueta: 'la persona de contacto', max: 80 }),
    telefono: limpio(c.telefono, 20),
    telefonoTienda: limpio(c.telefonoTienda, 20),
    email: limpio(c.email, 120).toLowerCase(),
  }
  if (!TEL_RE.test(contacto.telefono)) errores.push('El teléfono no parece correcto')
  if (contacto.telefonoTienda && !TEL_RE.test(contacto.telefonoTienda)) {
    errores.push('El teléfono de la tienda no parece correcto')
  }
  if (!EMAIL_RE.test(contacto.email)) errores.push('El correo no parece correcto')

  const titular = {
    nombre: texto(errores, t.nombre, { etiqueta: 'el nombre del administrador', max: 80 }),
    dni: limpio(t.dni, 12).toUpperCase().replace(/[\s-]/g, ''),
  }
  if (!DNI_RE.test(titular.dni)) errores.push('El DNI del administrador no tiene el formato esperado')

  const cobro = { iban: limpio(b.iban, 40).toUpperCase().replace(/[\s-]/g, '') }
  if (!IBAN_RE.test(cobro.iban)) errores.push('El IBAN no tiene el formato esperado')

  const password = String(input.password ?? '')
  if (password.length < PASSWORD_MIN) {
    errores.push(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  }
  if (password.length > 200) errores.push('La contraseña es demasiado larga')

  if (input.condiciones !== true) errores.push('Hay que aceptar las condiciones')

  if (errores.length) return { ok: false, errores }
  return { ok: true, value: { empresa, contacto, titular, cobro }, password }
}

// ─── Documentos ──────────────────────────────────────────────────────────────

export const TIPOS_ADMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
export const TAMANO_MAXIMO = 8 * 1024 * 1024

// Firma real del archivo, que es lo que de verdad dice qué es. La extensión y
// el tipo declarado por el navegador los pone quien sube.
const FIRMAS = [
  { tipo: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },                 // %PDF
  { tipo: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { tipo: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
]

export function tipoRealDe(buffer) {
  for (const firma of FIRMAS) {
    if (firma.bytes.every((b, i) => buffer[i] === b)) return firma.tipo
  }
  // WEBP: "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46]
  const webp = [0x57, 0x45, 0x42, 0x50]
  if (riff.every((b, i) => buffer[i] === b) && webp.every((b, i) => buffer[8 + i] === b)) {
    return 'image/webp'
  }
  return null
}

export function validarDocumento({ etiqueta, nombre, tipo, tamano }) {
  const errores = []
  const limpioNombre = limpio(nombre, 120) || 'documento'
  const limpiaEtiqueta = limpio(etiqueta, 40)

  if (!TIPOS_ADMITIDOS.includes(tipo)) errores.push('Solo se admiten PDF, JPG, PNG y WEBP')
  const bytes = Number(tamano)
  if (!Number.isFinite(bytes) || bytes <= 0) errores.push('El archivo parece vacío')
  if (bytes > TAMANO_MAXIMO) errores.push('El archivo pasa de 8 MB')

  if (errores.length) return { ok: false, errores }
  return {
    ok: true,
    value: {
      etiqueta: limpiaEtiqueta || limpioNombre,
      nombre: limpioNombre,
      tipo,
      tamano: Math.round(bytes),
    },
  }
}
