/**
 * lib/pdf.ts — Generación de PDF propia (reemplaza Abacus HTML→PDF)
 *
 * Antes: la app mandaba HTML a apps.abacus.ai/api/createConvertHtmlToPdfRequest
 * y hacía polling hasta que Abacus devolvía el PDF. Eso te ataba a Abacus
 * para CADA PDF (CORs, Pay Apps, RFIs, Schedules).
 *
 * Ahora: generamos el PDF nosotros con Puppeteer. Mismo input (HTML string),
 * mismo output (Buffer de PDF). Las rutas que llamaban a Abacus solo cambian
 * la función que invocan.
 *
 * Requiere en package.json:
 *   "puppeteer-core": "^23.0.0"
 *   "@sparticuz/chromium": "^131.0.0"   // Chromium para serverless/Vercel
 *
 * En local (desarrollo) usa el Chrome instalado; en Vercel usa @sparticuz/chromium.
 */

export type HtmlToPdfOptions = {
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'A4';
  landscape?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  scale?: number;
  width?: string;
  height?: string;
};

/** Chromium pack for Vercel (must match puppeteer-core / @sparticuz/chromium-min version). */
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ??
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

/**
 * Vercel Fluid Compute does not expose AWS Lambda env vars. Without them,
 * @sparticuz/chromium-min skips AL2023 libs and Chromium fails (libnss3.so).
 */
function prepareServerlessChromiumEnv(): void {
  if (!process.env.VERCEL) return;

  process.env.HOME ??= '/tmp';

  const hasLambdaRuntime =
    process.env.AWS_LAMBDA_JS_RUNTIME?.includes('20.x') ||
    process.env.AWS_LAMBDA_JS_RUNTIME?.includes('22.x') ||
    process.env.AWS_EXECUTION_ENV?.includes('20.x') ||
    process.env.AWS_EXECUTION_ENV?.includes('22.x');

  if (!hasLambdaRuntime) {
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x';
  }
}

async function launchPdfBrowser() {
  if (process.env.VERCEL) {
    prepareServerlessChromiumEnv();

    const chromium = (await import('@sparticuz/chromium-min')).default;
    const { setupLambdaEnvironment } = await import('@sparticuz/chromium-min/build/helper');
    const puppeteer = await import('puppeteer-core');

    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
    setupLambdaEnvironment('/tmp/al2023/lib');

    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  }

  {
    const puppeteer = await import('puppeteer-core');
    const chromePaths = [
      process.env.CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean) as string[];

    let executablePath: string | undefined;
    const fs = await import('fs');
    for (const p of chromePaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
    if (!executablePath) {
      throw new Error(
        'Chrome no encontrado. Instala Google Chrome o define CHROME_PATH en .env.local'
      );
    }

    return puppeteer.launch({
      headless: true,
      executablePath,
    });
  }
}

export async function htmlToPdf(html: string, options: HtmlToPdfOptions = {}): Promise<Buffer> {
  const browser = await launchPdfBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const pdfOptions: Record<string, unknown> = {
      printBackground: true,
      margin: options.margin ?? { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    };

    if (options.width && options.height) {
      pdfOptions.width = options.width;
      pdfOptions.height = options.height;
    } else {
      pdfOptions.format = options.format ?? 'Letter';
      pdfOptions.landscape = options.landscape ?? false;
    }

    if (options.scale) pdfOptions.scale = options.scale;

    const pdf = await page.pdf(pdfOptions);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * NOTA DE MIGRACIÓN para Cursor:
 * En cada ruta que tenía el patrón Abacus (createConvertHtmlToPdfRequest +
 * polling getConvertHtmlToPdfStatus), reemplazar TODO ese bloque por:
 *
 *   import { htmlToPdf } from '@/lib/pdf';
 *   const pdfBuffer = await htmlToPdf(htmlString);
 *   return new Response(pdfBuffer, {
 *     headers: {
 *       'Content-Type': 'application/pdf',
 *       'Content-Disposition': `attachment; filename="${filename}.pdf"`,
 *     },
 *   });
 *
 * El HTML que ya construyen esas rutas no cambia — solo cambia cómo se
 * convierte a PDF. Archivos afectados:
 *   - app/api/generate-pdf/[id]/route.ts          (COR)
 *   - app/api/pay-apps/[id]/pdf/route.ts          (Pay App G702/G703)
 *   - app/api/rfis/[id]/pdf/route.ts              (RFI)
 *   - app/api/projects/[id]/owner-executive/pdf/route.ts
 *   - app/api/schedules/[id]/pdf/route.ts
 *   - app/api/schedules/[id]/lookahead/pdf/route.ts
 */
