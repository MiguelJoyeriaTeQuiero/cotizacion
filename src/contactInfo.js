// Datos de contacto de la web pública, en un solo sitio.
//
// La cabecera, el pie y la sección de contacto muestran lo mismo, así que un
// cambio de teléfono o de correo se hace aquí una vez y aparece en los tres.

export const PHONES = [
  { label: '922 263 470', tel: '922263470' },
  { label: '618 714 261', tel: '618714261' },
]

export const EMAIL_GENERAL = 'contabilidad@tequierometales.com'
export const EMAIL_HERRAMIENTAS = 'herramientas@tequierometales.com'

export const EMAILS = [EMAIL_GENERAL, EMAIL_HERRAMIENTAS]

export const ADDRESS = {
  street: 'Camino San Miguel de Geneto 66, Local C',
  city: '38296 · Santa Cruz de Tenerife',
}

// ─── Abrir el formulario de contacto desde otra sección ──────────────────────
// Mismo patrón que el aviso de cookies: un evento en window, sin pasar props
// por media aplicación. Quien lo escucha es <Contact />.

export const OPEN_CONTACT_FORM_EVENT = 'tqm-open-contact-form'

/**
 * Lleva al formulario de contacto y lo prepara para un destinatario concreto.
 * @param {string} destino Correo al que va dirigido el mensaje.
 */
export function openContactForm(destino = EMAIL_GENERAL) {
  window.dispatchEvent(new CustomEvent(OPEN_CONTACT_FORM_EVENT, { detail: { destino } }))
  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })
}
