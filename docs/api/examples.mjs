// Datos exclusivamente sintéticos. No leer .env ni expedientes para documentar.
export const snapshot = {
  divisor: 31.1, refreshSeconds: 60,
  gold: [{ key: 'au18', label: 'Oro 18k', fineness: 750, f1: 1, f2: 1, f3: 0 }],
  silver: [{ key: 'ag925', label: 'Plata 925', fineness: 925, f1: 1, f2: 1, f3: 0 }],
}
export const empresa = { razonSocial: 'Joyería Ejemplo SL', cif: 'B12345678', nombreComercial: 'Joyería Ejemplo', direccion: 'Calle de Ejemplo 10', poblacion: 'Santa Cruz de Tenerife', provincia: 'Santa Cruz de Tenerife', cp: '38001', iae: '491.1' }
export const cliente = {
  id: 'cli_ejemplo01', estado: 'pendiente', enviadoEn: null, nota: null, empresa,
  contacto: { persona: 'Persona de ejemplo', telefono: '+34922000000', telefonoTienda: '', email: 'tienda@example.test' },
  titular: { nombre: 'Persona de ejemplo', dni: '00000000T' }, cobro: { iban: 'ES9121000418450200051332' },
  documentos: [], limites: { porCierre: 5000, reservaMinutos: 60 }, creadoEn: '2026-09-17T09:00:00.000Z',
}
export const alta = { accion: 'alta', empresa, contacto: cliente.contacto, titular: cliente.titular, cobro: cliente.cobro, password: 'Ejemplo-sintetico-2026', condiciones: true }
export const precios = {
  fixing: { gold: 3110, silver: 31.1 }, change: { gold: 0.5, silver: -0.2 }, fetchedAt: 1789635600000,
  stale: false, refreshSeconds: 60, formulasVersion: 2,
  gold: [{ key: 'au18', label: 'Oro 18k', fineness: 750, pricePerGram: 75 }],
  silver: [{ key: 'ag925', label: 'Plata 925', fineness: 925, pricePerGram: 0.925 }],
}
export const formulas = { ...snapshot, version: 2, updatedAt: '2026-09-17T09:00:00.000Z', updatedBy: 'operador', fixingAtPublish: { ...precios.fixing, at: precios.fetchedAt }, source: 'store' }
export const cierre = {
  ref: 'TQM-1709-0001', clienteId: cliente.id,
  cliente: { razonSocial: empresa.razonSocial, cif: empresa.cif, telefono: cliente.contacto.telefono, persona: cliente.contacto.persona },
  lineas: [{ metal: 'gold', key: 'au18', gramos: 10, label: 'Oro 18k', fineness: 750, precioGramo: 75, importe: 750 }],
  total: 750, gramos: 10, fixing: precios.fixing, estado: 'pendiente', reservaMinutos: 60,
  creadoEn: '2026-09-17T09:00:00.000Z', expiraEn: '2026-09-17T10:00:00.000Z',
  revalorizadoEn: null, decididoEn: null, decididoPor: null, nota: null, vencido: false,
}
