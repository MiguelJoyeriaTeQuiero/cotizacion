// El justificante de un cierre: en PDF para el cliente y en CSV para el ERP.
//
// Los dos salen del mismo sitio a propósito. Es el documento que acredita a
// cuánto se cerró y por cuántos gramos, así que si algún día el papel y lo que
// entra en contabilidad no cuadran, no puede ser porque se calcularan en dos
// lados distintos.
//
// No es una factura y lo dice él mismo: la factura la sigue emitiendo el ERP.

import { Pagina, documento } from './pdf.js'

const DECIMALES = { gold: 2, silver: 3 }

const nf = (dec) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// Para el papel, con separador de miles; para el ERP, sin él: un punto de más
// en «113.724,40» es lo que hace que una importación se coma un cero.
const nfPlano = (dec) => new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false,
})

const num = (v, dec = 2) => (Number.isFinite(Number(v)) ? nf(dec).format(Number(v)) : '—')
const plano = (v, dec = 2) => (Number.isFinite(Number(v)) ? nfPlano(dec).format(Number(v)) : '')
const euros = (v, dec = 2) => `${num(v, dec)} €`

function fecha(iso, conHora = true) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dia = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  if (!conHora) return dia
  const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(d)
  return `${dia} · ${hora}`
}

// Lo que se le llama a cada estado en un papel que se guarda.
const ESTADOS = {
  confirmado: 'Cierre confirmado',
  pendiente: 'Solicitud pendiente de confirmar',
  rechazado: 'Solicitud rechazada',
  anulado: 'Solicitud anulada por el cliente',
}

const MARGEN = 48
const ANCHO = 595.28
const DERECHA = ANCHO - MARGEN

/**
 * @param {object} cierre    El cierre tal y como está guardado.
 * @param {object} [empresa] La ficha del cliente, si se tiene: aporta la
 *                           dirección fiscal, que en el cierre no se guarda.
 */
