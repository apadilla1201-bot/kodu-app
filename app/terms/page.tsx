import LegalPage from '@/components/legal-page';

const en = {
  title: 'Terms of Service',
  updated: 'Last updated: July 2026',
  intro: 'These terms govern your use of Kodu PM. By creating an account you agree to them. In short: your data is yours, use the service lawfully, and we do our best to keep it running and improving.',
  sections: [
    {
      heading: '1. The service',
      body: [
        'Kodu PM provides construction project-controls tools: change order tracking, RFIs, submittals, pay applications, schedules, daily logs, and related document generation.',
        'The service is provided "as is". We are continuously improving it and may add, change, or remove features with notice where practical.',
      ],
    },
    {
      heading: '2. Your account',
      body: [
        'You are responsible for keeping your password confidential and for all activity under your account. One account per person; do not share credentials.',
        'You must provide a valid email address. We may suspend accounts used for unlawful or abusive purposes.',
      ],
    },
    {
      heading: '3. Your data',
      body: [
        'You retain all rights to the project data and files you upload. You grant us only the license needed to store and process them to provide the service to you.',
        'You are responsible for having the right to upload the information you enter (for example, subcontractor names or contract amounts).',
      ],
    },
    {
      heading: '4. Acceptable use',
      body: [
        'Do not attempt to access other customers\' data, disrupt the service, or use it for anything unlawful. Automated scraping of the service is not allowed.',
      ],
    },
    {
      heading: '5. Availability & liability',
      body: [
        'We aim for high availability but do not guarantee uninterrupted service. Kodu PM is a tracking and documentation aid — it does not replace professional judgment, contract review, or legal advice.',
        'To the maximum extent permitted by law, Kodu PM is not liable for indirect or consequential damages (including lost profits or claims) arising from use of the service.',
      ],
    },
    {
      heading: '6. Changes & contact',
      body: [
        'We may update these terms; the current version always lives here. Questions: support@kodupm.com. These terms are governed by the laws of the State of Florida, USA.',
      ],
    },
  ],
};

const es = {
  title: 'Términos de Servicio',
  updated: 'Última actualización: julio 2026',
  intro: 'Estos términos rigen el uso de Kodu PM. Al crear una cuenta usted los acepta. En resumen: sus datos son suyos, use el servicio legalmente, y nosotros hacemos todo lo posible por mantenerlo funcionando y mejorando.',
  sections: [
    {
      heading: '1. El servicio',
      body: [
        'Kodu PM provee herramientas de control de proyectos de construcción: seguimiento de change orders, RFIs, submittals, pay applications, cronogramas, bitácoras y generación de documentos.',
        'El servicio se provee "tal cual". Lo mejoramos continuamente y podemos agregar, cambiar o quitar funciones, con aviso cuando sea práctico.',
      ],
    },
    {
      heading: '2. Su cuenta',
      body: [
        'Usted es responsable de mantener su contraseña confidencial y de toda la actividad bajo su cuenta. Una cuenta por persona; no comparta credenciales.',
        'Debe proveer un email válido. Podemos suspender cuentas usadas con fines ilegales o abusivos.',
      ],
    },
    {
      heading: '3. Sus datos',
      body: [
        'Usted conserva todos los derechos sobre los datos y archivos que sube. Solo nos otorga la licencia necesaria para almacenarlos y procesarlos para proveerle el servicio.',
        'Usted es responsable de tener el derecho de cargar la información que ingresa (por ejemplo, nombres de subcontratistas o montos de contrato).',
      ],
    },
    {
      heading: '4. Uso aceptable',
      body: [
        'No intente acceder a datos de otros clientes, interrumpir el servicio ni usarlo para fines ilegales. No se permite el scraping automatizado del servicio.',
      ],
    },
    {
      heading: '5. Disponibilidad y responsabilidad',
      body: [
        'Buscamos alta disponibilidad pero no garantizamos servicio ininterrumpido. Kodu PM es una ayuda de seguimiento y documentación — no reemplaza el juicio profesional, la revisión de contratos ni el asesoramiento legal.',
        'En la máxima medida permitida por la ley, Kodu PM no es responsable de daños indirectos o consecuentes (incluyendo lucro cesante o reclamaciones) derivados del uso del servicio.',
      ],
    },
    {
      heading: '6. Cambios y contacto',
      body: [
        'Podemos actualizar estos términos; la versión vigente siempre estará aquí. Preguntas: support@kodupm.com. Estos términos se rigen por las leyes del Estado de Florida, EE.UU.',
      ],
    },
  ],
};

export default function TermsPage() {
  return <LegalPage en={en} es={es} />;
}
