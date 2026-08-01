export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================
// RUTA TEMPORAL DE ADMINISTRACIÓN — BORRAR DESPUÉS DE USAR
// ------------------------------------------------------------
// Corrige el rol legacy 'user' del dueño de PDG a 'owner' y
// restablece el logo PDG en su compañía (regla de marca:
// PDG exclusivo de The Project Delivery Group LLC).
//
// USO (una sola vez):
//   https://app.kodupm.com/api/internal/set-owner?key=kodupm-migrar-2026&email=TU_CORREO
//
// DESPUÉS: borrar app/api/internal/set-owner/route.ts del repo
// (GitHub → archivo → ⋮ → Delete file → Commit).
// ============================================================

const KEY = 'kodupm-migrar-2026';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== KEY) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const email = searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, companyId: true, company: { select: { name: true, logoUrl: true } } },
    });
    if (!user) {
      return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
    }

    const before = { role: user.role, company: user.company?.name, logoUrl: user.company?.logoUrl };

    // 1) Rol: 'user' (u otro legacy) → 'owner' (admin del tenant)
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'owner' },
    });

    // 2) Logo PDG solo si la compañía es The Project Delivery Group LLC
    let logoSet = false;
    if (user.companyId && /project\s*delivery\s*group/i.test(user.company?.name ?? '')) {
      await prisma.company.update({
        where: { id: user.companyId },
        data: { logoUrl: '/pdg_logo.png' },
      });
      logoSet = true;
    }

    return NextResponse.json({
      ok: true,
      before,
      after: {
        role: 'owner',
        logoUrl: logoSet ? '/pdg_logo.png' : user.company?.logoUrl ?? null,
      },
      nextStep: 'CIERRA SESIÓN y vuelve a entrar. Luego BORRA esta ruta del repo.',
    });
  } catch (error) {
    console.error('set-owner error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
