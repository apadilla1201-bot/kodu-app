import { DM_Sans, Libre_Franklin, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler';
import { Providers } from '@/components/providers';
import { GC_NAME } from '@/lib/gc-branding';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const libreFranklin = Libre_Franklin({ subsets: ['latin'], variable: '--font-display' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const dynamic = 'force-dynamic';

export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  title: `Kodu PM | ${GC_NAME}`,
  description: 'Project controls for construction teams — Change Orders, RFIs, Submittals, Buyout, Daily Logs and Pay Applications. Import your CO LOG from Excel. Bilingual EN/ES.',
  applicationName: 'Kodu PM',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Kodu PM',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: `Kodu PM | ${GC_NAME}`,
    description: 'Project controls for construction teams — Change Orders, RFIs, Submittals, Buyout, Daily Logs and Pay Applications. Import your CO LOG from Excel. Bilingual EN/ES.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${libreFranklin.variable} ${jetbrainsMono.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            {children}
            <Toaster />
            <ChunkLoadErrorHandler />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
