export const dynamic = 'force-dynamic';

// ============================================================
// Cierre sin login por parte del CREADOR (decisionToken).
// El correo "fue respondido" incluye un botón "✓ Close" que apunta
// a /respond/close/[token]; esa página confirma contra esta API.
// Un solo token sirve para RFI o Submittal (se detecta cuál es).
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function findByToken(token: string) {
  const rfi = await prisma.rFI.findFirst({
    where: { decisionToken: token },
    include: { project: { select: { projectNumber: true, projectName: true } } },
  });
  if (rfi) return { kind: 'rfi' as const, item: rfi };

  const submittal = await prisma.submittal.findFirst({
    where: { decisionToken: token },
    include: { project: { select: { projectNumber: true, projectName: true } } },
  });
  if (submittal) return { kind: 'submittal' as const, item: submittal };

  return null;
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const found = await findByToken(params?.token ?? '');
    if (!found) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    const { kind, item } = found as any;
    return NextResponse.json({
      kind,
      number: kind === 'rfi' ? item.rfiNumber : item.submittalNumber,
      title: kind === 'rfi' ? item.subject : item.title,
      status: item.status,
      projectName: item.project.projectName,
      projectNumber: item.project.projectNumber,
      responseBy: item.responseBy ?? null,
      responseText: item.responseText ?? null,
      alreadyClosed: item.status === 'Closed' || item.status === 'Approved',
    });
  } catch (error: any) {
    console.error('GET /api/close/[token] error:', error);
    return NextResponse.json({ error: 'Failed to load item' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const found = await findByToken(params?.token ?? '');
    if (!found) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    const { kind, item } = found as any;

    const body = await request.json().catch(() => ({}));
    const closedBy = body?.closedBy ? String(body.closedBy) : item.submittedBy || 'Project Manager';

    if (item.status === 'Closed' || item.status === 'Approved') {
      return NextResponse.json({ ok: true, alreadyClosed: true });
    }

    if (kind === 'rfi') {
      await prisma.rFI.update({
        where: { id: item.id },
        data: { status: 'Closed', ballInCourt: null, ballInCourtRole: null },
      });
    } else {
      await prisma.submittal.update({
        where: { id: item.id },
        data: { status: 'Approved', reviewedBy: closedBy, reviewedDate: new Date(), ballInCourt: null, ballInCourtRole: null },
      });
    }

    return NextResponse.json({ ok: true, kind, status: kind === 'rfi' ? 'Closed' : 'Approved' });
  } catch (error: any) {
    console.error('POST /api/close/[token] error:', error);
    return NextResponse.json({ error: 'Failed to close item' }, { status: 500 });
  }
}
