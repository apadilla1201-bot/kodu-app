export type Lang = 'en' | 'es'

export const copy = {
  en: {
    nav: { modules: 'Modules', how: 'How it works', faq: 'FAQ', signin: 'Sign in', cta: 'Start free' },
    hero: {
      badge: 'For PMs, GCs & Owner\u2019s Reps',
      h1a: 'Run your project controls',
      h1b: 'in one system — not in Excel.',
      sub: 'Kodu PM tracks Change Orders, RFIs, Submittals, Buyout, Daily Logs and Pay Applications for construction teams. Import your CO LOG from Excel and be up and running in minutes.',
      cta1: 'Start free',
      cta2: 'See how it works',
      micro: 'Bilingual EN/ES · Free to start · Built for construction',
      card: { projects: 'Total Projects', cors: 'Total CORs', approved: 'Approved Value', rfis: 'Open RFIs', recent: 'Latest Change Orders' },
    },
    problem: {
      kicker: 'The problem',
      h2: 'Your CO LOG shouldn\u2019t live in a spreadsheet',
      items: [
        { t: 'CORs get lost', d: 'Change orders buried in Excel tabs and email threads — approved work you forget to bill.' },
        { t: 'No single truth', d: 'The office, the field and the owner each have a different version of the numbers.' },
        { t: 'Reports take hours', d: 'Building a COR package or pay app backup by hand, every single month.' },
      ],
    },
    modules: {
      kicker: 'One system',
      h2: 'Everything a PM actually uses',
      sub: 'Ten modules built around how construction projects really run.',
      list: [
        { t: 'Change Orders', d: 'COR tracking with cost summaries — markup, tax, insurance — and one-click client-ready PDFs.' },
        { t: 'RFI Log', d: 'Statuses, priorities, due dates and overdue alerts across all your projects.' },
        { t: 'Submittals', d: 'Track packages from submitted to approved without losing a single spec.' },
        { t: 'Buyout', d: 'Committed vs. budget by trade, so you know where every dollar went.' },
        { t: 'Pay Applications', d: 'AIA G702/G703 style pay apps with percent complete and billed-to-date.' },
        { t: 'Daily Logs', d: 'Field reports from the jobsite, tied to the project record.' },
        { t: 'Site Photos', d: 'Progress photos organized by project, not lost in camera rolls.' },
        { t: 'CPM Schedule', d: 'Import your schedule, view the Gantt and run lookaheads.' },
        { t: 'Analytics', d: 'Earned value and cashflow by project — the numbers your owner asks for.' },
      ],
    },
    import: {
      kicker: 'From Excel to system',
      h2: 'Import your CO LOG in minutes',
      sub: 'You don\u2019t need to start from zero. Upload the Excel log you already use — Kodu PM detects the CO LOG sheet and builds your project history automatically.',
      steps: [
        { t: 'Upload file', d: 'Drop your .xlsx CO LOG as-is.' },
        { t: 'Preview data', d: 'We detect every COR with status and amounts.' },
        { t: 'Configure project', d: 'Match it to the right project.' },
        { t: 'Done', d: 'Your full history, searchable and reportable.' },
      ],
    },
    bilingual: {
      kicker: 'Made for Miami',
      h2: 'Truly bilingual. English y Español.',
      sub: 'The UI, exported PDFs and Excel reports work in English and Spanish — because your office, your field crews and your clients don\u2019t all speak the same language.',
      points: ['Interface EN/ES with one click', 'Client-ready PDFs in either language', 'Built by construction people in Miami'],
    },
    faq: {
      kicker: 'FAQ',
      h2: 'Common questions',
      items: [
        { q: 'Do I have to migrate all my data by hand?', a: 'No. Upload your existing Excel CO LOG and Kodu PM imports your change orders automatically — statuses, amounts and details.' },
        { q: 'Is it really bilingual?', a: 'Yes. The interface and the exported reports (PDF and Excel) work in English and Spanish.' },
        { q: 'Who is Kodu PM for?', a: 'Project managers, general contractors and owner\u2019s representatives who run project controls: CORs, RFIs, submittals, pay apps and schedules.' },
        { q: 'Does it work on the jobsite?', a: 'Yes. It\u2019s a web app you can install on your phone like a native app (PWA), so the field can use it offline-friendly on site.' },
      ],
    },
    final: {
      h2: 'Stop losing change orders in Excel.',
      sub: 'Import your CO LOG and run your first project today.',
      cta: 'Start free',
    },
    footer: {
      tag: 'Project controls for construction teams.',
      product: 'Product', company: 'Company',
      signin: 'Sign in', start: 'Start free',
      built: 'Built in Miami by The Project Delivery Group LLC',
    },
  },
  es: {
    nav: { modules: 'Módulos', how: 'Cómo funciona', faq: 'Preguntas', signin: 'Iniciar sesión', cta: 'Empieza gratis' },
    hero: {
      badge: 'Para PMs, GCs y Owner\u2019s Reps',
      h1a: 'Maneja tus project controls',
      h1b: 'en un solo sistema — no en Excel.',
      sub: 'Kodu PM controla Change Orders, RFIs, Submittals, Buyout, Daily Logs y Pay Applications para equipos de construcción. Importa tu CO LOG de Excel y empieza en minutos.',
      cta1: 'Empieza gratis',
      cta2: 'Ver cómo funciona',
      micro: 'Bilingüe EN/ES · Gratis para empezar · Hecho para construcción',
      card: { projects: 'Proyectos', cors: 'CORs totales', approved: 'Valor aprobado', rfis: 'RFIs abiertos', recent: 'Últimos Change Orders' },
    },
    problem: {
      kicker: 'El problema',
      h2: 'Tu CO LOG no debería vivir en un Excel',
      items: [
        { t: 'Los CORs se pierden', d: 'Change orders enterrados en pestañas de Excel y correos — trabajo aprobado que olvidas facturar.' },
        { t: 'No hay una sola verdad', d: 'La oficina, el campo y el owner tienen cada uno una versión distinta de los números.' },
        { t: 'Reportes que toman horas', d: 'Armar el paquete de CORs o el backup del pay app a mano, todos los meses.' },
      ],
    },
    modules: {
      kicker: 'Un solo sistema',
      h2: 'Todo lo que un PM realmente usa',
      sub: 'Diez módulos construidos alrededor de cómo operan los proyectos de verdad.',
      list: [
        { t: 'Change Orders', d: 'Control de CORs con resumen de costos — markup, tax, seguro — y PDFs para el cliente con un clic.' },
        { t: 'RFI Log', d: 'Estados, prioridades, fechas límite y alertas de vencidos en todos tus proyectos.' },
        { t: 'Submittals', d: 'Sigue cada paquete desde enviado hasta aprobado sin perder un solo spec.' },
        { t: 'Buyout', d: 'Comprometido vs. presupuesto por oficio — sabes dónde quedó cada dólar.' },
        { t: 'Pay Applications', d: 'Pay apps estilo AIA G702/G703 con porcentaje de avance y facturado a la fecha.' },
        { t: 'Daily Logs', d: 'Reportes de campo desde la obra, ligados al expediente del proyecto.' },
        { t: 'Site Photos', d: 'Fotos de progreso organizadas por proyecto, no perdidas en el celular.' },
        { t: 'CPM Schedule', d: 'Importa tu cronograma, mira el Gantt y genera lookaheads.' },
        { t: 'Analytics', d: 'Earned value y cashflow por proyecto — los números que pide tu owner.' },
      ],
    },
    import: {
      kicker: 'De Excel al sistema',
      h2: 'Importa tu CO LOG en minutos',
      sub: 'No empiezas de cero. Sube el log de Excel que ya usas — Kodu PM detecta la hoja CO LOG y construye el historial de tu proyecto automáticamente.',
      steps: [
        { t: 'Sube el archivo', d: 'Arrastra tu CO LOG .xlsx tal cual.' },
        { t: 'Revisa la data', d: 'Detectamos cada COR con estado y montos.' },
        { t: 'Configura el proyecto', d: 'Asócialo al proyecto correcto.' },
        { t: 'Listo', d: 'Todo tu historial, buscable y reportable.' },
      ],
    },
    bilingual: {
      kicker: 'Hecho para Miami',
      h2: 'Verdaderamente bilingüe. English y Español.',
      sub: 'La interfaz, los PDFs y los reportes de Excel funcionan en inglés y en español — porque tu oficina, tus cuadrillas y tus clientes no hablan el mismo idioma.',
      points: ['Interfaz EN/ES con un clic', 'PDFs para el cliente en cualquiera de los dos idiomas', 'Hecho por gente de construcción en Miami'],
    },
    faq: {
      kicker: 'Preguntas',
      h2: 'Preguntas frecuentes',
      items: [
        { q: '¿Tengo que migrar toda mi data a mano?', a: 'No. Sube tu CO LOG de Excel y Kodu PM importa tus change orders automáticamente — estados, montos y detalles.' },
        { q: '¿De verdad es bilingüe?', a: 'Sí. La interfaz y los reportes exportados (PDF y Excel) funcionan en inglés y en español.' },
        { q: '¿Para quién es Kodu PM?', a: 'Project managers, general contractors y owner\u2019s representatives que manejan project controls: CORs, RFIs, submittals, pay apps y cronogramas.' },
        { q: '¿Funciona en la obra?', a: 'Sí. Es una web app que se instala en tu teléfono como app nativa (PWA), para usarla en campo.' },
      ],
    },
    final: {
      h2: 'Deja de perder change orders en Excel.',
      sub: 'Importa tu CO LOG y corre tu primer proyecto hoy.',
      cta: 'Empieza gratis',
    },
    footer: {
      tag: 'Project controls para equipos de construcción.',
      product: 'Producto', company: 'Compañía',
      signin: 'Iniciar sesión', start: 'Empieza gratis',
      built: 'Hecho en Miami por The Project Delivery Group LLC',
    },
  },
} as const

export const APP_URL = 'https://app.kodupm.com/login'
