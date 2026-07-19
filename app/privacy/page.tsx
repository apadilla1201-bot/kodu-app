import LegalPage from '@/components/legal-page';

const en = {
  title: 'Privacy Policy',
  updated: 'Last updated: July 2026',
  intro: 'Kodu PM ("we", "our") is a construction project-controls application. This policy explains what information we collect, how we use it, and the choices you have.',
  sections: [
    {
      heading: '1. Information we collect',
      body: [
        'Account information: your name, email address, and a securely hashed password when you create an account.',
        'Project data you enter: projects, change orders, RFIs, submittals, pay applications, schedules, daily logs, photos, and files you upload (including imported Excel documents).',
        'Usage data: basic technical information such as browser type and pages visited, used to operate and improve the service.',
      ],
    },
    {
      heading: '2. How we use your information',
      body: [
        'To provide the service: store and display your project data, generate documents (such as change order PDFs), and keep your account secure.',
        'To communicate with you about your account (for example, password reset emails).',
        'We do not sell your personal information or your project data to anyone.',
      ],
    },
    {
      heading: '3. Where your data lives',
      body: [
        'Your data is stored on managed cloud infrastructure (Supabase/PostgreSQL for the database, Vercel for the application) located in the United States. We use industry-standard encryption in transit (HTTPS).',
      ],
    },
    {
      heading: '4. Cookies',
      body: [
        'We use strictly necessary cookies to keep you signed in and remember your language preference. We do not use advertising cookies.',
      ],
    },
    {
      heading: '5. Your rights',
      body: [
        'You may request a copy, correction, or deletion of your account and project data at any time by emailing support@kodupm.com. Deleting your account removes your projects and associated records from our active systems.',
      ],
    },
    {
      heading: '6. Changes & contact',
      body: [
        'If we change this policy we will post the new version here with an updated date. Questions: support@kodupm.com.',
      ],
    },
  ],
};

const es = {
  title: 'Política de Privacidad',
  updated: 'Última actualización: julio 2026',
  intro: 'Kodu PM ("nosotros") es una aplicación de control de proyectos de construcción. Esta política explica qué información recopilamos, cómo la usamos y las opciones que usted tiene.',
  sections: [
    {
      heading: '1. Información que recopilamos',
      body: [
        'Información de cuenta: su nombre, email y una contraseña cifrada de forma segura al crear su cuenta.',
        'Datos de proyecto que usted ingresa: proyectos, change orders, RFIs, submittals, pay applications, cronogramas, bitácoras, fotos y archivos que sube (incluyendo Excel importados).',
        'Datos de uso: información técnica básica como tipo de navegador y páginas visitadas, usada para operar y mejorar el servicio.',
      ],
    },
    {
      heading: '2. Cómo usamos su información',
      body: [
        'Para proveer el servicio: almacenar y mostrar sus datos, generar documentos (como PDFs de change orders) y mantener su cuenta segura.',
        'Para comunicarnos sobre su cuenta (por ejemplo, correos de restablecimiento de contraseña).',
        'No vendemos su información personal ni sus datos de proyecto a nadie.',
      ],
    },
    {
      heading: '3. Dónde viven sus datos',
      body: [
        'Sus datos se almacenan en infraestructura cloud administrada (Supabase/PostgreSQL para la base de datos, Vercel para la aplicación) ubicada en Estados Unidos. Usamos cifrado estándar en tránsito (HTTPS).',
      ],
    },
    {
      heading: '4. Cookies',
      body: [
        'Usamos cookies estrictamente necesarias para mantener su sesión y recordar su idioma. No usamos cookies de publicidad.',
      ],
    },
    {
      heading: '5. Sus derechos',
      body: [
        'Puede solicitar una copia, corrección o eliminación de su cuenta y datos en cualquier momento escribiendo a support@kodupm.com. Eliminar su cuenta borra sus proyectos y registros asociados de nuestros sistemas activos.',
      ],
    },
    {
      heading: '6. Cambios y contacto',
      body: [
        'Si cambiamos esta política publicaremos la nueva versión aquí con la fecha actualizada. Preguntas: support@kodupm.com.',
      ],
    },
  ],
};

export default function PrivacyPage() {
  return <LegalPage en={en} es={es} />;
}
