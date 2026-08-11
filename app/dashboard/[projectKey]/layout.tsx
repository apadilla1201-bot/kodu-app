export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionInfo, canAccessProject } from '@/lib/project-access';

/**
 * GUARD DE PROYECTO — todo lo que cuelga de /dashboard/<projectId>/…
 * (rfis, cors, submittals, photos, etc. DE ESE proyecto) exige que el
 * usuario tenga el proyecto desbloqueado (clave o membresía, o rol de gestión).
 * Sin acceso → de vuelta a la lista de proyectos.
 */
export default async function ProjectSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectKey: string };
}) {
  const info = await getSessionInfo();
  if (!info) redirect('/login');

  const ok = await canAccessProject(info.userId, params.projectKey ?? '', info.role);
  if (!ok) redirect('/dashboard');

  return <>{children}</>;
}
