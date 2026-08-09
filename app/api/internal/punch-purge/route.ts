export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// RUTA TEMPORAL — borrar app/api/internal/ del repo después de correrla.
// Vacía el punch list de EJEMPLO (importado del Excel Arena Madness).
// Reporta conteos por proyecto ANTES de borrar, y confirma lo borrado.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  if (key !== 'kodupm-migrar-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const grouped = await prisma.punchItem.groupBy({
      by: ['projectId'],
      _count: { id: true },
    });
    const projects = await prisma.project.findMany({
      where: { id: { in: grouped.map((g) => g.projectId) } },
      select: { id: true, projectNumber: true, projectName: true },
    });
    const report = grouped.map((g) => ({
      project: projects.find((p) => p.id === g.projectId)?.projectNumber ?? g.projectId,
      name: projects.find((p) => p.id === g.projectId)?.projectName ?? '',
      items: g._count.id,
    }));

    const signoffs = await prisma.punchAreaSignoff.count();
    const delSignoffs = await prisma.punchAreaSignoff.deleteMany({});
    const delItems = await prisma.punchItem.deleteMany({});

    return NextResponse.json({
      ok: true,
      before: { itemsByProject: report, areaSignoffs: signoffs },
      deleted: { punchItems: delItems.count, areaSignoffs: delSignoffs.count },
    });
  } catch (error: any) {
    console.error('punch-purge error:', error);
    return NextResponse.json({ error: String(error?.message ?? 'purge failed') }, { status: 500 });
  }
}
