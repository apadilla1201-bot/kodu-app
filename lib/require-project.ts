import { redirect } from 'next/navigation';
import { getSessionInfo, canAccessProject } from '@/lib/project-access';

/**
 * v22 — Guarda de módulo por proyecto.
 * Toda página de módulo (rfis, cors, submittals…) exige ?projectId=
 * y que el usuario tenga ese proyecto desbloqueado. Sin uno u otro → home.
 * Devuelve { projectId } validado.
 */
export async function requireProjectAccess(searchParams: { projectId?: string } | undefined): Promise<{ userId: string; companyId: string; role: string; projectId: string }> {
  const info = await getSessionInfo();
  if (!info) redirect('/login');
  const projectId = searchParams?.projectId ?? '';
  if (!projectId) redirect('/dashboard');
  const ok = await canAccessProject(info.userId, projectId, info.role);
  if (!ok) redirect('/dashboard');
  return { ...info, projectId };
}
