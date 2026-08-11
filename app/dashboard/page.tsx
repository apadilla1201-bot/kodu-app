export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isFullAccess, canWrite } from '@/lib/permissions';
import { accessibleProjectIds } from '@/lib/project-access';
import { HomeProjectsContent } from '@/components/home-projects-content';

/**
 * HOME = SOLO PROYECTOS (v22).
 * Al entrar al software se ven los proyectos y NADA MÁS. Los módulos
 * aparecen dentro de cada proyecto. Cada proyecto puede requerir su
 * clave de entrada (Project.accessKey) salvo para roles de gestión.
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as any)?.id ?? '';
  const companyId = (session.user as any)?.companyId ?? '';
  const role = (session.user as any)?.role ?? 'viewer';

  const full = isFullAccess(role);
  const allowedIds = full ? null : await accessibleProjectIds(userId, role);

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: {
      id: true, projectNumber: true, projectName: true, client: true,
      location: true, accessKey: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber ?? '',
    projectName: p.projectName ?? '',
    client: p.client ?? '',
    location: p.location ?? null,
    hasKey: Boolean(p.accessKey),
    // Bloqueado para no-gestión salvo que lo haya desbloqueado (clave o membresía)
    locked: full ? false : !(allowedIds ?? []).includes(p.id),
  }));

  return <HomeProjectsContent projects={serialized} canCreate={canWrite(role)} />;
}
