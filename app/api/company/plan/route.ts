export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Plan actual de la compañía (starter | pro | enterprise) para el badge
// del sidebar y la tarjeta de Plan & Billing en Settings.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, plan: true },
    });
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ plan: company.plan ?? 'starter', companyName: company.name });
  } catch (error) {
    console.error('GET /api/company/plan error:', error);
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 });
  }
}
