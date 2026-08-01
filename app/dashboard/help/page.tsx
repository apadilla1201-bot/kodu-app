export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { HelpContent } from '@/components/help-content';

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  return (
    <div className="p-6 lg:p-8">
      <HelpContent />
    </div>
  );
}