export function pdfCierre(cierre, empresa = null) {
  const p = new Pagina()
  const dec = (l) => DECIMALES[l.metal] ?? 2
  let y = 64

  // ── Cabecera ──────────────────────────────────────────────────────────────
  p.texto(MARGEN, y, 'TE QUIERO METALES', { tamano: 13, negrita: true })
  p.texto(DERECHA, y, (ESTADOS[cierre.estado] || 'Cierre').toUpperCase(), {
    tamano: 8, negrita: true, gris: 0.45, derecha: true,
  })
  y += 14
  p.texto(MARGEN, y, 'Compra de oro, plata y brillantes al por mayor', { tamano: 8.5, gris: 0.45 })
  p.texto(DERECHA, y, cierre.ref, { tamano: 13, negrita: true, derecha: true })

  y += 16
  p.regla(MARGEN, y, DERECHA, { grosor: 1, gris: 0.2 })

  // ── Cliente y operación, a dos columnas ───────────────────────────────────
  y += 26
  const col2 = 320
  p.texto(MARGEN, y, 'CLIENTE', { tamano: 7.5, negrita: true, gris: 0.5 })
  p.texto(col2, y, 'LA OPERACIÓN', { tamano: 7.5, negrita: true, gris: 0.5 })

  y += 15
  const izquierda = [
    [cierre.cliente?.razonSocial, true],
    [cierre.cliente?.cif],
    [empresa?.empresa?.direccion],
    [[empresa?.empresa?.cp, empresa?.empresa?.poblacion].filter(Boolean).join(' ')],
    [empresa?.empresa?.provincia],
    [[cierre.cliente?.persona, cierre.cliente?.telefono].filter(Boolean).join(' · ')],
  ].filter(([t]) => t)

  const derecha = [
    ['Solicitado', fecha(cierre.creadoEn)],
    ...(cierre.decididoEn ? [['Confirmado', fecha(cierre.decididoEn)]] : []),
    ['Cotización congelada', ''],
    ['   Oro', `${num(cierre.fixing?.gold)} € la onza`],
    ['   Plata', `${num(cierre.fixing?.silver)} € la onza`],
    ...(cierre.ajustadoEn ? [['Lote ajustado', fecha(cierre.ajustadoEn)]] : []),
  ]

  const filas = Math.max(izquierda.length, derecha.length)
  for (let i = 0; i < filas; i++) {
    const linea = y + i * 13
    if (izquierda[i]) {
      p.texto(MARGEN, linea, izquierda[i][0], { tamano: 9.5, negrita: Boolean(izquierda[i][1]) })
    }
    if (derecha[i]) {
      p.texto(col2, linea, derecha[i][0], { tamano: 9.5, gris: 0.4 })
      p.texto(DERECHA, linea, derecha[i][1], { tamano: 9.5, derecha: true })
    }
  }
  y += filas * 13 + 18

  // ── El lote ───────────────────────────────────────────────────────────────
  const xGramos = 300
  const xPrecio = 410

  p.texto(MARGEN, y, 'EL LOTE', { tamano: 7.5, negrita: true, gris: 0.5 })
  y += 16

  p.rectangulo(MARGEN, y - 10, DERECHA - MARGEN, 18, { gris: 0.94 })
  p.texto(MARGEN + 6, y, 'LEY', { tamano: 7.5, negrita: true, gris: 0.4 })
  p.texto(xGramos, y, 'GRAMOS', { tamano: 7.5, negrita: true, gris: 0.4, derecha: true })
  p.texto(xPrecio, y, '€ / GRAMO', { tamano: 7.5, negrita: true, gris: 0.4, derecha: true })
  p.texto(DERECHA - 6, y, 'IMPORTE', { tamano: 7.5, negrita: true, gris: 0.4, derecha: true })
  y += 12

  for (const l of cierre.lineas || []) {
    y += 15
    p.texto(MARGEN + 6, y, l.label, { tamano: 10 })
    p.texto(xGramos, y, num(l.gramos, 2), { tamano: 10, derecha: true })
    p.texto(xPrecio, y, euros(l.precioGramo, dec(l)), { tamano: 10, derecha: true })
    p.texto(DERECHA - 6, y, euros(l.importe), { tamano: 10, derecha: true })
    if (l.precioManual) {
      y += 10
      p.texto(xPrecio, y, `precio acordado · tarifa ${euros(l.precioTarifa, dec(l))}`, {
        tamano: 7.5, gris: 0.5, derecha: true,
      })
    }
    p.regla(MARGEN, y + 5, DERECHA, { gris: 0.85 })
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  y += 26
  p.texto(MARGEN + 6, y, `${num(cierre.gramos, 2)} gramos en total`, { tamano: 10, gris: 0.35 })
  p.texto(DERECHA - 6, y, euros(cierre.total), { tamano: 17, negrita: true, derecha: true })
  y += 10
  p.regla(MARGEN, y, DERECHA, { grosor: 1, gris: 0.2 })

  // ── Lo que se pidió, si se ajustó ─────────────────────────────────────────
  if (cierre.pedido) {
    y += 18
    p.texto(MARGEN, y, 'Lote ajustado al revisarlo. Lo solicitado fueron ' +
      `${num(cierre.pedido.gramos, 2)} gramos por ${euros(cierre.pedido.total)}.`, {
      tamano: 8.5, gris: 0.4,
    })
  }

  if (cierre.nota) {
    y += 16
    p.texto(MARGEN, y, `Nota: ${cierre.nota}`.slice(0, 150), { tamano: 8.5, gris: 0.4 })
  }

  // ── Pie ───────────────────────────────────────────────────────────────────
  const pie = 780
  p.regla(MARGEN, pie - 14, DERECHA, { gris: 0.85 })
  p.texto(MARGEN, pie, 'Este documento acredita el precio cerrado y los gramos acordados. No es una factura:', {
    tamano: 8, gris: 0.45,
  })
  p.texto(MARGEN, pie + 11, 'la factura y el pago siguen su curso habitual.', { tamano: 8, gris: 0.45 })
  p.texto(DERECHA, pie, `Emitido el ${fecha(new Date().toISOString())}`, { tamano: 8, gris: 0.45, derecha: true })
  if (cierre.formulasVersion != null) {
    p.texto(DERECHA, pie + 11, `Tarifa versión ${cierre.formulasVersion}`, { tamano: 8, gris: 0.45, derecha: true })
  }

  return documento(p, { titulo: `${cierre.ref} · Justificante de cierre`, autor: 'Te Quiero Metales' })
}

/**
 * El bloque para el ERP: una línea del lote por fila, con la referencia y el
 * cliente repetidos para que cada fila valga por sí sola.
 *
 * Punto y coma y coma decimal, que es lo que espera un Excel en español sin
 * tener que tocar nada al abrirlo.
 */
export function csvCierre(cierre) {
  const dec = (l) => DECIMALES[l.metal] ?? 2
  const campos = [
    'referencia', 'estado', 'fecha_solicitud', 'fecha_confirmacion', 'cif', 'razon_social',
    'metal', 'ley', 'milesimas', 'gramos', 'precio_gramo', 'importe', 'precio_acordado',
  ]

  const escapa = (v) => {
    const t = String(v ?? '')
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }

  const filas = (cierre.lineas || []).map(l => [
    cierre.ref,
    cierre.estado,
    cierre.creadoEn ?? '',
    cierre.decididoEn ?? '',
    cierre.cliente?.cif ?? '',
    cierre.cliente?.razonSocial ?? '',
    l.metal === 'silver' ? 'plata' : 'oro',
    l.label,
    l.fineness ?? '',
    plano(l.gramos, 3),
    plano(l.precioGramo, dec(l)),
    plano(l.importe, 2),
    l.precioManual ? 'si' : 'no',
  ].map(escapa).join(';'))

  return [campos.join(';'), ...filas].join('\r\n') + '\r\n'
}
