const TITLES = {
  'aviso-legal': { tag: 'Información legal', title: 'Aviso Legal' },
  'politica-de-privacidad': { tag: 'Protección de datos', title: 'Política de Privacidad' },
  'politica-de-cookies': { tag: 'Uso de cookies', title: 'Política de Cookies' },
  'condiciones-de-venta': { tag: 'Compraventa', title: 'Condiciones de Venta' },
}

/* ===== AVISO LEGAL ===== */
function AvisoLegal() {
  return (
    <>
      <h2>1. Objeto</h2>
      <p>
        Las presentes condiciones legales son establecidas por Te Quiero Metales S.L. en adelante
        Te Quiero Metales, con el fin de determinar los criterios y condiciones de uso de la
        página web: <a href="https://www.oroalmayor.com" target="_blank" rel="noopener">www.oroalmayor.com</a>.
      </p>

      <h3>Datos del Titular</h3>
      <p>
        Según lo establecido en la Ley de Servicios de la Sociedad de la información y Comercio
        Electrónico LSSICE 34/2002, Te Quiero Metales, pone a disposición los datos del titular de
        la presente página web:
      </p>
      <div className="legal-card">
        <ul className="legal-data">
          <li><span>Identificación</span> Te Quiero Metales S.L.</li>
          <li><span>NIF</span> B76620210</li>
          <li><span>Domicilio</span> Camino San Miguel de Geneto, 66 Local C. 38296 – Santa Cruz de Tenerife.</li>
          <li><span>Teléfono</span> <a href="tel:+34922263470">922 26 34 70</a></li>
          <li><span>Correo electrónico</span> <a href="mailto:lopd@oroalmayor.com">lopd@oroalmayor.com</a></li>
          <li><span>Registro Mercantil</span> Santa Cruz de Tenerife, Tomo 3300, Folio 130, Sección 8, Hoja 52739.</li>
        </ul>
      </div>
      <p>
        Al ingresar a esta página web, el navegante adquiere la condición de usuario. Con el acceso,
        uso y disfrute de esta página web, el usuario acepta las condiciones planteadas en el
        presente apartado, en la versión publicada en el momento en que el acceda al mismo. Te Quiero
        Metales se reserva el derecho a modificar en cualquier momento, sus condiciones legales, así
        como a realizar cuanta mejora técnica o visual considere oportuno. En caso de que las
        modificaciones infieran en la privacidad de los usuarios, se avisará con antelación a la
        entrada en vigor de los cambios.
      </p>

      <h2>2. Política de Privacidad</h2>
      <p>
        Puede conocer nuestra política de privacidad visitando el siguiente enlace:{' '}
        <a href="#/politica-de-privacidad">Política de privacidad</a>.
      </p>

      <h2>3. Propiedad Intelectual</h2>
      <p>
        JOYERÍA TE QUIERO es una marca registrada en la Oficina Española de Patente y Marcas – OEPM.
        por Te Quiero Metales S.L. No puede ser utilizada por nadie distinto a su titular salvo que
        tenga el consentimiento del mismo.
      </p>
      <p>
        Así mismo, todo el contenido de la web, diseño, aplicaciones, contenido gráfico y multimedia,
        publicaciones en el blog, contenido escrito de los distintos apartados, desarrollo web, logos,
        marcas, productos, y cualquier otro objeto sujeto de portar derechos de propiedad intelectual
        e industrial, mencionado o no en el anterior listado que es a título enunciativo, no
        limitativo, son propiedad de Te Quiero Metales S.L., o de terceros. No se permite la
        reproducción total ni parcial, la copia, distribución, divulgación, transformación,
        comercialización, o cualquier otra actividad que menoscabe los derechos del titular de la web,
        o titulares de los derechos de propiedad intelectual o industrial. Los usuarios solo pueden
        hacer un uso privado de esta web.
      </p>

      <h2>4. Obligaciones del Usuario</h2>
      <p>
        Al ingresar y hacer uso de esta página web, el usuario acepta implícitamente las siguientes
        condiciones generales:
      </p>
      <ul>
        <li>
          <strong>Propiedad Intelectual:</strong> El usuario no podrá utilizar la información aquí
          contenida, ni el diseño, ni su contenido gráfico sin la autorización de los titulares de la
          web, o de los titulares de los derechos de propiedad intelectual e industrial. En caso de lo
          contrario estaría faltando a los derechos de propiedad intelectual e industrial.
        </li>
        <li>No se permite la reproducción total, ni parcial de los contenidos de la web.</li>
        <li>No se permite el uso del nombre comercial, marca, imagen, ni del logotipo de Te Quiero Metales.</li>
        <li>
          Si usted quiere reproducir o utilizar las publicaciones del blog, deberá solicitar el
          consentimiento del titular de la web.
        </li>
        <li>
          El usuario se hará responsable de la veracidad de los datos que suministra y se compromete a
          comunicar cualquier cambio que surja en ellos.
        </li>
        <li>
          La aceptación de la instalación de cookies es voluntaria, el usuario deberá bloquearlas o
          salir de la página antes de su instalación, la cual será un pasado un tiempo prudencial luego
          de su acceso a la web.
        </li>
      </ul>

      <h2>5. Exclusiones de Responsabilidad</h2>
      <p>
        <strong>Protección De Datos:</strong> Te Quiero Metales, ha establecido e implantado las
        medidas de índole técnica y organizativas necesarias que garanticen la seguridad de los datos
        de carácter personal suministrados por el usuario de tal manera que eviten su alteración,
        pérdida, tratamiento y/o acceso no autorizado, habida cuenta del estado de la tecnología, la
        naturaleza de los datos almacenados y los riesgos a que están expuestos, ya provengan de la
        acción humana o del medio físico o natural.
      </p>
      <p>
        <strong>Cookies:</strong> El usuario que tenga bloqueo de cookies o tecnologías similares,
        debe saber que dicho bloqueo puede acarrear deficiencias en la navegación y uso de esta web.
        En este sentido Te Quiero Metales no será responsable ni en todo ni en parte de dicha
        incidencia. Puedes conocer nuestra política de privacidad en:{' '}
        <a href="#/politica-de-privacidad">Política de privacidad</a>.
      </p>

      <h2>6. Ley Aplicable y Jurisdicción</h2>
      <p>Serán aplicables las normas del Ordenamiento jurídico español.</p>
      <p>
        <strong>Comprador profesional o empresa:</strong> En caso de controversia entre las partes,
        ambas, con renuncia expresa a su propio fuero se someten a la jurisdicción de los Tribunales y
        Juzgados de Santa Cruz de Tenerife.
      </p>
    </>
  )
}

