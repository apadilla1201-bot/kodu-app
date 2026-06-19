export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ImportExcelContent } from '@/components/import-excel-content';

export default async function ImportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, projectNumber: true, projectName: true },
  });

  const serializedProjects = (projects ?? []).map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
  }));

  return <ImportExcelContent projects={serializedProjects} />;
}
