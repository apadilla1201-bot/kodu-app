export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Búsqueda global (Ctrl+K) — cruza Proyectos, RFIs, CORs, Submittals y Contactos.
// Respeta multi-tenant (companyId) y devuelve resultados agrupados por tipo.
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return NextResponse.json({ projects: [], rfis: [], cors: [], submittals: [], contacts: [] });
    }

    const contains = { contains: q, mode: 'insensitive' as const };
    const TAKE = 6; // máx por grupo

    const [projects, rfis, cors, submittals, contacts] = await Promise.all([
      prisma.project.findMany({
        where: {
          companyId,
          OR: [
            { projectName: contains },
            { projectNumber: contains },
            { client: contains },
            { location: contains },
          ],
        },
        select: { id: true, projectName: true, projectNumber: true, client: true },
        take: TAKE,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.rFI.findMany({
        where: {
          project: { companyId },
          OR: [
            { rfiNumber: contains },
            { subject: contains },
            { assignedTo: contains },
            { submittedBy: contains },
          ],
        },
        select: {
          id: true, rfiNumber: true, subject: true, status: true,
          project: { select: { projectName: true, projectNumber: true } },
        },
        take: TAKE,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.changeOrder.findMany({
        where: {
          project: { companyId },
          OR: [
            { corNumber: contains },
            { description: contains },
            { subcontractor: contains },
          ],
        },
        select: {
          id: true, corNumber: true, description: true, status: true, totalAmount: true,
          project: { select: { projectName: true, projectNumber: true } },
        },
        take: TAKE,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.submittal.findMany({
        where: {
          project: { companyId },
          OR: [
            { submittalNumber: contains },
            { title: contains },
            { specSection: contains },
            { subcontractor: contains },
          ],
        },
        select: {
          id: true, submittalNumber: true, title: true, status: true,
          project: { select: { projectName: true, projectNumber: true } },
        },
        take: TAKE,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.projectContact.findMany({
        where: {
          project: { companyId },
          isActive: true,
          OR: [
            { name: contains },
            { email: contains },
            { company: contains },
            { role: contains },
          ],
        },
        select: {
          id: true, name: true, email: true, role: true, company: true,
          project: { select: { projectName: true, projectNumber: true } },
        },
        take: TAKE,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({ projects, rfis, cors, submittals, contacts });
  } catch (error: any) {
    console.error('GET /api/search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
