export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext } from '@/lib/plan-room';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') ?? '';
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: ctx.companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const sets = await prisma.planSet.findMany({ where: { projectId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return NextResponse.json(sets);
  } catch (error: any) {
    console.error('GET /api/plan-sets error:', error);
    return NextResponse.json({ error: 'Failed to load plan sets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { projectId, name, setType, issueDate, notes } = body ?? {};
    if (!projectId || !name?.trim()) {
      return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 });
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: ctx.companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const count = await prisma.planSet.count({ where: { projectId } });
    const set = await prisma.planSet.create({
      data: {
        projectId,
        name: String(name).trim(),
        setType: setType?.trim() || 'Original',
        issueDate: issueDate ? new Date(issueDate) : null,
        notes: notes?.trim() || null,
        sortOrder: count,
      },
    });
    return NextResponse.json(set, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/plan-sets error:', error);
    return NextResponse.json({ error: 'Failed to create plan set' }, { status: 500 });
  }
}
