export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { BudgetUploadForm } from '@/components/budget-upload-form';

export default async function NewBudgetPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, projectNumber: true, projectName: true },
    orderBy: { projectName: 'asc' },
  });

  return <BudgetUploadForm projects={projects} initialProjectId={searchParams?.projectId} />;
}
