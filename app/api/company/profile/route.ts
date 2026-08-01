export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

const clean = (v: unknown, max = 200): string | null => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

// GET — Perfil de la compañía del usuario en sesión: nombre, logo y los
// datos que salen en los reportes PDF. Cualquier rol puede LEERLO
// (lo usan el login, el sidebar, los PDFs y Configuración).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        logoUrl: true,
        address: true,
        addressCity: true,
        phone: true,
        website: true,
        license: true,
      },
    });
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      name: company.name,
      logoUrl: company.logoUrl ?? null,
      address: company.address ?? '',
      addressCity: company.addressCity ?? '',
      phone: company.phone ?? '',
      website: company.website ?? '',
      license: company.license ?? '',
    });
  } catch (error) {
    console.error('GET /api/company/profile error:', error);
    return NextResponse.json({ error: 'Failed to load company profile' }, { status: 500 });
  }
}

// PATCH — Actualiza los datos de la empresa que salen en los reportes PDF
// (dirección, teléfono, sitio web, licencia). Solo admin/owner/pm.
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId;
    const role = (session.user as any)?.role;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (role !== 'admin' && role !== 'owner' && role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    await prisma.company.update({
      where: { id: companyId },
      data: {
        address: clean(body?.address, 150),
        addressCity: clean(body?.addressCity, 100),
        phone: clean(body?.phone, 40),
        website: clean(body?.website, 100),
        license: clean(body?.license, 60),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/company/profile error:', error);
    return NextResponse.json({ error: 'Failed to save company profile' }, { status: 500 });
  }
}