/* ===== POLÍTICA DE PRIVACIDAD ===== */
function PoliticaPrivacidad() {
  return (
    <>
      <p>
        En cumplimiento del artículo 13, así como de los principios de licitud, lealtad y
        transparencia establecidos en el Reglamento UE 2016/679, General de Protección de Datos –en
        adelante RGPD–, le informamos que:
      </p>
      <p>
        El responsable del tratamiento de los datos personales que se pudieran recoger a través de los
        medios de contacto puestos a su disposición en este sitio web es Te Quiero Metales S.L., con
        NIF. B76620210, y con domicilio en Camino San Miguel de Geneto, 66 Local C. 38296 – Santa Cruz
        de Tenerife. Puede contactar con el responsable a través del teléfono{' '}
        <a href="tel:+34922263470">922 26 34 70</a> o del correo{' '}
        <a href="mailto:lopd@oroalmayor.com">lopd@oroalmayor.com</a>. En adelante Te Quiero Metales.
      </p>

      <h2>Información de protección de datos de los tratamientos realizados en el ámbito de la página web</h2>
      <p>
        Los datos personales que facilite a Te Quiero Metales a través de este sitio web, o cualquiera
        de los medios de contacto que pone a su disposición, podrán ser tratados con la finalidad que
        corresponda al motivo por el cual usted los facilitó. Así pues los datos facilitados podrán ser
        utilizados con las siguientes finalidades, según el motivo por el que los facilite:
      </p>

      <h3>Solicitudes de información</h3>
      <ul>
        <li><strong>Descripción:</strong> gestionar las solicitudes de información, así como para contestar las consultas que nos pudieran plantear a través de los medios de contacto puestos a disposición en nuestra página web.</li>
        <li><strong>Base jurídica:</strong> consentimiento del interesado, art. 6.1.a RGPD.</li>
        <li><strong>Conservación:</strong> los datos serán usados exclusivamente para contestar las consultas planteadas, posteriormente serán eliminados. El plazo de eliminación será como máximo a los 6 meses del último contacto con el usuario solicitante.</li>
        <li><strong>Destinatarios:</strong> los datos no serán cedidos a terceros salvo obligación legal.</li>
      </ul>

      <h3>Análisis de visitas de la web a través de cookies</h3>
      <ul>
        <li><strong>Finalidad:</strong> gestión de datos de navegación y preferencias de los usuarios.</li>
        <li><strong>Base jurídica:</strong> consentimiento del interesado, art. 6.1.a RGPD.</li>
        <li><strong>Conservación:</strong> el plazo de conservación de los datos recogidos por las cookies será el que se indica en la tabla que aparece en la <a href="#/politica-de-cookies">política de cookies</a>. El plazo contará a partir de la finalización de cada sesión del usuario en la página web.</li>
        <li><strong>Destinatarios:</strong> en caso de las cookies de terceros, los datos de navegación son gestionados por los propietarios de dichas cookies.</li>
      </ul>

      <h2>Tratamiento de datos recogidos a través de formularios, medios o documentos que redirigen a la política de privacidad de Te Quiero Metales</h2>
      <p>
        Fines del tratamiento de datos. Los datos personales recogidos en los distintos documentos,
        medios o formularios que redirigen a la presente política de privacidad, en su calidad de
        información ampliada en materia de protección de datos, podrán ser tratados con la finalidad
        que aplique, según sea uno de los siguientes casos:
      </p>

      <h3>Contratos (datos de personas de contacto y firmantes)</h3>
      <ul>
        <li><strong>Finalidad:</strong> Los datos personales de los firmantes de los contratos, para los casos en que éstos sean una persona física o en el caso de representantes de una persona jurídica serán tratados con el fin de formalizar el contrato y llevar a cabo el desarrollo del mismo. Los datos de empleados de las partes también serán tratados para este último fin.</li>
        <li><strong>Base jurídica:</strong> ejecución de un contrato art. 6.1.b RGPD, e interés legítimo de Te Quiero Metales para tratar datos de personas de contacto conforme art. 19 LOPD 3/2018.</li>
        <li><strong>Conservación:</strong> durante el tiempo exigido por la legislación vigente en materia civil, mercantil, financiera y tributaria.</li>
        <li><strong>Destinatarios:</strong> Los datos no serán cedidos a terceros, salvo obligación legal.</li>
      </ul>

      <h3>Formularios y solicitudes realizadas en nombre de empresas</h3>
      <ul>
        <li><strong>Finalidad:</strong> Los datos personales de las personas de contacto y de los representantes legales cuando actúan en nombre de personas jurídicas u otras organizaciones para realizar solicitudes de información, inscripción en convocatorias, o participación en eventos y actividades organizadas por Te Quiero Metales, serán tratados en exclusiva para dicho fin.</li>
        <li><strong>Base jurídica:</strong> interés legítimo de Te Quiero Metales para tratar datos de personas de contacto y representantes legales conforme art. 19 LOPD 3/2018.</li>
        <li><strong>Conservación:</strong> durante el tiempo exigido por la legislación vigente en materia civil, mercantil, y administrativa aplicable a Te Quiero Metales.</li>
        <li><strong>Destinatarios:</strong> Los datos no serán cedidos a terceros, salvo obligación legal. En todo caso todas las convocatorias se regirán por sus propias condiciones.</li>
      </ul>

      <h3>Facturación</h3>
      <ul>
        <li><strong>Finalidad:</strong> gestionar la relación contractual o precontractual entre usted y Te Quiero Metales, así como para su gestión administrativa, fiscal y contable.</li>
        <li><strong>Base jurídica:</strong> ejecución de un contrato o aplicación de medidas precontractuales, art. 6.1.b RGPD.</li>
        <li><strong>Conservación:</strong> durante el tiempo que exige la legislación vigente en materia civil, financiera y tributaria.</li>
        <li><strong>Destinatarios:</strong> los datos podrán ser comunicados a las AAPP competentes, bancos y cajas de ahorro según corresponda.</li>
      </ul>

      <h3>Gestión de presupuestos, ofertas y proyectos</h3>
      <ul>
        <li><strong>Finalidad:</strong> elaborar, entregar/remitir el presupuesto, así como para realizar acciones de seguimiento y prospección comercial, vía telefónica, telemática o presencial.</li>
        <li><strong>Base jurídica:</strong> consentimiento del interesado, así como la aplicación, a petición suya, de medidas precontractuales, art. 6.1.b RGPD.</li>
        <li><strong>Conservación:</strong> durante el tiempo exigido por la legislación vigente en materia civil, mercantil, financiera y tributaria. El plazo contará a partir de la finalización de la gestión del presupuesto.</li>
        <li><strong>Destinatarios:</strong> los datos no serán cedidos a terceros, salvo obligación legal.</li>
      </ul>

      <h3>Recepción de currículums</h3>
      <ul>
        <li><strong>Finalidad:</strong> gestionar su solicitud de empleo, y tenerle en cuenta en los procesos de selección de personal.</li>
        <li><strong>Base jurídica:</strong> consentimiento del interesado, art. 6.1.a. RGPD.</li>
        <li><strong>Conservación:</strong> los datos serán conservados durante un máximo de 2 años.</li>
        <li><strong>Destinatarios:</strong> los datos no serán cedidos a terceros salvo obligación legal.</li>
      </ul>

      <h3>Gestión de correo y agenda de contactos</h3>
      <ul>
        <li><strong>Finalidades:</strong> atender las solicitudes puntuales de información, vía correo electrónico o telefónico; gestionar la agenda de contactos; ejecución de contratos o medidas precontractuales.</li>
        <li><strong>Base jurídica:</strong> consentimiento del interesado en el caso de solicitudes de información o consultas (art. 6.1.a RGPD), aplicación de medidas precontractuales o ejecución de un contrato (art. 6.1.b RGPD), e interés legítimo en el tratamiento de datos de personas de contacto (art. 6.1.f RGPD).</li>
        <li><strong>Conservación:</strong> los datos serán conservados en la medida que sean necesarios para el cumplimiento de las obligaciones legales surgidas en la relación existente. Una vez extinguidas, los datos serán eliminados.</li>
        <li><strong>Destinatarios:</strong> los datos no serán cedidos a terceros, salvo obligación legal.</li>
      </ul>

      <h2>Datos de terceras personas</h2>
      <p>Si durante sus comunicaciones con Te Quiero Metales usted facilita datos de terceras personas, le informamos que:</p>
      <ul>
        <li>Solo puede facilitarnos datos de terceras personas, si cuenta con el consentimiento expreso de las mismas. Por lo tanto, al remitirnos datos de terceras personas, usted manifiesta que cuenta con el consentimiento antes mencionado, o bien, que cuenta con la capacidad legal para manifestar por ellas, dicho consentimiento.</li>
        <li>Todas las personas de las que nos remita datos deben conocer el contenido del presente apartado. Usted manifiesta que les ha informado y dado a conocer su contenido.</li>
        <li>Te Quiero Metales no se hace responsable en caso de que el usuario que se ponga en contacto con el responsable, no cumpla con los puntos anteriores.</li>
      </ul>

      <h2>Transferencias internacionales de datos</h2>
      <p>
        Te Quiero Metales utiliza servicios que por la ubicación de los servidores en los que alojan
        la información, o por la de su sede principal, la UE considera que al usarlos se realiza una
        transferencia internacional de datos a países fuera de la Unión Europea.
      </p>
      <p>
        Suena complejo, pero en realidad es una acción realizada en el día a día de cualquier empresa
        o persona que utilice redes sociales, o aplicaciones en la nube, correos de las grandes
        tecnológicas, etc. En el contexto de esta aclaración, le informamos que Te Quiero Metales
        realiza las siguientes transferencias internacionales de datos, cuando usa:
      </p>
      <ul>
        <li>
          <strong>G-SUITE:</strong> Te Quiero Metales utiliza G-SUITE, un servicio de gestión de
          correo electrónico y almacenamiento en la nube. Esta herramienta si bien almacena datos en
          servidores alojados en EU, tiene su central en EEUU, por lo que se realiza una transferencia
          internacional de datos a la misma. Más información:{' '}
          <a href="https://policies.google.com/privacy?hl=es" target="_blank" rel="noopener">policies.google.com/privacy</a>.
        </li>
      </ul>

      <h2>Derechos de los usuarios</h2>
      <h3>Consentimiento y revocación</h3>
      <p>
        El usuario podrá revocar los consentimientos dados, en cualquier momento, sin que ello afecte
        la licitud del tratamiento de los datos durante el periodo efectivo, anterior, de dicha
        autorización.
      </p>
      <h3>Derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad</h3>
      <p>
        El usuario o visitante, podrá solicitar el ejercicio de sus derechos de acceso, rectificación
        o supresión, así como en determinados casos, si le fuera de aplicación, a la limitación del
        tratamiento o portabilidad de sus datos, así como a oponerse al tratamiento de los mismos.
        Todo ello conforme a la normativa de protección de datos antes señalada.
      </p>
      <p>
        Puede ejercitar sus derechos de la protección de datos remitiendo su solicitud a Te Quiero
        Metales, a través del correo <a href="mailto:lopd@oroalmayor.com">lopd@oroalmayor.com</a>, o a
        la dirección de contacto indicada al principio de este documento. Si lo desea puede utilizar
        los formularios disponibles en la Agencia Española de Protección de Datos, o solicitarnos copia
        de los mismos vía correo electrónico.
      </p>
      <p>
        Las solicitudes de ejercicio de derechos, realizadas por los usuarios serán gestionadas en un
        plazo máximo de un mes. En caso de no estar conforme con la respuesta dada, el usuario puede
        presentar una reclamación ante la citada autoridad de control. Su solicitud será atendida en
        un plazo no mayor a 30 días. Puede ejercitar los derechos que le reconoce el RGPD, en cualquier
        momento.
      </p>
      <p>
        Te Quiero Metales está comprometido con el respeto y defensa del derecho de la protección de
        datos personales, de sus usuarios, visitantes y clientes.
      </p>
    </>
  )
}

