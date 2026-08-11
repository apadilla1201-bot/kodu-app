export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { canViewBudgets } from '@/lib/permissions';
import { BudgetsContent } from '@/components/budgets-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function BudgetsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  // Budgets: solo roles de gestión (admin / owner-empresa / pm).
  const role = (session.user as any)?.role ?? 'viewer';
  if (!canViewBudgets(role)) redirect('/dashboard');

  const { projectId } = await requireProjectAccess(searchParams);

  return (
    <div className="p-6 lg:p-8">
      <BudgetsContent projectId={projectId} />
    </div>
  );
}
