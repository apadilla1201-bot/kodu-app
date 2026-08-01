export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { isFullAccess } from '@/lib/permissions';
import { ApprovalsContent } from '@/components/approvals-content';

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  // Bandeja de aprobaciones: solo roles de gestión (admin / owner-empresa / pm).
  const role = (session.user as any)?.role ?? 'viewer';
  if (!isFullAccess(role)) redirect('/dashboard');

  return (
    <div className="p-6 lg:p-8">
      <ApprovalsContent />
    </div>
  );
}
