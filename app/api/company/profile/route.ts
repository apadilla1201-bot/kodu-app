export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Perfil público de la compañía del usuario en sesión: nombre + logo.
// Lo usan el login (para mostrar el logo de TU empresa al entrar),
// el sidebar y los PDFs. Cualquier rol puede LEERLO.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, logoUrl: true },
    });
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ name: company.name, logoUrl: company.logoUrl ?? null });
  } catch (error) {
    console.error('GET /api/company/profile error:', error);
    return NextResponse.json({ error: 'Failed to load company profile' }, { status: 500 });
  }
}
