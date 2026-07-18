export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

async function getTenantContext() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? '';
  if (!userId) return null;
  let companyId = (session?.user as any)?.companyId ?? '';
  if (!companyId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    companyId = dbUser?.companyId ?? '';
  }
  return { userId, companyId };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId: ctx.companyId },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (error: any) {
    console.error('GET project error:', error);
    return NextResponse.json({ error: 'Failed to load project', code: error?.code ? String(error.code) : undefined }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await prisma.project.findFirst({
      where: { id: params.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json();
    const { projectNumber, projectName, client, location, contractAmount, startDate } = body ?? {};

    if (!projectNumber || !projectName || !client) {
      return NextResponse.json({ error: 'Project number, name, and client are required' }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        projectNumber: String(projectNumber ?? ''),
        projectName: String(projectName ?? ''),
        client: String(client ?? ''),
        location: location ? String(location) : null,
        contractAmount: parseFloat(String(contractAmount ?? '0')) || 0,
        startDate: startDate ? new Date(startDate) : null,
      },
    });
    return NextResponse.json(project);
  } catch (error: any) {
    console.error('PATCH project error:', error);
    return NextResponse.json({ error: 'Failed to update project', code: error?.code ? String(error.code) : undefined }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await prisma.project.findFirst({
      where: { id: params.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Relations cascade per Prisma schema (onDelete: Cascade)
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE project error:', error);
    return NextResponse.json({ error: 'Failed to delete project', code: error?.code ? String(error.code) : undefined }, { status: 500 });
  }
}
