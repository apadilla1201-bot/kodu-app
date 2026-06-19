import { withAuth } from 'next-auth/middleware';

export default withAuth({
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
