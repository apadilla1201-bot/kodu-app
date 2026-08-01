// Manual del usuario — contenido bilingüe por módulo.
// Cada guía explica: qué es, para qué sirve, y los pasos exactos.
// Objetivo: que NADIE necesite llamar al administrador para operar.

export type HelpGuide = {
  id: string;
  icon: string; // nombre del icono lucide usado en la página
  roles: string; // i18n key suffix for who sees it
  en: {
    title: string;
    summary: string;
    sections: { heading: string; steps: string[] }[];
  };
  es: {
    title: string;
    summary: string;
    sections: { heading: string; steps: string[] }[];
  };
};

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: 'dashboard',
    icon: 'LayoutDashboard',
    roles: 'all',
    en: {
      title: 'Dashboard',
      summary: 'Your daily command center: all projects at a glance.',
      sections: [
        {
          heading: 'What you see',
          steps: [
            'Every card is a project with its live numbers: total CORs, how many are Approved / Pending / Rejected, open RFIs and overdue RFIs.',
            'Amounts shown are the approved and pending change-order dollars per project.',
            'Click any project card to open its full detail.',
          ],
        },
        {
          heading: 'Daily habit (recommended)',
          steps: [
            'Start your day here: anything red (overdue RFIs) needs an answer today.',
            'Then check Approvals for everything waiting on a decision.',
          ],
        },
      ],
    },
    es: {
      title: 'Dashboard',
      summary: 'Tu centro de mando diario: todos los proyectos de un vistazo.',
      sections: [
        {
          heading: 'Qué ves',
          steps: [
            'Cada tarjeta es un proyecto con sus números en vivo: CORs totales, cuántos están Aprobados / Pendientes / Rechazados, RFIs abiertos y RFIs vencidos.',
            'Los montos son los dólares de change orders aprobados y pendientes por proyecto.',
            'Haz clic en cualquier tarjeta de proyecto para abrir su detalle completo.',
          ],
        },
        {
          heading: 'Hábito diario (recomendado)',
          steps: [
            'Empieza tu día aquí: cualquier cosa en rojo (RFIs vencidos) necesita respuesta hoy.',
            'Después revisa Aprobaciones para todo lo que espera una decisión.',
          ],
        },
      ],
    },
  },
  {
    id: 'projects',
    icon: 'FolderKanban',
    roles: 'all',
    en: {
      title: 'Projects',
      summary: 'Create and manage your construction projects.',
      sections: [
        {
          heading: 'Create a project',
          steps: [
            'Click New Project and fill in: project number, name, client, location and contract amount.',
            'The project number appears on every RFI, COR and PDF — use your real job number.',
            'After creating it, open the project to add contacts (architect, owner rep, subs) in the Directory — you will need them for RFIs and CORs.',
          ],
        },
        {
          heading: 'Inside a project',
          steps: [
            'Each project has its own RFIs, Submittals, CORs, Pay Applications, Budget, Photos and Daily Logs.',
            'Everything you create inside a project stays linked to it and appears on its PDFs.',
          ],
        },
      ],
    },
    es: {
      title: 'Proyectos',
      summary: 'Crea y administra tus proyectos de construcción.',
      sections: [
        {
          heading: 'Crear un proyecto',
          steps: [
            'Haz clic en New Project y llena: número de proyecto, nombre, cliente, ubicación y monto del contrato.',
            'El número de proyecto aparece en cada RFI, COR y PDF — usa el número real de tu obra.',
            'Después de crearlo, abre el proyecto y agrega contactos (arquitecto, representante del dueño, subs) en el Directory — los necesitarás para RFIs y CORs.',
          ],
        },
        {
          heading: 'Dentro de un proyecto',
          steps: [
            'Cada proyecto tiene sus propios RFIs, Submittals, CORs, Pay Applications, Budget, Photos y Daily Logs.',
            'Todo lo que creas dentro de un proyecto queda ligado a él y aparece en sus PDFs.',
          ],
        },
      ],
    },
  },
  {
    id: 'rfis',
    icon: 'FileQuestion',
    roles: 'all',
    en: {
      title: 'RFI Log',
      summary: 'Requests for Information: ask, track and close — without chasing anyone.',
      sections: [
        {
          heading: 'Create an RFI',
          steps: [
            'Open your project → RFI Log → New RFI.',
            'Fill subject and question clearly — write it so the architect can answer without calling you.',
            'Assign it to a contact (architect/engineer). Set the due date — this drives the overdue alerts.',
          ],
        },
        {
          heading: 'The magic: answers with no password',
          steps: [
            'The assignee receives an email with a secure link. They answer straight from the email — no account, no password.',
            'You get notified when they respond, and you close the RFI (even from your own email link).',
          ],
        },
        {
          heading: 'Statuses',
          steps: [
            'Open = waiting for an answer. Under Review = answered, being evaluated. Closed = done.',
            'Overdue = past its due date and still open — these appear in the bell and in Approvals.',
          ],
        },
      ],
    },
    es: {
      title: 'RFI Log',
      summary: 'Solicitudes de Información: pregunta, sigue y cierra — sin perseguir a nadie.',
      sections: [
        {
          heading: 'Crear un RFI',
          steps: [
            'Abre tu proyecto → RFI Log → New RFI.',
            'Escribe el asunto y la pregunta con claridad — redáctalo para que el arquitecto pueda responder sin llamarte.',
            'Asígnalo a un contacto (arquitecto/ingeniero). Define la fecha límite — de ella dependen las alertas de vencimiento.',
          ],
        },
        {
          heading: 'La magia: respuestas sin contraseña',
          steps: [
            'El asignado recibe un correo con un enlace seguro. Responde directo desde el correo — sin cuenta, sin contraseña.',
            'Tú recibes el aviso cuando responden y cierras el RFI (incluso desde tu propio enlace del correo).',
          ],
        },
        {
          heading: 'Estados',
          steps: [
            'Open = esperando respuesta. Under Review = respondido, en evaluación. Closed = terminado.',
            'Vencido = pasó su fecha límite y sigue abierto — aparecen en la campana y en Aprobaciones.',
          ],
        },
      ],
    },
  },
  {
    id: 'submittals',
    icon: 'FileStack',
    roles: 'all',
    en: {
      title: 'Submittals',
      summary: 'Shop drawings and material approvals before work starts.',
      sections: [
        {
          heading: 'Create a submittal',
          steps: [
            'Open your project → Submittals → New Submittal.',
            'Use the spec section (e.g. 03 30 00) so it matches the project manual — reviewers love this.',
            'Assign the reviewer (architect/engineer) and set the required date (when you need it back to not delay the job).',
          ],
        },
        {
          heading: 'Review flow',
          steps: [
            'Draft → Submitted → Under Review → Approved (or Revise & Resubmit / Rejected).',
            'The reviewer answers from their email, same as RFIs — no password.',
            'If it comes back "Revise and Resubmit", create the resubmission as a new revision and repeat.',
          ],
        },
      ],
    },
    es: {
      title: 'Submittals',
      summary: 'Shop drawings y aprobaciones de materiales antes de ejecutar.',
      sections: [
        {
          heading: 'Crear un submittal',
          steps: [
            'Abre tu proyecto → Submittals → New Submittal.',
            'Usa la sección del spec (ej. 03 30 00) para que coincida con el manual del proyecto — los revisores lo agradecen.',
            'Asigna el revisor (arquitecto/ingeniero) y define la fecha requerida (cuándo lo necesitas de vuelta para no atrasar la obra).',
          ],
        },
        {
          heading: 'Flujo de revisión',
          steps: [
            'Draft → Submitted → Under Review → Approved (o Revise & Resubmit / Rejected).',
            'El revisor responde desde su correo, igual que los RFIs — sin contraseña.',
            'Si regresa "Revise and Resubmit", crea el reenvío como una nueva revisión y repite.',
          ],
        },
      ],
    },
  },
  {
    id: 'buyout',
    icon: 'ClipboardList',
    roles: 'all',
    en: {
      title: 'Buyout',
      summary: 'Track subcontractor awards trade by trade.',
      sections: [
        {
          heading: 'How to use it',
          steps: [
            'List every trade of the project (concrete, framing, MEP, finishes…).',
            'For each trade record the awarded subcontractor and the contract amount.',
            'Compare awarded amounts against your budget lines to see if you are buying out under or over budget.',
          ],
        },
      ],
    },
    es: {
      title: 'Buyout',
      summary: 'Controla la adjudicación de subcontratistas por oficio.',
      sections: [
        {
          heading: 'Cómo usarlo',
          steps: [
            'Lista cada oficio del proyecto (concreto, framing, MEP, acabados…).',
            'Por cada oficio registra el subcontratista adjudicado y el monto del contrato.',
            'Compara los montos adjudicados contra tus líneas de presupuesto para ver si estás comprando por debajo o por encima del presupuesto.',
          ],
        },
      ],
    },
  },
  {
    id: 'payapps',
    icon: 'Wallet',
    roles: 'management',
    en: {
      title: 'Pay Applications',
      summary: 'Monthly billing to the owner (G702/G703 style).',
      sections: [
        {
          heading: 'Create a pay application',
          steps: [
            'Open your project → Pay Applications → New.',
            'Set the billing period (from / to). The system carries your Schedule of Values.',
            'Enter work completed this period per line and stored materials — retainage calculates automatically.',
          ],
        },
        {
          heading: 'Numbers you must check before sending',
          steps: [
            'Total completed to date, retainage withheld, previous payments, and current amount due.',
            'Generate the PDF and review it — that is exactly what the owner and architect will see.',
          ],
        },
      ],
    },
    es: {
      title: 'Pay Applications',
      summary: 'Facturación mensual al dueño (estilo G702/G703).',
      sections: [
        {
          heading: 'Crear un pay application',
          steps: [
            'Abre tu proyecto → Pay Applications → New.',
            'Define el período de facturación (desde / hasta). El sistema trae tu Schedule of Values.',
            'Captura el trabajo completado del período por línea y materiales almacenados — la retención se calcula sola.',
          ],
        },
        {
          heading: 'Números que debes revisar antes de enviar',
          steps: [
            'Total completado a la fecha, retención, pagos anteriores y monto actual a cobrar.',
            'Genera el PDF y revísalo — eso es exactamente lo que verán el dueño y el arquitecto.',
          ],
        },
      ],
    },
  },
  {
    id: 'budgets',
    icon: 'Receipt',
    roles: 'management',
    en: {
      title: 'Budgets',
      summary: 'Your project budget — import it from Excel, no retyping.',
      sections: [
        {
          heading: 'Import your budget',
          steps: [
            'Go to Budgets → New Budget and pick your project.',
            'Upload your Excel/CSV estimate as-is (line items with division code, description and scheduled value).',
            'Review the imported lines and totals, then save. Create a new version instead of editing when the budget changes.',
          ],
        },
      ],
    },
    es: {
      title: 'Presupuestos',
      summary: 'Tu presupuesto de obra — impórtalo desde Excel, sin recapturar.',
      sections: [
        {
          heading: 'Importar tu presupuesto',
          steps: [
            'Ve a Budgets → New Budget y elige tu proyecto.',
            'Sube tu estimado en Excel/CSV tal cual (líneas con código de división, descripción y valor programado).',
            'Revisa las líneas y totales importados y guarda. Cuando el presupuesto cambie, crea una nueva versión en vez de editar.',
          ],
        },
      ],
    },
  },
  {
    id: 'photos',
    icon: 'Camera',
    roles: 'all',
    en: {
      title: 'Site Photos',
      summary: 'Photo record of the job — your legal backup.',
      sections: [
        {
          heading: 'How to use it',
          steps: [
            'Upload photos from the field (phone or computer). Group them by project.',
            'Take photos of work before it gets covered (underground utilities, rebar, waterproofing) — they settle disputes later.',
            'Photos feed the Daily Logs and the weekly owner report.',
          ],
        },
      ],
    },
    es: {
      title: 'Fotos de obra',
      summary: 'Registro fotográfico del trabajo — tu respaldo legal.',
      sections: [
        {
          heading: 'Cómo usarlo',
          steps: [
            'Sube fotos desde el campo (teléfono o computadora). Agrúpalas por proyecto.',
            'Fotografía el trabajo antes de que quede cubierto (tubos enterrados, acero, impermeabilización) — esas fotos resuelven disputas después.',
            'Las fotos alimentan los Daily Logs y el reporte semanal al dueño.',
          ],
        },
      ],
    },
  },
  {
    id: 'dailylogs',
    icon: 'NotebookPen',
    roles: 'all',
    en: {
      title: 'Daily Logs',
      summary: 'The daily field report — what happened on site today.',
      sections: [
        {
          heading: 'Fill your daily log',
          steps: [
            'Open Daily Logs → New Log for today and your project.',
            'Record: weather, crew count per trade, work performed, deliveries, visitors, incidents and delays.',
            'Attach the photos of the day. Consistent daily logs win claims — do it every working day.',
          ],
        },
        {
          heading: 'Weekly owner report',
          steps: [
            'From Daily Logs you can generate the weekly field report PDF for the owner automatically.',
          ],
        },
      ],
    },
    es: {
      title: 'Bitácoras diarias',
      summary: 'El reporte diario de campo — qué pasó hoy en la obra.',
      sections: [
        {
          heading: 'Llenar tu bitácora',
          steps: [
            'Abre Daily Logs → New Log para hoy y tu proyecto.',
            'Registra: clima, personal por oficio, trabajo realizado, entregas, visitas, incidentes y atrasos.',
            'Adjunta las fotos del día. Las bitácoras consistentes ganan reclamos — hazla cada día laboral.',
          ],
        },
        {
          heading: 'Reporte semanal al dueño',
          steps: [
            'Desde Daily Logs puedes generar automáticamente el PDF de reporte semanal de campo para el dueño.',
          ],
        },
      ],
    },
  },
  {
    id: 'directory',
    icon: 'Users',
    roles: 'all',
    en: {
      title: 'Directory',
      summary: 'All project contacts — the people behind RFIs, submittals and CORs.',
      sections: [
        {
          heading: 'Add contacts first',
          steps: [
            'Add the architect, engineers, owner representative and every subcontractor with their email.',
            'The email is what makes the no-password magic links work — double-check it.',
            'Mark their role (architect, owner, sub) so assignment lists stay clean.',
          ],
        },
      ],
    },
    es: {
      title: 'Directorio',
      summary: 'Todos los contactos del proyecto — la gente detrás de RFIs, submittals y CORs.',
      sections: [
        {
          heading: 'Agrega contactos primero',
          steps: [
            'Agrega al arquitecto, ingenieros, representante del dueño y cada subcontratista con su correo.',
            'El correo es lo que hace funcionar los enlaces mágicos sin contraseña — revísalo dos veces.',
            'Marca su rol (arquitecto, dueño, sub) para que las listas de asignación queden limpias.',
          ],
        },
      ],
    },
  },
  {
    id: 'analytics',
    icon: 'BarChart3',
    roles: 'all',
    en: {
      title: 'Analytics',
      summary: 'Numbers across projects: trends and workload.',
      sections: [
        {
          heading: 'How to read it',
          steps: [
            'Charts show RFI volume, COR dollars by status and activity over time.',
            'Use it in your weekly meeting: which project is generating the most changes, which RFIs are aging.',
          ],
        },
      ],
    },
    es: {
      title: 'Analíticas',
      summary: 'Números entre proyectos: tendencias y carga de trabajo.',
      sections: [
        {
          heading: 'Cómo leerlo',
          steps: [
            'Las gráficas muestran volumen de RFIs, dólares de CORs por estado y actividad en el tiempo.',
            'Úsalo en tu reunión semanal: qué proyecto genera más cambios, qué RFIs están envejeciendo.',
          ],
        },
      ],
    },
  },
  {
    id: 'approvals',
    icon: 'Inbox',
    roles: 'management',
    en: {
      title: 'Approval Inbox',
      summary: 'Everything waiting for a decision, across all projects.',
      sections: [
        {
          heading: 'What lands here',
          steps: [
            'Pending CORs (with the total dollars at stake), overdue RFIs and submittals waiting for review.',
            'Click any item to jump straight to it and decide.',
            'Goal: inbox zero. If this page is empty, nothing in your company is stuck waiting on you.',
          ],
        },
      ],
    },
    es: {
      title: 'Aprobaciones',
      summary: 'Todo lo que espera una decisión, cruzando todos los proyectos.',
      sections: [
        {
          heading: 'Qué cae aquí',
          steps: [
            'CORs pendientes (con el total de dólares en juego), RFIs vencidos y submittals esperando revisión.',
            'Haz clic en cualquier ítem para saltar directo a él y decidir.',
            'Meta: bandeja vacía. Si esta página está vacía, nada en tu compañía está atorado esperándote.',
          ],
        },
      ],
    },
  },
  {
    id: 'import',
    icon: 'FileSpreadsheet',
    roles: 'all',
    en: {
      title: 'Import Excel',
      summary: 'Bring your existing data in — no starting from zero.',
      sections: [
        {
          heading: 'How to import',
          steps: [
            'Export your current log (RFIs, CORs, budget) to Excel or CSV.',
            'Go to Import Excel, choose the type of data and your file, and map the columns.',
            'Review the preview before confirming — what you see in the preview is what gets created.',
          ],
        },
      ],
    },
    es: {
      title: 'Importar Excel',
      summary: 'Trae tus datos existentes — no empieces desde cero.',
      sections: [
        {
          heading: 'Cómo importar',
          steps: [
            'Exporta tu registro actual (RFIs, CORs, presupuesto) a Excel o CSV.',
            'Ve a Import Excel, elige el tipo de dato y tu archivo, y mapea las columnas.',
            'Revisa la vista previa antes de confirmar — lo que ves ahí es lo que se crea.',
          ],
        },
      ],
    },
  },
  {
    id: 'team',
    icon: 'UserPlus',
    roles: 'management',
    en: {
      title: 'Team',
      summary: 'Invite people and control what each one can see and do.',
      sections: [
        {
          heading: 'Invite someone',
          steps: [
            'Go to Team → Invite. Enter their email, name and role.',
            'Admin/PM: full access. Superintendent: everything except Pay Applications and Budgets. Owner (view only): sees only their project, read-only — requires picking the project. Subcontractor: only what is assigned to them — also requires a project.',
            'They receive an email invitation to set their password. Pending invitations are listed here and can be resent.',
          ],
        },
        {
          heading: 'Change a role later',
          steps: [
            'Roles are managed only here in Team — never from the user profile (that field is read-only for security).',
          ],
        },
      ],
    },
    es: {
      title: 'Equipo',
      summary: 'Invita gente y controla qué puede ver y hacer cada uno.',
      sections: [
        {
          heading: 'Invitar a alguien',
          steps: [
            'Ve a Team → Invite. Captura correo, nombre y rol.',
            'Admin/PM: acceso total. Superintendent: todo excepto Pay Applications y Budgets. Owner (solo vista): ve solo su proyecto, de solo lectura — requiere elegir el proyecto. Subcontractor: solo lo que se le asigne — también requiere proyecto.',
            'Recibe una invitación por correo para crear su contraseña. Las invitaciones pendientes se listan aquí y se pueden reenviar.',
          ],
        },
        {
          heading: 'Cambiar un rol después',
          steps: [
            'Los roles se manejan solo aquí en Team — nunca desde el perfil del usuario (ese campo es de solo lectura por seguridad).',
          ],
        },
      ],
    },
  },
  {
    id: 'settings',
    icon: 'Settings',
    roles: 'all',
    en: {
      title: 'Settings',
      summary: 'Your profile, your company brand and your plan.',
      sections: [
        {
          heading: 'My Profile',
          steps: [
            'Set your language (EN/ES), name, email and password. Your role is shown read-only — it is assigned from Team.',
          ],
        },
        {
          heading: 'Company logo',
          steps: [
            'Admins can upload the company logo (PNG/JPG, max 2 MB).',
            'The logo appears on the login, the sidebar and generated PDFs. Without a logo, the koduPM wordmark is shown.',
          ],
        },
        {
          heading: 'Plan & Billing',
          steps: [
            'See your current plan (Starter / Pro / Enterprise) and what it includes.',
            'To upgrade, use the contact link — billing is set up with you directly.',
          ],
        },
      ],
    },
    es: {
      title: 'Configuración',
      summary: 'Tu perfil, la marca de tu empresa y tu plan.',
      sections: [
        {
          heading: 'Mi perfil',
          steps: [
            'Define tu idioma (EN/ES), nombre, correo y contraseña. Tu rol se muestra de solo lectura — se asigna desde Team.',
          ],
        },
        {
          heading: 'Logo de la empresa',
          steps: [
            'Los administradores pueden subir el logo de la empresa (PNG/JPG, máx. 2 MB).',
            'El logo aparece en el login, el menú lateral y los PDFs generados. Sin logo, se muestra el wordmark koduPM.',
          ],
        },
        {
          heading: 'Plan y facturación',
          steps: [
            'Consulta tu plan actual (Starter / Pro / Enterprise) y qué incluye.',
            'Para subir de plan, usa el enlace de contacto — la facturación se configura directamente contigo.',
          ],
        },
      ],
    },
  },
  {
    id: 'tools',
    icon: 'Search',
    roles: 'all',
    en: {
      title: 'Built-in tools: Search, Bell & Breadcrumbs',
      summary: 'Move fast without learning where everything lives.',
      sections: [
        {
          heading: 'Global search (Ctrl+K)',
          steps: [
            'Press Ctrl+K (Cmd+K on Mac) anywhere and type: project number, RFI number, contact name…',
            'Filter with the tabs, move with ↑ ↓, open with Enter, close with ESC.',
          ],
        },
        {
          heading: 'Notification bell',
          steps: [
            'The red counter shows what needs attention: overdue RFIs, pending CORs, submittals to review.',
            'It refreshes itself every minute — click an item to go straight to it.',
          ],
        },
        {
          heading: 'Breadcrumbs',
          steps: [
            'The path under the header (Dashboard / RFI Log / Detail) always tells you where you are — click any part to go back.',
          ],
        },
      ],
    },
    es: {
      title: 'Herramientas: Búsqueda, Campana y Ruta',
      summary: 'Muévete rápido sin aprenderte dónde vive cada cosa.',
      sections: [
        {
          heading: 'Búsqueda global (Ctrl+K)',
          steps: [
            'Presiona Ctrl+K (Cmd+K en Mac) en cualquier pantalla y escribe: número de proyecto, número de RFI, nombre de contacto…',
            'Filtra con los tabs, muévete con ↑ ↓, abre con Enter, cierra con ESC.',
          ],
        },
        {
          heading: 'Campana de notificaciones',
          steps: [
            'El contador rojo muestra lo que requiere atención: RFIs vencidos, CORs pendientes, submittals por revisar.',
            'Se actualiza sola cada minuto — haz clic en un ítem para ir directo.',
          ],
        },
        {
          heading: 'Ruta de navegación',
          steps: [
            'La ruta debajo del encabezado (Dashboard / RFI Log / Detalle) siempre te dice dónde estás — haz clic en cualquier parte para volver.',
          ],
        },
      ],
    },
  },
];
