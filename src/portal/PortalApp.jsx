import { useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { api, SinSesion } from './api'
import { Cierres } from './Cierre'
import { usePrecios as useTarifa } from './usePrecios'

// Portal de clientes de Te Quiero Metales.
//
// Fase 1: alta con revisión. La tienda se registra, sube su documentación y
// sigue el estado de su solicitud. La revisa una persona de TQM.

const MAX_DOCUMENTOS = 10
const TIPOS = 'application/pdf,image/jpeg,image/png,image/webp'

const ESTADOS = {
  borrador: {
    tono: 'warn',
    titulo: 'Falta enviar la solicitud',
    texto: 'Sube la documentación que tengas a mano y pulsa «Enviar a revisión». Hasta entonces no nos llega nada.',
  },
  pendiente: {
    tono: 'info',
    titulo: 'En revisión',
    texto: 'Ya la tenemos. La miramos y te contamos; si nos falta algo, te lo pediremos por aquí.',
  },
  documentacion: {
    tono: 'warn',
    titulo: 'Nos falta algo',
    texto: 'Hemos revisado tu solicitud y necesitamos algún documento más.',
  },
  aprobado: {
    tono: 'ok',
    titulo: 'Cuenta aprobada',
    texto: 'Ya puedes cerrar con nosotros desde aquí.',
  },
  rechazado: {
    tono: 'bad',
    titulo: 'No podemos seguir adelante',
    texto: 'Hemos revisado la solicitud y no podemos aprobarla.',
  },
}

const ETIQUETAS = ['CIF de la empresa', 'DNI del administrador', 'Certificado de titularidad bancaria', 'Alta en el IAE', 'Escritura de constitución', 'Licencia de actividad']

function fmtTamano(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
}

function fmtDec(v, dec = 2) {
  return Number.isFinite(v)
    ? v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : '—'
}

// Nombre de archivo convertido en algo legible, para no obligar a escribir la
// etiqueta de cada documento.
function etiquetaDesde(nombre) {
  const base = String(nombre).replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim()
  if (!base) return 'Documento'
  return (base[0].toUpperCase() + base.slice(1)).slice(0, 40)
}

function rutaSegura(nombre) {
  return String(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'documento'
}

/**
 * Las fotos de móvil llegan con más resolución de la que hace falta para leer
 * un CIF. Se reducen aquí para no hacer esperar a nadie con 12 megapíxeles.
 */
async function prepararArchivo(file) {
  if (!file.type.startsWith('image/') || file.size < 1.2 * 1024 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && file.size < 4 * 1024 * 1024) return file

    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(bitmap.width * escala)
    lienzo.height = Math.round(bitmap.height * escala)
    lienzo.getContext('2d').drawImage(bitmap, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise(r => lienzo.toBlob(r, 'image/jpeg', 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

function leerBase64(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result).split(',')[1] || '')
    lector.onerror = () => reject(new Error('No se ha podido leer el archivo'))
    lector.readAsDataURL(file)
  })
}

// ─── Cabecera ────────────────────────────────────────────────────────────────

function Cabecera({ cliente, onSalir }) {
  const market = usePrecios()

  return (
    <header className="ptop">
      <a className="ptop__marca" href="/">
        <span className="ptop__wordmark">Te Quiero Metales</span>
        <span className="ptop__nombre">Portal de clientes</span>
      </a>

      {market?.fixing && (
        <p className="ptop__precios">
          <span className={`dot${market.stale ? ' stale' : ' live'}`} aria-hidden="true" />
          Oro <b>{fmtDec(market.fixing.gold)} €</b> · Plata <b>{fmtDec(market.fixing.silver)} €</b>
          <span className="ptop__unidad">la onza</span>
        </p>
      )}

      {cliente && (
        <button className="btn ghost" onClick={onSalir}>Salir</button>
      )}
    </header>
  )
}

// ─── Campos ──────────────────────────────────────────────────────────────────

function Campo({ id, etiqueta, ayuda, valor, onChange, ancho = '', ...props }) {
  return (
    <div className={`campo ${ancho}`}>
      <label className="label" htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        className="input"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
      {ayuda && <p className="campo__ayuda">{ayuda}</p>}
    </div>
  )
}

// ─── La puerta ───────────────────────────────────────────────────────────────
//
// Quien llega aquí viene a saber una cosa: a cuánto está el oro hoy. Es público
// —lo publica la web— así que se enseña antes de pedir nada. La tarjeta de
// acceso va al lado, no en medio de un vacío.

function usePrecios() {
  return useTarifa().precios
}

function PrecioDelDia({ market, compacto = false }) {
  if (!market) {
    return (
      <div className="tablon">
        <div className="skeleton" style={{ height: 22, width: 130 }} />
        <div className="skeleton" style={{ height: 74, marginTop: 18 }} />
        <div className="skeleton" style={{ height: 54, marginTop: 18 }} />
      </div>
    )
  }

  const gold = market.gold || []
  const silver = market.silver || []
  // El 18k es la ley de la que va casi todo lo que entra por el mostrador: es
  // la cifra que se busca al abrir esto.
  const principal = gold.find(g => g.key === 'au18') || gold[0]
  const resto = [...gold.filter(g => g !== principal), ...silver.filter(l => l.key === 'ag925')]
  const delta = Number(market.change?.gold)
  const filas = compacto ? [principal, ...resto] : resto

  return (
    <div className={`tablon${compacto ? ' tablon--lado' : ''}`}>
      {!compacto && (
        <>
          <div className="tablon__cab">
            <span className="eyebrow">Compramos hoy</span>
            <span className={`dot${market.stale ? ' stale' : ' live'}`} aria-hidden="true" />
          </div>

          <p className="tablon__ley">{principal?.label}</p>
      <p className="tablon__cifra num">
        {fmtDec(principal?.pricePerGram)}<span className="tablon__unidad"> € / gramo</span>
      </p>

          {Number.isFinite(delta) && delta !== 0 && (
            <p className={`tablon__delta ${delta > 0 ? 'up' : 'down'}`}>
              {delta > 0 ? '▲' : '▼'} {fmtDec(Math.abs(delta))} % la onza hoy
            </p>
          )}
        </>
      )}

      <dl className="tablon__resto">
        {filas.map(l => (
          <div key={l.key}>
            <dt>{l.label}</dt>
            <dd className="num">{fmtDec(l.pricePerGram, l.key.startsWith('ag') ? 3 : 2)} €</dd>
          </div>
        ))}
      </dl>

      <p className="tablon__pie">
        Euros por gramo, ya con nuestras condiciones aplicadas. Al pedir un cierre te
        reservamos el precio mientras lo confirmamos.
      </p>
    </div>
  )
}

function Puerta({ children }) {
  const market = usePrecios()
  return (
    <div className="puerta">
      <div className="puerta__tablon">
        <PrecioDelDia market={market} />
      </div>
      <div className="puerta__acceso">{children}</div>
    </div>
  )
}

// ─── La banda ────────────────────────────────────────────────────────────────
//
// Lo primero al entrar, de lado a lado de la pantalla: quién eres, a qué has
// venido y a cuánto está el 18k, que es la ley de la que va casi todo. El
// turquesa a fondo y la cifra en ámbar: los dos extremos del círculo de color,
// que es lo que hace que se vea desde el otro lado del mostrador.

function Banda({ cliente, market }) {
  const gold = market?.gold || []
  const principal = gold.find(g => g.key === 'au18') || gold[0]
  const delta = Number(market?.change?.gold)

  return (
    <header className="banda">
      <div className="banda__interior">
        <div className="banda__quien">
          <span className="banda__tienda">{cliente.empresa.razonSocial}</span>
          <h1>Cerrar con nosotros</h1>
          <p>
            Reparte los gramos por quilataje y te reservamos el precio mientras lo
            confirmamos. Si prefieres llamar, seguimos al teléfono de siempre.
          </p>
        </div>

        <div className="banda__precio">
          <span className="banda__etiqueta">
            {principal?.label || 'Oro 18k'} ahora
            <span className={`dot${market?.stale ? ' stale' : ' live'}`} aria-hidden="true" />
          </span>
          <p className="banda__cifra num">
            {principal ? fmtDec(principal.pricePerGram) : '—'}
            <span className="banda__unidad">€ / gr</span>
          </p>
          {Number.isFinite(delta) && delta !== 0 && (
            <p className={`banda__delta ${delta > 0 ? 'sube' : 'baja'}`}>
              {delta > 0 ? '▲' : '▼'} {fmtDec(Math.abs(delta))} % la onza hoy
            </p>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Entrar ──────────────────────────────────────────────────────────────────

function Entrar({ onEntrar, onCrear, onOlvide }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [estado, setEstado] = useState({ enviando: false, error: null })
  const primero = useRef(null)

  useEffect(() => { primero.current?.focus() }, [])

  const enviar = async (e) => {
    e.preventDefault()
    if (estado.enviando) return
    setEstado({ enviando: true, error: null })
    try {
      const data = await api.entrar(form.email, form.password)
      onEntrar(data)
    } catch (err) {
      const espera = err.payload?.retryAfter
      const cola = espera ? ` Vuelve a intentarlo en ${Math.ceil(espera / 60)} min.` : ''
      setEstado({ enviando: false, error: (err.message || 'No se ha podido entrar') + cola })
      setForm(f => ({ ...f, password: '' }))
    }
  }

  return (
    <Puerta>
      <form className="login__card" onSubmit={enviar} autoComplete="on">
        <div className="login__mark">
          <span className="login__wordmark">Acceso de clientes</span>
          <span className="login__rule" aria-hidden="true" />
        </div>
        <h1>Entrar</h1>
        <p className="login__sub">Con el correo con el que te registraste.</p>

        <div className="field">
          <label className="label" htmlFor="email">Correo</label>
          <input
            id="email" className="input" type="email" ref={primero}
            value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            autoComplete="username" required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="clave">Contraseña</label>
          <input
            id="clave" className="input" type="password"
            value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            autoComplete="current-password" required
          />
        </div>

        {estado.error && <div className="alert error" role="alert">{estado.error}</div>}

        <div className="login__actions">
          <button className="btn primary block" type="submit" disabled={estado.enviando}>
            {estado.enviando ? 'Comprobando…' : 'Entrar'}
          </button>
        </div>

        <p className="login__foot">
          <button type="button" className="linky" onClick={onOlvide}>He olvidado la contraseña</button>
          <br />
          ¿Todavía no tienes cuenta?{' '}
          <button type="button" className="linky" onClick={onCrear}>Registra tu tienda</button>
        </p>
      </form>
    </Puerta>
  )
}

// ─── Volver a entrar ─────────────────────────────────────────────────────────
//
// Dos pantallas. En la primera se pide el código; en la segunda se gasta y se
// elige contraseña nueva. La respuesta a lo primero es siempre la misma, exista
// la cuenta o no, así que el texto tiene que servir para los dos casos —y para
// cuando el correo no sale porque no hay proveedor contratado: entonces el
// código lo da TQM por teléfono, que es como se ha hecho siempre.

function Olvide({ onVolver, onTengoCodigo }) {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState({ enviando: false, hecho: false, error: null })

  const enviar = async (e) => {
    e.preventDefault()
    if (estado.enviando) return
    setEstado({ enviando: true, hecho: false, error: null })
    try {
      await api.olvide(email)
      setEstado({ enviando: false, hecho: true, error: null })
    } catch (err) {
      setEstado({ enviando: false, hecho: false, error: err.message })
    }
  }

  if (estado.hecho) {
    return (
      <Puerta>
        <div className="login__card">
          <div className="login__mark">
            <span className="login__wordmark">Volver a entrar</span>
            <span className="login__rule" aria-hidden="true" />
          </div>
          <h1>Mira tu correo</h1>
          <p className="login__sub">
            Si ese correo está registrado, te llega un enlace para elegir contraseña nueva.
            Caduca en una hora y solo sirve una vez.
          </p>
          <p className="note">
            ¿No te llega? Llámanos al <a className="linky" href="tel:+34922000000">922 00 00 00</a> y
            te damos un código por teléfono.
          </p>
          <div className="login__actions">
            <button className="btn block" onClick={onTengoCodigo}>Tengo un código</button>
          </div>
          <p className="login__foot">
            <button type="button" className="linky" onClick={onVolver}>Volver al acceso</button>
          </p>
        </div>
      </Puerta>
    )
  }

  return (
    <Puerta>
      <form className="login__card" onSubmit={enviar}>
        <div className="login__mark">
          <span className="login__wordmark">Volver a entrar</span>
          <span className="login__rule" aria-hidden="true" />
        </div>
        <h1>¿Contraseña olvidada?</h1>
        <p className="login__sub">Dinos con qué correo entras y te mandamos un enlace.</p>

        <div className="field">
          <label className="label" htmlFor="olvide-email">Correo</label>
          <input
            id="olvide-email" className="input" type="email" autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username" required
          />
        </div>

        {estado.error && <div className="alert error" role="alert">{estado.error}</div>}

        <div className="login__actions">
          <button className="btn primary block" type="submit" disabled={estado.enviando}>
            {estado.enviando ? 'Enviando…' : 'Mandar el enlace'}
          </button>
        </div>

        <p className="login__foot">
          <button type="button" className="linky" onClick={onTengoCodigo}>Ya tengo un código</button>
          <br />
          <button type="button" className="linky" onClick={onVolver}>Volver al acceso</button>
        </p>
      </form>
    </Puerta>
  )
}

function NuevaClave({ codigo, onEntrar, onVolver }) {
  const [token, setToken] = useState(codigo || '')
  const [clave, setClave] = useState({ password: '', repetida: '' })
  const [estado, setEstado] = useState({ enviando: false, error: null })

  const enviar = async (e) => {
    e.preventDefault()
    if (estado.enviando) return
    if (clave.password !== clave.repetida) {
      setEstado({ enviando: false, error: 'Las dos contraseñas no coinciden' })
      return
    }
    setEstado({ enviando: true, error: null })
    try {
      const data = await api.restablecer(token.trim(), clave.password)
      // El servidor deja la sesión abierta: quien acaba de demostrar que tiene
      // el correo no tiene que volver a escribir lo que acaba de elegir.
      onEntrar(data)
    } catch (err) {
      setEstado({ enviando: false, error: err.message })
      setClave({ password: '', repetida: '' })
    }
  }

  return (
    <Puerta>
      <form className="login__card" onSubmit={enviar}>
        <div className="login__mark">
          <span className="login__wordmark">Volver a entrar</span>
          <span className="login__rule" aria-hidden="true" />
        </div>
        <h1>Contraseña nueva</h1>
        <p className="login__sub">
          En cuanto la cambies se cierran las sesiones que hubiera abiertas.
        </p>

        {!codigo && (
          <div className="field">
            <label className="label" htmlFor="clave-codigo">Código</label>
            <input
              id="clave-codigo" className="input ref" type="text" autoFocus
              value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="El que te hemos dado por teléfono" required
            />
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="clave-nueva">Contraseña nueva</label>
          <input
            id="clave-nueva" className="input" type="password" autoFocus={Boolean(codigo)}
            value={clave.password} onChange={(e) => setClave(c => ({ ...c, password: e.target.value }))}
            autoComplete="new-password" minLength={8} required
          />
          <p className="campo__ayuda">Ocho caracteres como mínimo</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="clave-repite">Repítela</label>
          <input
            id="clave-repite" className="input" type="password"
            value={clave.repetida} onChange={(e) => setClave(c => ({ ...c, repetida: e.target.value }))}
            autoComplete="new-password" minLength={8} required
          />
        </div>

        {estado.error && <div className="alert error" role="alert">{estado.error}</div>}

        <div className="login__actions">
          <button className="btn primary block" type="submit" disabled={estado.enviando}>
            {estado.enviando ? 'Guardando…' : 'Guardar y entrar'}
          </button>
        </div>

        <p className="login__foot">
          <button type="button" className="linky" onClick={onVolver}>Volver al acceso</button>
        </p>
      </form>
    </Puerta>
  )
}

// ─── Alta ────────────────────────────────────────────────────────────────────

const VACIO = {
  razonSocial: '', cif: '', nombreComercial: '', direccion: '', poblacion: '', provincia: '', cp: '', iae: '',
  persona: '', telefono: '', telefonoTienda: '', email: '',
  titularNombre: '', dni: '', iban: '',
  password: '', password2: '', condiciones: false,
}

function Alta({ onAlta, onVolver }) {
  const [f, setF] = useState(VACIO)
  const [estado, setEstado] = useState({ enviando: false, error: null, detalles: [] })
  const set = (campo) => (valor) => setF(x => ({ ...x, [campo]: valor }))

  const enviar = async (e) => {
    e.preventDefault()
    if (estado.enviando) return
    if (f.password !== f.password2) {
      setEstado({ enviando: false, error: 'Las dos contraseñas no coinciden', detalles: [] })
      return
    }
    setEstado({ enviando: true, error: null, detalles: [] })
    try {
      const data = await api.alta({
        empresa: {
          razonSocial: f.razonSocial, cif: f.cif, nombreComercial: f.nombreComercial,
          direccion: f.direccion, poblacion: f.poblacion, provincia: f.provincia, cp: f.cp, iae: f.iae,
        },
        contacto: {
          persona: f.persona, telefono: f.telefono,
          telefonoTienda: f.telefonoTienda, email: f.email,
        },
        titular: { nombre: f.titularNombre, dni: f.dni },
        cobro: { iban: f.iban },
        password: f.password,
        condiciones: f.condiciones,
      })
      onAlta(data)
    } catch (err) {
      setEstado({
        enviando: false,
        error: err.message || 'No se ha podido crear la solicitud',
        detalles: err.payload?.details || [],
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="pancho">
      <div className="pcabecera">
        <h1>Registra tu tienda</h1>
        <p>
          Rellena los datos, sube la documentación y nosotros revisamos la solicitud. Es el
          paso previo para poder comprarte oro, plata y brillantes.
        </p>
      </div>

      {estado.error && (
        <div className="alert error" role="alert">
          <strong>{estado.error}</strong>
          {estado.detalles.length > 0 && (
            <ul>{estado.detalles.slice(0, 8).map((d, i) => <li key={i}>{d}</li>)}</ul>
          )}
        </div>
      )}

      <form onSubmit={enviar} autoComplete="on">
        <section className="panel">
          <h2 className="panel__title">La empresa</h2>
          <div className="rejilla">
            <Campo id="razonSocial" etiqueta="Razón social" valor={f.razonSocial} onChange={set('razonSocial')} ancho="ancho" required maxLength={120} />
            <Campo id="cif" etiqueta="CIF" valor={f.cif} onChange={set('cif')} required maxLength={12} placeholder="B12345678" spellCheck="false" />
            <Campo id="nombreComercial" etiqueta="Nombre comercial" ayuda="Si es distinto de la razón social" valor={f.nombreComercial} onChange={set('nombreComercial')} maxLength={80} />
            <Campo id="direccion" etiqueta="Dirección fiscal" valor={f.direccion} onChange={set('direccion')} ancho="ancho" required maxLength={160} />
            <Campo id="poblacion" etiqueta="Población" valor={f.poblacion} onChange={set('poblacion')} required maxLength={80} />
            <Campo id="provincia" etiqueta="Provincia" valor={f.provincia} onChange={set('provincia')} required maxLength={60} />
            <Campo id="cp" etiqueta="Código postal" valor={f.cp} onChange={set('cp')} required inputMode="numeric" maxLength={5} />
            <Campo id="iae" etiqueta="Epígrafe de IAE" ayuda="Opcional" valor={f.iae} onChange={set('iae')} maxLength={20} />
          </div>
        </section>

        <section className="panel">
          <h2 className="panel__title">Contacto</h2>
          <div className="rejilla">
            <Campo id="persona" etiqueta="Persona de contacto" valor={f.persona} onChange={set('persona')} required maxLength={80} autoComplete="name" />
            <Campo id="email" etiqueta="Correo" ayuda="Con este correo entrarás al portal" valor={f.email} onChange={set('email')} required type="email" maxLength={120} autoComplete="email" />
            <Campo id="telefono" etiqueta="Teléfono" valor={f.telefono} onChange={set('telefono')} required type="tel" maxLength={20} autoComplete="tel" />
            <Campo id="telefonoTienda" etiqueta="Teléfono de la tienda" ayuda="Opcional" valor={f.telefonoTienda} onChange={set('telefonoTienda')} type="tel" maxLength={20} />
          </div>
        </section>

        <section className="panel">
          <h2 className="panel__title">Titularidad y cobro</h2>
          <div className="rejilla">
            <Campo id="titularNombre" etiqueta="Administrador o apoderado" valor={f.titularNombre} onChange={set('titularNombre')} required maxLength={80} />
            <Campo id="dni" etiqueta="DNI" valor={f.dni} onChange={set('dni')} required maxLength={12} spellCheck="false" />
            <Campo id="iban" etiqueta="IBAN" ayuda="Donde se harán los pagos. No se cobra nada desde aquí." valor={f.iban} onChange={set('iban')} ancho="ancho" required maxLength={40} placeholder="ES00 0000 0000 0000 0000 0000" spellCheck="false" />
          </div>
        </section>

        <section className="panel">
          <h2 className="panel__title">Acceso al portal</h2>
          <div className="rejilla">
            <Campo id="password" etiqueta="Contraseña" ayuda="Ocho caracteres como mínimo" valor={f.password} onChange={set('password')} required type="password" autoComplete="new-password" />
            <Campo id="password2" etiqueta="Repite la contraseña" valor={f.password2} onChange={set('password2')} required type="password" autoComplete="new-password" />
          </div>

          <label className="acepto">
            <input type="checkbox" checked={f.condiciones} onChange={(e) => setF(x => ({ ...x, condiciones: e.target.checked }))} required />
            <span>
              He leído y acepto las <a href="/aviso-legal" target="_blank" rel="noreferrer">condiciones</a> y
              la <a href="/politica-privacidad" target="_blank" rel="noreferrer">política de privacidad</a>.
            </span>
          </label>
        </section>

        <div className="pacciones">
          <button type="button" className="btn ghost" onClick={onVolver}>Ya tengo cuenta</button>
          <button className="btn primary" type="submit" disabled={estado.enviando}>
            {estado.enviando ? 'Creando…' : 'Crear la solicitud'}
          </button>
        </div>
        <p className="note">
          Después de este paso podrás subir la documentación. La solicitud no nos llega
          hasta que la envíes tú.
        </p>
      </form>
    </div>
  )
}

// ─── Documentos ──────────────────────────────────────────────────────────────

function Documentos({ cliente, almacen, editable, onCliente, onError }) {
  const [cola, setCola] = useState([])
  const [arrastrando, setArrastrando] = useState(false)
  const entrada = useRef(null)

  const documentos = cliente.documentos || []
  const hueco = MAX_DOCUMENTOS - documentos.length

  const subir = useCallback(async (bruto) => {
    const file = await prepararArchivo(bruto)
    const etiqueta = etiquetaDesde(bruto.name)
    const clave = `${file.name}-${Date.now()}`
    setCola(c => [...c, { clave, nombre: file.name, progreso: 0 }])

    const avanzar = (progreso) => setCola(c => c.map(x => (x.clave === clave ? { ...x, progreso } : x)))

    try {
      let data
      if (almacen === 'blob') {
        const blob = await upload(`clientes/${cliente.id}/${rutaSegura(file.name)}`, file, {
          access: 'private',
          handleUploadUrl: '/api/portal/documentos',
          onUploadProgress: ({ percentage }) => avanzar(Math.min(99, Math.round(percentage))),
        })
        data = await api.confirmarDocumento({
          url: blob.url,
          pathname: blob.pathname,
          nombre: file.name,
          etiqueta,
        })
      } else if (almacen === 'memoria') {
        avanzar(40)
        data = await api.subirDocumentoLocal({
          base64: await leerBase64(file),
          nombre: file.name,
          tipo: file.type,
          etiqueta,
        })
      } else {
        throw new Error('No hay almacén de documentos configurado. Avisa a TQM.')
      }
      onCliente(data.cliente)
    } catch (err) {
      onError(`${file.name}: ${err.message || 'no se ha podido subir'}`)
    } finally {
      setCola(c => c.filter(x => x.clave !== clave))
    }
  }, [almacen, cliente.id, onCliente, onError])

  const anadir = useCallback(async (lista) => {
    const archivos = Array.from(lista || [])
    if (!archivos.length) return
    if (archivos.length > hueco) {
      onError(`Solo caben ${MAX_DOCUMENTOS} documentos: puedes subir ${hueco} más.`)
    }
    // De uno en uno: si falla el tercero, los dos primeros ya están guardados.
    for (const file of archivos.slice(0, Math.max(0, hueco))) {
      await subir(file)
    }
  }, [hueco, onError, subir])

  const quitar = async (doc) => {
    if (!window.confirm(`¿Quitar «${doc.etiqueta}» de la solicitud?`)) return
    try {
      const data = await api.quitarDocumento(doc.id)
      onCliente(data.cliente)
    } catch (err) {
      onError(err.message)
    }
  }

  const etiquetar = async (doc, etiqueta) => {
    const limpia = etiqueta.trim()
    if (!limpia || limpia === doc.etiqueta) return
    try {
      const data = await api.etiquetarDocumento(doc.id, limpia)
      onCliente(data.cliente)
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Documentación</h2>

      {editable && (
        <>
          <div
            className={`soltar${arrastrando ? ' encima' : ''}${hueco <= 0 ? ' lleno' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); if (hueco > 0) anadir(e.dataTransfer.files) }}
            onClick={() => hueco > 0 && entrada.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && hueco > 0) entrada.current?.click() }}
          >
            <strong>{hueco > 0 ? 'Arrastra aquí los documentos o pulsa para elegirlos' : 'Has llegado al máximo de 10 documentos'}</strong>
            <span>
              PDF, JPG, PNG o WEBP · hasta 8 MB cada uno · {documentos.length} de {MAX_DOCUMENTOS}
              {almacen === 'memoria' && ' · modo local: máximo 2,5 MB por archivo'}
            </span>
            <input
              ref={entrada}
              type="file"
              accept={TIPOS}
              multiple
              hidden
              onChange={(e) => { anadir(e.target.files); e.target.value = '' }}
            />
          </div>

          <p className="note tight">
            Vale con una foto legible hecha con el móvil. Ponle a cada uno un nombre que
            se entienda: así lo revisamos antes.
          </p>
        </>
      )}

      {cola.length > 0 && (
        <ul className="docs">
          {cola.map(item => (
            <li className="doc subiendo" key={item.clave}>
              <span className="doc__nombre">{item.nombre}</span>
              <span className="barra"><i style={{ width: `${item.progreso}%` }} /></span>
              <span className="doc__meta">{item.progreso}%</span>
            </li>
          ))}
        </ul>
      )}

      {documentos.length === 0 && cola.length === 0 ? (
        <p className="note">Todavía no has subido ninguno.</p>
      ) : (
        <ul className="docs">
          {documentos.map(doc => (
            <li className="doc" key={doc.id}>
              <span className={`doc__tipo${doc.tipo === 'application/pdf' ? ' pdf' : ''}`} aria-hidden="true">
                {doc.tipo === 'application/pdf' ? 'PDF' : 'IMG'}
              </span>
              {editable ? (
                <input
                  className="doc__etiqueta"
                  defaultValue={doc.etiqueta}
                  maxLength={40}
                  aria-label={`Nombre del documento ${doc.nombre}`}
                  list="etiquetas-sugeridas"
                  onBlur={(e) => etiquetar(doc, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                />
              ) : (
                <span className="doc__nombre">{doc.etiqueta}</span>
              )}
              <span className="doc__meta">{fmtTamano(doc.tamano)}</span>
              {editable && (
                <button className="btn icon danger" onClick={() => quitar(doc)} aria-label={`Quitar ${doc.etiqueta}`}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <datalist id="etiquetas-sugeridas">
        {ETIQUETAS.map(e => <option key={e} value={e} />)}
      </datalist>
    </section>
  )
}

// ─── Expediente ──────────────────────────────────────────────────────────────

function Expediente({ cliente, almacen, onCliente, onSalir }) {
  const market = usePrecios()
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const sinEnviar = cliente.estado === 'pendiente' && !cliente.enviadoEn
  const clave = sinEnviar ? 'borrador' : cliente.estado
  const estado = ESTADOS[clave] || ESTADOS.pendiente
  const editable = cliente.estado !== 'aprobado' && cliente.estado !== 'rechazado'
  const puedeEnviar = editable && (cliente.documentos || []).length > 0 && (sinEnviar || cliente.estado === 'documentacion')

  const enviar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const data = await api.enviar()
      onCliente(data.cliente)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  // Cuenta aprobada: lo que se viene a hacer aquí es cerrar. Los datos y la
  // documentación pasan a un segundo plano, plegados.
  if (cliente.estado === 'aprobado') {
    return (
      <>
        <Banda cliente={cliente} market={market} />

        <div className="ptrabajo">
          <div className="ptrabajo__principal">
            {error && <div className="alert error" role="alert">{error}</div>}
            <Cierres onError={setError} />
          </div>

          {/* La tarifa se consulta mientras se monta el lote, así que va al lado
              y no debajo: en una pantalla de escritorio sobra sitio. */}
          <aside className="ptrabajo__lado">
            <section className="panel panel--tarifa">
              <div className="panel__head">
                <h2 className="panel__title">Tarifa de hoy</h2>
                <span className={`dot${market?.stale ? ' stale' : ' live'}`} aria-hidden="true" />
              </div>
              <PrecioDelDia market={market} compacto />
            </section>

            <details className="mas">
              <summary>Tus datos y tu documentación</summary>
              <Datos cliente={cliente} />
              <Documentos
                cliente={cliente}
                almacen={almacen}
                editable={false}
                onCliente={onCliente}
                onError={setError}
              />
            </details>

            <div className="pacciones fin">
              <button className="btn ghost" onClick={onSalir}>Cerrar sesión</button>
            </div>
          </aside>
        </div>
      </>
    )
  }

  return (
    <div className="pancho">
      <div className="pcabecera">
        <span className="pcabecera__quien">{cliente.empresa.razonSocial}</span>
        <h1>Tu solicitud</h1>
      </div>

      <section className={`estado is-${estado.tono}`}>
        <div className="estado__cabeza">
          <span className="dot" aria-hidden="true" />
          <h2>{estado.titulo}</h2>
        </div>
        <p>{estado.texto}</p>
        {cliente.nota && <p className="estado__nota">{cliente.nota}</p>}
        {cliente.enviadoEn && cliente.estado === 'pendiente' && (
          <p className="estado__pie">Enviada el {fmtFecha(cliente.enviadoEn)}</p>
        )}
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}

      <Documentos
        cliente={cliente}
        almacen={almacen}
        editable={editable}
        onCliente={onCliente}
        onError={setError}
      />

      {puedeEnviar && (
        <div className="pacciones">
          <button className="btn primary" onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar a revisión'}
          </button>
        </div>
      )}

      <Datos cliente={cliente} />

      <div className="pacciones fin">
        <button className="btn ghost" onClick={onSalir}>Cerrar sesión</button>
      </div>
    </div>
  )
}

function Datos({ cliente }) {
  return (
    <section className="panel">
      <h2 className="panel__title">Datos de la solicitud</h2>
      <dl className="datos">
        <div><dt>Razón social</dt><dd>{cliente.empresa.razonSocial}</dd></div>
        <div><dt>CIF</dt><dd>{cliente.empresa.cif}</dd></div>
        <div><dt>Dirección</dt><dd>{cliente.empresa.direccion}, {cliente.empresa.cp} {cliente.empresa.poblacion} ({cliente.empresa.provincia})</dd></div>
        <div><dt>Contacto</dt><dd>{cliente.contacto.persona} · {cliente.contacto.telefono}</dd></div>
        <div><dt>Correo</dt><dd>{cliente.contacto.email}</dd></div>
        <div><dt>Administrador</dt><dd>{cliente.titular.nombre} · {cliente.titular.dni}</dd></div>
        <div><dt>IBAN</dt><dd>{cliente.cobro.iban}</dd></div>
        <div><dt>Solicitud creada</dt><dd>{fmtFecha(cliente.creadoEn)}</dd></div>
      </dl>
      <p className="note">
        ¿Hay algo mal? Llámanos y lo corregimos: <a href="tel:+34922000000">922 00 00 00</a>.
      </p>
    </section>
  )
}

// ─── Raíz ────────────────────────────────────────────────────────────────────

// El enlace del correo llega como /portal/?clave=xxx. Se lee una vez al
// arrancar y se limpia de la barra de direcciones: un código de acceso no tiene
// por qué quedarse en el historial ni viajar en el Referer.
function codigoDeLaUrl() {
  try {
    const url = new URL(window.location.href)
    const codigo = url.searchParams.get('clave')
    if (!codigo) return null
    url.searchParams.delete('clave')
    window.history.replaceState({}, '', url.pathname + url.search)
    return codigo
  } catch {
    return null
  }
}

export default function PortalApp() {
  const [cliente, setCliente] = useState(null)
  const [almacen, setAlmacen] = useState(null)
  const [codigo] = useState(codigoDeLaUrl)
  const [pantalla, setPantalla] = useState(() => (codigo ? 'clave' : 'entrar'))
  const [comprobando, setComprobando] = useState(true)

  useEffect(() => {
    api.sesion()
      .then(data => { setCliente(data.cliente); setAlmacen(data.almacen) })
      .catch(() => setCliente(null))
      .finally(() => setComprobando(false))
  }, [])

  const entrar = (data) => {
    setCliente(data.cliente)
    setAlmacen(data.almacen)
  }

  const salir = async () => {
    try { await api.salir() } catch { /* la sesión se cierra igual */ }
    setCliente(null)
    setPantalla('entrar')
  }

  const actualizar = (siguiente) => setCliente(siguiente)

  useEffect(() => {
    // Si la sesión caduca mientras se trabaja, se vuelve al acceso sin dramas.
    const alFallar = (e) => {
      if (e.reason instanceof SinSesion) {
        setCliente(null)
        setPantalla('entrar')
      }
    }
    window.addEventListener('unhandledrejection', alFallar)
    return () => window.removeEventListener('unhandledrejection', alFallar)
  }, [])

  if (comprobando) {
    return (
      <div className="splash">
        <span className="splash__mark">Te Quiero Metales</span>
        <p>Un momento…</p>
      </div>
    )
  }

  return (
    <div className="portal">
      <Cabecera cliente={cliente} onSalir={salir} />
      <main className="pmain">
        {cliente ? (
          <Expediente cliente={cliente} almacen={almacen} onCliente={actualizar} onSalir={salir} />
        ) : pantalla === 'alta' ? (
          <Alta onAlta={entrar} onVolver={() => setPantalla('entrar')} />
        ) : pantalla === 'olvide' ? (
          <Olvide onVolver={() => setPantalla('entrar')} onTengoCodigo={() => setPantalla('clave')} />
        ) : pantalla === 'clave' ? (
          <NuevaClave codigo={codigo} onEntrar={entrar} onVolver={() => setPantalla('entrar')} />
        ) : (
          <Entrar
            onEntrar={entrar}
            onCrear={() => setPantalla('alta')}
            onOlvide={() => setPantalla('olvide')}
          />
        )}
      </main>
      <footer className="pfoot">
        Te Quiero Metales · Compra de oro, plata y brillantes al por mayor en Canarias
      </footer>
    </div>
  )
}
