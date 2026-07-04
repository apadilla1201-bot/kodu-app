export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.projectContact.findFirst({
      where: { id: params.contactId, projectId: params.id, project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
    if (body.role !== undefined) data.role = String(body.role);
    if (body.company !== undefined) data.company = body.company ? String(body.company) : null;
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const updated = await prisma.projectContact.update({
      where: { id: params.contactId },
      data,
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH contact error:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.projectContact.findFirst({
      where: { id: params.contactId, projectId: params.id, project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.projectContact.update({
      where: { id: params.contactId },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE contact error:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
