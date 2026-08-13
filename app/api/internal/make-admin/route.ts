export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// RUTA TEMPORAL — BORRAR DESPUÉS DE USARLA.
// Promueve a admin al usuario con la sesión iniciada.
// Protección: ?key=kodupm-migrar-2026  (misma clave de las migraciones)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? '';
  const expected = process.env.MIGRATE_KEY ?? 'kodupm-migrar-2026';
  if (key !== expected) {
    return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 401 });
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? '';
  if (!email) {
    return NextResponse.json(
      { ok: false, error: 'No active session. Sign in first, then open this URL again.' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: false, error: `User not found: ${email}` }, { status: 404 });
  }

  const previousRole = user.role;
  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
    select: { email: true, role: true, companyId: true },
  });

  // Listar los demás usuarios de la empresa (por si quieres promover a más gente luego desde Team)
  const teammates = updated.companyId
    ? await prisma.user.findMany({
        where: { companyId: updated.companyId, NOT: { email } },
        select: { email: true, role: true },
        take: 20,
      })
    : [];

  return NextResponse.json({
    ok: true,
    promoted: updated.email,
    previousRole,
    newRole: updated.role,
    nextStep:
      'CIERRA SESIÓN y vuelve a entrar — tu sesión guarda el rol viejo hasta que entres de nuevo. Después BORRA app/api/internal del repo.',
    teammates,
  });
}
