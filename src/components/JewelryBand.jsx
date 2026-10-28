// Banda de la venta de joyas al mayor, justo después de la portada: quien entra
// a vender su oro tiene que ver en el primer scroll que también puede comprar
// joyas. Todo enlaza a la tienda mayorista, que es otra web.

const TIENDA = 'https://www.tequierometales.com'

const categorias = [
  { label: 'Anillos', href: `${TIENDA}/12-anillos/` },
  { label: 'Pulseras', href: `${TIENDA}/11-pulseras/` },
  { label: 'Gargantillas', href: `${TIENDA}/13-gargantillas/` },
  { label: 'Pendientes', href: `${TIENDA}/10-pendientes/` },
]

const Flecha = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)
const FlechaFuera = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
)

export default function JewelryBand() {
  return (
    <section className="joyas" id="joyas" aria-labelledby="joyas-titulo">
      <div className="joyas-grid" />
      <div className="joyas-inner">
        <div className="fade-up">
          <div className="section-tag">Joyería de oro al por mayor</div>
          <h2 className="joyas-titulo" id="joyas-titulo">
            Te compramos el oro.<br />
            <em>Y te llenamos el escaparate.</em>
          </h2>
          <p className="joyas-desc">
            En TQM también distribuimos joyas de oro al por mayor para joyerías,
            relojerías y tiendas de compraventa de Canarias.
          </p>
          <div className="joyas-ctas">
            <a href={`${TIENDA}/2-catalogo-tqm/`} className="joyas-btn" target="_blank" rel="noopener">
              Ver catálogo de joyas
              <Flecha />
            </a>
            <a href={`${TIENDA}/solicitar-alta`} className="joyas-btn-sec" target="_blank" rel="noopener">
              Solicitar alta de cliente
            </a>
          </div>
        </div>

        <div className="fade-up d1">
          <ul className="joyas-cats">
            {categorias.map(c => (
              <li key={c.label}>
                <a href={c.href} target="_blank" rel="noopener">
                  <span>{c.label}</span>
                  <FlechaFuera />
                </a>
              </li>
            ))}
          </ul>
          <p className="joyas-web">tequierometales.com</p>
        </div>
      </div>
    </section>
  )
}
