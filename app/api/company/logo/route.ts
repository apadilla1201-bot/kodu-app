export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { put, del } from '@vercel/blob';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

// Logo de la compañía (logoUrl) — subir / reemplazar / quitar.
// Solo roles de gestión (admin / owner-empresa). El PM no cambia la marca.
// El logo se usa en: login, sidebar y PDFs generados (próxima fase).
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role ?? 'viewer';
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, WebP or SVG' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Max 2 MB' }, { status: 413 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { logoUrl: true },
    });

    // Borrar el logo anterior del storage (si era de Vercel Blob)
    if (company?.logoUrl?.includes('blob.vercel-storage.com')) {
      try { await del(company.logoUrl); } catch { /* no bloquear */ }
    }

    const ext = file.type === 'image/png' ? 'png'
      : file.type === 'image/svg+xml' ? 'svg'
      : file.type === 'image/webp' ? 'webp' : 'jpg';

    const blob = await put(`logos/${companyId}/logo.${ext}`, file, {
      access: 'public',
      contentType: file.type,
    });

    await prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: blob.url },
    });

    return NextResponse.json({ logoUrl: blob.url });
  } catch (error) {
    console.error('POST /api/company/logo error:', error);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role ?? 'viewer';
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { logoUrl: true },
    });
    if (company?.logoUrl?.includes('blob.vercel-storage.com')) {
      try { await del(company.logoUrl); } catch { /* no bloquear */ }
    }

    // logoUrl = null → la app muestra el wordmark koduPM (login/sidebar/PDFs)
    await prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/company/logo error:', error);
    return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 });
  }
}
