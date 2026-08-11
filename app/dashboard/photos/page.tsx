export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { SitePhotosContent } from '@/components/site-photos-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function SitePhotosPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const { projectId } = await requireProjectAccess(searchParams);
  const companyId = (session.user as any)?.companyId ?? '';

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, projectNumber: true, projectName: true },
  });
  if (!project) redirect('/dashboard');

  return (
    <div className="p-6 lg:p-8">
      <SitePhotosContent projects={[project]} initialProjectId={project.id} />
    </div>
  );
}
