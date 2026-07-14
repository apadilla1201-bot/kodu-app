import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth-options';

// Force this route to be dynamic so Next.js does not try to statically
// collect/evaluate it at build time (which triggers Prisma and breaks the
// Vercel build: "Failed to collect page data for /api/auth/[...nextauth]").
export const dynamic = 'force-dynamic';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