/* ===== POLÍTICA DE COOKIES ===== */
function PoliticaCookies() {
  return (
    <>
      <div className="legal-card">
        <div className="legal-card-title">Información básica de protección de datos</div>
        <ul className="legal-data">
          <li><span>Responsable</span> Te Quiero Metales S.L.</li>
          <li><span>Finalidad</span> gestión de datos de navegación y análisis de las visitas de la web.</li>
          <li><span>Derechos</span> puede ejercitar su derecho de acceso, rectificación, supresión y otros, tal como aparece en la información ampliada que puede conocer visitando nuestra <a href="#/politica-de-privacidad">política de privacidad</a>.</li>
        </ul>
      </div>

      <p>
        En cumplimiento de lo establecido en el art. 22.2 de la Ley 34/2002 de Servicios de la
        Sociedad de la información (LSSI), desde Te Quiero Metales le informamos que para la correcta
        navegación y uso de esta página web se requiere de la instalación de cookies.
      </p>
      <p>
        La finalidad de la instalación, y por ende tratamiento de datos personales asociados al uso de
        esta tecnología es la configuración de medidas técnicas de seguridad, personalización, y
        funcionamiento básico de la web (cookies técnicas), así como la realización de análisis del
        paso por la web de los visitantes y usuarios (cookies analíticas), la configuración y muestra
        de publicidad básica (cookies de publicidad).
      </p>
      <p>
        El plazo de conservación de los datos recogidos por las cookies será el que se indica en la
        tabla que aparece más adelante, en este mismo apartado. El plazo contará a partir de la
        finalización de cada sesión del usuario en la página web.
      </p>
      <p>
        Usted puede elegir prestar o no su consentimiento a la instalación de las cookies de Te Quiero
        Metales, en el caso de no aceptarlas, o de bloquearlas, la navegación por la página puede no
        ser correcta. Entre los fallos más habituales por la no instalación de las cookies se
        encuentra el error en la carga de contenidos multimedia, la imposibilidad de entrar en la zona
        cliente o de configurar las preferencias de uso de la página.
      </p>

      <h2>¿Qué son las Cookies?</h2>
      <p>
        Las cookies son pequeños ficheros de texto, que guardan información del usuario y se almacenan
        en su propio dispositivo bien sea PC, Tablet o móvil.
      </p>

      <h2>¿Quién emite las cookies y para qué?</h2>
      <p>
        Las cookies son emitidas por una página web, con la finalidad de mejorar la experiencia de
        navegación del usuario, así como para realizar análisis de sus acciones dentro de la web. Las
        cookies permiten que la página web que las ha emitido recuerde las elecciones y características
        de navegación del usuario.
      </p>

      <h2>¿Qué tipos de cookies existen?</h2>
      <p>Las cookies pueden catalogarse según 3 criterios:</p>
      <ul>
        <li>Entidad que las gestiona: Si son propias o de terceros.</li>
        <li>Plazo en que permanecen activas: Cookies de sesión o persistentes.</li>
        <li>
          Según su finalidad:
          <ul>
            <li>Cookies técnicas. (no requieren consentimiento)</li>
            <li>Cookies de personalización.</li>
            <li>Cookies de análisis.</li>
            <li>Cookies publicitarias.</li>
            <li>Cookies de publicidad comportamental.</li>
          </ul>
        </li>
      </ul>

      <h2>¿Cómo administro las cookies de mis dispositivos?</h2>
      <p>
        Usted elige si acepta o no la instalación de cookies de esta página web,{' '}
        <a href="https://www.oroalmayor.com" target="_blank" rel="noopener">www.oroalmayor.com</a>, en
        sus dispositivos. Puede elegir el bloqueo directo de la instalación de las cookies desde su
        navegador, así como también puede elegir la instalación de unas y el borrado de otras.
      </p>
      <p>Cómo configurar las cookies según su navegador:</p>
      <ul>
        <li><strong>Internet Explorer:</strong> Herramientas &gt; Opciones de Internet &gt; Privacidad &gt; Configuración. Para más información, puede consultar el soporte de Microsoft o la Ayuda del navegador.</li>
        <li><strong>Firefox:</strong> Herramientas &gt; Opciones &gt; Privacidad &gt; Historial &gt; Configuración Personalizada. Para más información, puede consultar el soporte de Mozilla o la Ayuda del navegador.</li>
        <li><strong>Chrome:</strong> Configuración &gt; Mostrar opciones avanzadas &gt; Privacidad &gt; Configuración de contenido. Para más información, puede consultar el soporte de Google o la Ayuda del navegador.</li>
        <li><strong>Safari:</strong> Preferencias &gt; Seguridad. Para más información, puede consultar el soporte de Apple o la Ayuda del navegador.</li>
        <li><strong>Opera:</strong> Configuración &gt; Opciones &gt; Avanzado. Para más información, puede consultar el soporte de Opera o la Ayuda del navegador.</li>
      </ul>
      <p className="legal-note">
        *Estas configuraciones pueden no estar disponibles en dispositivos móviles tales como tabletas
        o smartphones.<br />
        *Si usa otro navegador distinto a los anteriores, consulte su política de instalación, uso y
        bloqueo de cookies.
      </p>

      <h2>Cookies utilizadas en esta web</h2>
      <p>
        La siguiente es una relación de las cookies usadas en esta página web. Esta lista no tiene
        carácter limitativo.
      </p>

      <h3>Cookies propias (con finalidades técnicas)</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr><th>Cookie</th><th>Duración</th><th>Información que nos facilita</th></tr>
          </thead>
          <tbody>
            <tr><td>wpSGCacheBypass</td><td>1 mes</td><td>Utilizada para mejorar el uso del caché.</td></tr>
            <tr><td>catAccCookies</td><td>1 día</td><td>Guarda la decisión del usuario de aceptar el aviso de cookies.</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Cookies de terceros — finalidades técnicas</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr><th>Nombre</th><th>Propietario</th><th>Duración</th><th>Acción que realiza</th></tr>
          </thead>
          <tbody>
            <tr><td>CONSENT</td><td>Google</td><td>20 años</td><td>Cookie de Google Maps, se usa para el funcionamiento del mapa de Google.</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Cookies de terceros — finalidad de análisis</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr><th>Nombre</th><th>Propietario</th><th>Duración</th><th>Acción que realiza</th></tr>
          </thead>
          <tbody>
            <tr><td>NID</td><td>Google</td><td>6 meses</td><td>Implanta determinadas utilidades de Google y pueden almacenar ciertas preferencias.</td></tr>
            <tr><td>1P_JAR</td><td>Google</td><td>1 mes</td><td>Transfiere estadísticas a Google.</td></tr>
            <tr><td>_sp_id.cf1a</td><td>.tradingview.com</td><td>2 años</td><td>Estas cookies tienen la finalidad de mejorar la publicidad.</td></tr>
            <tr><td>_sp_ses.cf1a</td><td>.tradingview.com</td><td>20 min</td><td>Estas cookies tienen la finalidad de mejorar la publicidad.</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Cookies de terceros — finalidades publicitarias</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr><th>Nombre</th><th>Propietario</th><th>Duración</th><th>Acción que realiza</th></tr>
          </thead>
          <tbody>
            <tr><td>IDE</td><td>Doubleclick.net</td><td>1 año</td><td>Es una cookie publicitaria y se utiliza para orientar la publicidad según el contenido que es relevante para un usuario.</td></tr>
            <tr><td>ANID</td><td>Google</td><td>1 año</td><td>Estas cookies tienen la finalidad de mejorar la publicidad.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Te Quiero Metales y Google Analytics</h2>
      <p>
        Con el fin de mejorar la oferta de nuestros productos, hacemos uso del servicio de analítica
        web de Google Inc.: Google Analytics, que nos permite realizar un seguimiento ANÓNIMO de las
        acciones de un usuario en nuestra web. Las cookies que se instalan al hacer uso del servicio de
        Google Analytics son:
      </p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr><th>Cookie</th><th>Duración</th><th>Información que nos facilita</th></tr>
          </thead>
          <tbody>
            <tr><td>_ga</td><td>2 años</td><td>Se usa para diferenciar usuarios.</td></tr>
            <tr><td>_gat</td><td>24 horas</td><td>Se usa para diferenciar usuarios.</td></tr>
            <tr><td>_gid</td><td>1 minuto</td><td>Se hace para limitar el porcentaje de solicitudes. Al usar Google Tag Manager se puede llamar.</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Google, Inc. tiene sus servidores en Estados Unidos de América, y se encuentra adherido al
        acuerdo de Privacy Shield (escudo de seguridad) lo que ampara el tratamiento de datos bajo las
        condiciones del acuerdo EEUU – UE en relación al tratamiento de los datos personales. Más
        información:{' '}
        <a href="https://www.privacyshield.gov/welcome" target="_blank" rel="noopener">privacyshield.gov/welcome</a>.
      </p>

      <h2>Actualización de la política de cookies y uso de otras cookies</h2>
      <p>
        Con la evolución tecnológica el uso de distintas cookies se presenta muy posible, por lo que en
        caso de implementar el uso de cookies que afecten su privacidad de forma distinta a las que
        haya autorizado anteriormente, le informaremos y solicitaremos su consentimiento.
      </p>
    </>
  )
}

