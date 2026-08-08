export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

const MAX_BULK = 100;

// POST { ids: string[], action: 'assign' | 'reopen', assignedToName?, assignedToEmail? }
// Acciones masivas del punch list: asignar responsable en bloque / reabrir en bloque.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role) && role !== 'superintendent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String).slice(0, MAX_BULK) : [];
    const action = String(body?.action ?? '');
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids[] is required' }, { status: 400 });
    }

    const baseWhere = { id: { in: ids }, project: { companyId } };

    if (action === 'assign') {
      const name = body?.assignedToName ? String(body.assignedToName) : null;
      const email = body?.assignedToEmail ? String(body.assignedToEmail).trim().toLowerCase() : null;
      if (!name && !email) {
        return NextResponse.json({ error: 'assignedToName or assignedToEmail required' }, { status: 400 });
      }
      const result = await prisma.punchItem.updateMany({
        where: baseWhere,
        data: {
          assignedToName: name,
          assignedToEmail: email,
          // Solo reabre ítems que el sub había marcado listos; los completados se respetan
          ...(body?.reopenReady ? {} : {}),
        },
      });
      return NextResponse.json({ ok: true, count: result.count, action });
    }

    if (action === 'reopen') {
      const result = await prisma.punchItem.updateMany({
        where: { ...baseWhere, status: { in: ['Ready for Review', 'In Progress', 'Disputed'] } },
        data: { status: 'Open' },
      });
      return NextResponse.json({ ok: true, count: result.count, action });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/punch-items/bulk error:', error);
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 });
  }
}
