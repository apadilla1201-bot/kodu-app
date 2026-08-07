import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { isFullAccess } from '@/lib/permissions';

export async function getApiContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as any)?.role ?? 'viewer';
  const companyId = (session.user as any)?.companyId ?? '';
  return {
    role,
    companyId,
    userName: (session.user as any)?.name ?? '',
    userEmail: session.user?.email ?? '',
    canUpload: isFullAccess(role), // solo Admin/Owner/PM suben planos (decisión del usuario)
    canView: isFullAccess(role) || ['superintendent', 'projectViewer', 'estimator'].includes(role),
  };
}

// Disciplina a partir de la letra del número de plano (A-101 → Architectural)
export function disciplineFromSheet(sheetNumber: string): string | null {
  const m = /^([A-Za-z]{1,3})/.exec((sheetNumber ?? '').trim());
  if (!m) return null;
  const p = m[1].toUpperCase();
  const map: Record<string, string> = {
    A: 'Architectural', S: 'Structural', M: 'Mechanical', E: 'Electrical', P: 'Plumbing',
    C: 'Civil', L: 'Landscape', G: 'General', FP: 'Fire Protection', FA: 'Fire Alarm',
    D: 'Demolition', T: 'Telecom', AV: 'Audio Visual', F: 'Fire', I: 'Interiors',
    Q: 'Equipment', R: 'Roofing', X: 'Other',
  };
  return map[p] ?? map[p[0]] ?? null;
}

// Sugerir número y título desde el nombre del archivo: "A-101 - First Floor Plan.pdf"
export function parseFileName(fileName: string): { sheetNumber: string; title: string } {
  const baseName = (fileName ?? '').replace(/\.[^.]+$/, '').trim();
  const m = /^([A-Za-z]{0,3}[-\s]?\d[\w.-]*)\s*[-–_]?\s*(.*)$/.exec(baseName);
  if (m) {
    return {
      sheetNumber: m[1].replace(/\s+/g, '-').toUpperCase(),
      title: (m[2] || baseName).trim() || baseName,
    };
  }
  return { sheetNumber: baseName.toUpperCase(), title: baseName };
}