/* ===== CONDICIONES DE VENTA ===== */
function CondicionesVenta() {
  return (
    <>
      <p className="legal-note">
        Tenga en cuenta que, por razones logísticas, su pedido no se empezará a preparar hasta haber
        recibido el ingreso. Si tiene alguna duda al respecto, contacte con nosotros antes de
        finalizar el pedido.
      </p>

      <h2>Precios</h2>
      <p>
        (Consultar precios actualizados llamando a oficina). Los precios pueden sufrir variaciones sin
        previo aviso debido a las fluctuaciones del mercado. Los precios facilitados por nuestros
        comerciales, corresponden a las mercancías puestas en nuestros almacenes. Los precios por
        pedidos bajo demanda del cliente pueden conllevar una mayor demora de confirmación.
      </p>

      <h3>Precios productos que contengan oro y plata</h3>
      <p>
        Los precios indicados en artículos que contengan metales preciosos como oro, plata, rodio,
        estarán en la medida de lo posible actualizados; si debido a los cambios de cotización no se
        pudieran aplicar los precios indicados de su pedido anterior, nuestro comercial le informará
        antes de su nueva compra.
      </p>

      <h2>Envíos express</h2>
      <p>
        Si contrata un servicio express por mensajería, los portes van por cuenta del cliente. Los
        costes del servicio express pueden variar, según tamaño, peso y coste.
      </p>

      <h2>Recogida de productos</h2>
      <p>
        La recogida podrá ser en nuestra tienda oficial Te Quiero Metales, en Camino San Miguel de
        Geneto 66 Local C.
      </p>
      <ul>
        <li><strong>Zona Sur de Tenerife:</strong> podrá recoger la mercancía en la Joyería Te Quiero, en Avenida Santa Cruz 107. Horario de 09:00 a 20:00 horas de lunes a sábados.</li>
        <li><strong>Zona Norte:</strong> Joyería Te Quiero, Calle Cupido nº 9, horario de 09:00 a 20:00 horas de lunes a viernes y sábado de 10:00 a 13:45 horas.</li>
        <li><strong>Zona Santa Cruz:</strong> Joyería Te Quiero, Calle Villalba Hervás nº 1, horario de 09:00 a 20:00 horas de lunes a viernes.</li>
      </ul>
      <p>
        Los puntos de recogida que no sean en la tienda oficial de Te Quiero Metales, tendrán un plazo
        de entrega por nuestra parte de 15 días hábiles, a partir del pago del producto comprado.
      </p>

      <h2>Recogida y entrega</h2>
      <p>
        Para poder recoger el producto comprado, hará falta la entrega del documento DNI para
        verificación del cliente y la posterior retirada de la herramienta.
      </p>

      <h2>Pedidos</h2>
      <p>
        Los productos que estén bajo pedido tendrán un plazo de entrega de 15 días hábiles a partir de
        la fecha de la compra, el precio del producto puede variar dependiendo del servicio de entrega
        que el cliente haya elegido. (Si no está en stock el tiempo podrá ser mayor).
      </p>

      <h2>Derechos de devolución</h2>
      <p>
        No se aceptarán devoluciones transcurridos 7 días desde la fecha de recepción de la mercancía,
        salvo autorización expresa por parte de la empresa. Todas las devoluciones han de venir a
        portes pagados, excepto si se trata de un error por nuestra parte, dentro de su embalaje
        original y en perfectas condiciones para su venta.
      </p>

      <h2>Formas de pago</h2>
      <ul>
        <li>Transferencia Bancaria.</li>
        <li>Pago en efectivo.</li>
      </ul>
    </>
  )
}

const PAGES = {
  'aviso-legal': AvisoLegal,
  'politica-de-privacidad': PoliticaPrivacidad,
  'politica-de-cookies': PoliticaCookies,
  'condiciones-de-venta': CondicionesVenta,
}

export default function LegalPage({ slug }) {
  const meta = TITLES[slug]
  const Body = PAGES[slug]
  if (!meta || !Body) return null

  return (
    <main className="legal">
      <div className="legal-head">
        <div className="legal-head-inner">
          <a href="#inicio" className="legal-back">← Volver al inicio</a>
          <div className="legal-tag">{meta.tag}</div>
          <h1 className="legal-title">{meta.title}</h1>
        </div>
      </div>
      <div className="legal-inner">
        <article className="legal-content">
          <Body />
        </article>
      </div>
    </main>
  )
}
