export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { SubmittalListContent } from '@/components/submittal-list-content';
import { ProjectGate, ProjectGateBar } from '@/components/project-gate';

export default async function SubmittalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    include: {
      submittals: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allSubmittals = projects.flatMap((p) =>
    (p.submittals ?? []).map((s) => ({
      ...s,
      requiredDate: s.requiredDate?.toISOString?.() ?? null,
      submittedDate: s.submittedDate?.toISOString?.() ?? null,
      reviewedDate: s.reviewedDate?.toISOString?.() ?? null,
      projectName: p.projectName,
      projectNumber: p.projectNumber,
    }))
  );

  const projectsList = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    projectName: p.projectName,
  }));

  return (
    <ProjectGate projects={projectsList}>
      {(project, clear) => (
        <div className="p-6 lg:p-8">
          <ProjectGateBar project={project} onChange={clear} />
          <SubmittalListContent submittals={allSubmittals} projects={projectsList} initialProjectNumber={project.projectNumber} />
        </div>
      )}
    </ProjectGate>
  );
}
