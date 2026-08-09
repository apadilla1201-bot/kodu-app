export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET → contadores de pendientes por sección del menú (badges del sidebar).
// Cada conteo falla a 0 en silencio (módulos sin migrar no rompen el menú).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';
    if (!companyId) return NextResponse.json({});

    const safe = async (fn: () => Promise<number>): Promise<number> => {
      try { return await fn(); } catch { return 0; }
    };

    const [rfis, submittals, cors, payApps, waivers, punch, closeout] = await Promise.all([
      safe(() => prisma.rFI.count({ where: { project: { companyId }, status: { in: ['Open', 'Under Review'] } } })),
      safe(() => prisma.submittal.count({ where: { project: { companyId }, status: { in: ['Submitted', 'Under Review'] } } })),
      safe(() => prisma.changeOrder.count({ where: { project: { companyId }, status: 'Pending' } })),
      safe(() => prisma.payApplication.count({ where: { project: { companyId }, status: { in: ['Draft', 'Submitted'] } } })),
      safe(() => prisma.lienWaiver.count({ where: { project: { companyId }, status: { in: ['Sent', 'Pending'] } } })),
      safe(() => prisma.punchItem.count({ where: { project: { companyId }, status: { not: 'Completed' } } })),
      safe(() => prisma.closeoutItem.count({ where: { project: { companyId }, status: { in: ['Pending', 'Requested', 'Received'] } } })),
    ]);

    return NextResponse.json({ rfis, submittals, cors, payApps, waivers, punch, closeout });
  } catch {
    return NextResponse.json({});
  }
}
