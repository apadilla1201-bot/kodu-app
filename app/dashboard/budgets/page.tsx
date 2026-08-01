export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { canViewBudgets } from '@/lib/permissions';
import { BudgetsContent } from '@/components/budgets-content';

export default async function BudgetsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  // Budgets: solo roles de gestión (admin / owner-empresa / pm).
  // Superintendent NO ve este módulo (matriz de permisos, paquete 3).
  const role = (session.user as any)?.role ?? 'viewer';
  if (!canViewBudgets(role)) redirect('/dashboard');

  return (
    <div className="p-6 lg:p-8">
      <BudgetsContent />
    </div>
  );
}
