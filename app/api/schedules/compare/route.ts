export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// POST /api/schedules/compare — Compare two schedule versions
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });

    const { baseId, compareId } = await request.json();
    if (!baseId || !compareId) {
      return NextResponse.json({ error: 'baseId and compareId required' }, { status: 400 });
    }

    const [base, compare] = await Promise.all([
      prisma.schedule.findUnique({
        where: { id: baseId },
        include: {
          activities: { where: { isLookAhead: false }, orderBy: { sortOrder: 'asc' } },
          project: { select: { userId: true, projectName: true, projectNumber: true } },
        },
      }),
      prisma.schedule.findUnique({
        where: { id: compareId },
        include: {
          activities: { where: { isLookAhead: false }, orderBy: { sortOrder: 'asc' } },
          project: { select: { userId: true } },
        },
      }),
    ]);

    if (!base || base.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Base schedule not found' }, { status: 404 });
    }
    if (!compare || compare.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Compare schedule not found' }, { status: 404 });
    }

    // Build lookup maps by activityId
    const baseMap = new Map(base.activities.filter(a => !a.activityType.startsWith('group_')).map(a => [a.activityId, a]));
    const compMap = new Map(compare.activities.filter(a => !a.activityType.startsWith('group_')).map(a => [a.activityId, a]));

    const allIds = new Set([...baseMap.keys(), ...compMap.keys()]);

    interface DiffItem {
      activityId: string;
      activityName: string;
      changeType: 'added' | 'deleted' | 'modified' | 'unchanged';
      changes: { field: string; from: any; to: any }[];
      base: any | null;
      compare: any | null;
    }

    const diffs: DiffItem[] = [];
    const fieldsToCompare = [
      'startDate', 'finishDate', 'originalDuration', 'remainingDuration',
      'percentComplete', 'status', 'isCritical', 'activityName',
    ];

    for (const id of allIds) {
      const b = baseMap.get(id);
      const c = compMap.get(id);

      if (!b && c) {
        diffs.push({
          activityId: id,
          activityName: c.activityName,
          changeType: 'added',
          changes: [],
          base: null,
          compare: serializeActivity(c),
        });
      } else if (b && !c) {
        diffs.push({
          activityId: id,
          activityName: b.activityName,
          changeType: 'deleted',
          changes: [],
          base: serializeActivity(b),
          compare: null,
        });
      } else if (b && c) {
        const changes: { field: string; from: any; to: any }[] = [];
        for (const field of fieldsToCompare) {
          const bv = (b as any)[field];
          const cv = (c as any)[field];
          const bs = bv instanceof Date ? bv.toISOString() : bv;
          const cs = cv instanceof Date ? cv.toISOString() : cv;
          if (String(bs) !== String(cs)) {
            changes.push({ field, from: bs, to: cs });
          }
        }
        diffs.push({
          activityId: id,
          activityName: c.activityName,
          changeType: changes.length > 0 ? 'modified' : 'unchanged',
          changes,
          base: serializeActivity(b),
          compare: serializeActivity(c),
        });
      }
    }

    // Summary stats
    const summary = {
      added: diffs.filter(d => d.changeType === 'added').length,
      deleted: diffs.filter(d => d.changeType === 'deleted').length,
      modified: diffs.filter(d => d.changeType === 'modified').length,
      unchanged: diffs.filter(d => d.changeType === 'unchanged').length,
      total: diffs.length,
    };

    return NextResponse.json({
      base: { id: base.id, revision: base.revision, dataDate: base.dataDate },
      compare: { id: compare.id, revision: compare.revision, dataDate: compare.dataDate },
      summary,
      diffs: diffs.filter(d => d.changeType !== 'unchanged'), // Only return changes
    });
  } catch (error: any) {
    console.error('POST /api/schedules/compare error:', error);
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 });
  }
}

function serializeActivity(a: any) {
  return {
    activityId: a.activityId,
    activityName: a.activityName,
    originalDuration: a.originalDuration,
    remainingDuration: a.remainingDuration,
    percentComplete: a.percentComplete,
    startDate: a.startDate ? new Date(a.startDate).toISOString() : null,
    finishDate: a.finishDate ? new Date(a.finishDate).toISOString() : null,
    status: a.status,
    isCritical: a.isCritical,
  };
}
