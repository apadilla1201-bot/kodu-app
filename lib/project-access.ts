import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

/**
 * ACCESO POR PROYECTO (v22)
 * Regla del cliente: entrar al software muestra SOLO la lista de proyectos.
 * Cada proyecto se desbloquea con su clave de entrada; luego se ven sus módulos.
 * - admin / owner / pm → acceso total a todos los proyectos de la empresa
 * - superintendent / viewer / otros → solo proyectos desbloqueados:
 *   a) membresía directa (ProjectMember), o
 *   b) clave correcta (guardada en ProjectAccess tras ingresarla una vez)
 */

export type SessionInfo = { userId: string; companyId: string; role: string };

export async function getSessionInfo(): Promise<SessionInfo | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as any;
  return {
    userId: u?.id ?? '',
    companyId: u?.companyId ?? '',
    role: u?.role ?? 'viewer',
  };
}

/** ¿Este usuario puede entrar a este proyecto? */
export async function canAccessProject(userId: string, projectId: string, role: string): Promise<boolean> {
  if (isFullAccess(role)) return true;
  const [member, granted] = await Promise.all([
    prisma.projectMember.findFirst({ where: { userId, projectId }, select: { id: true } }),
    prisma.projectAccess.findFirst({ where: { userId, projectId }, select: { id: true } }),
  ]);
  return Boolean(member || granted);
}

/** IDs de proyectos desbloqueados para el usuario (null = todos, gestión). */
export async function accessibleProjectIds(userId: string, role: string): Promise<string[] | null> {
  if (isFullAccess(role)) return null;
  const [members, grants] = await Promise.all([
    prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
    prisma.projectAccess.findMany({ where: { userId }, select: { projectId: true } }),
  ]);
  const ids = new Set<string>();
  for (const m of members) if (m.projectId) ids.add(m.projectId);
  for (const g of grants) ids.add(g.projectId);
  return [...ids];
}

/** Guarda el desbloqueo (tras validar la clave en la ruta correspondiente). */
export async function grantProjectAccess(userId: string, projectId: string): Promise<void> {
  await prisma.projectAccess.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: {},
  });
}
