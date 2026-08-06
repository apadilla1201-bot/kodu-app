import { withAuth } from 'next-auth/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// SEGURIDAD koduPM
// - Todo lo del matcher requiere sesión (redirige a /login).
// - EXCEPCIÓN: los "magic links" de un solo documento (/api/<recurso>/public/<token>)
//   son públicos a propósito: cada ruta valida su propio token internamente y
//   solo expone ESE documento (RFI, COR, submittal, waiver, punch, closeout).
//   Sin token válido → 404. El token no abre nada más del sistema.
// ─────────────────────────────────────────────────────────────────────────────
function isPublicMagicLink(pathname: string): boolean {
  return /^\/api\/[^/]+\/public(\/|$)/.test(pathname);
}

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      if (isPublicMagicLink(req.nextUrl.pathname)) return true;
      return !!token;
    },
  },
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/cors/:path*',
    '/api/projects/:path*',
    '/api/cors/:path*',
    '/api/upload/:path*',
    '/api/generate-pdf/:path*',
    '/api/market-analysis/:path*',
  ],
};
