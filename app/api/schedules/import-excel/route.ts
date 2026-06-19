export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

/* ── Excel serial date → JS Date ─────────────────────────── */
const EXCEL_EPOCH = new Date(1899, 11, 30).getTime();
function excelToDate(serial: number | string | null | undefined): Date | null {
  if (serial === null || serial === undefined || serial === '') return null;
  const n = typeof serial === 'string' ? parseFloat(serial) : serial;
  if (isNaN(n) || n < 1000) return null; // too small for a valid date
  const d = new Date(EXCEL_EPOCH + n * 86400000);
  if (isNaN(d.getTime())) return null;
  // Set to noon to avoid timezone issues
  d.setHours(12, 0, 0, 0);
  return d;
}

/* ── Detect group type from row context ──────────────────── */
function detectGroupType(name: string): string | null {
  const lower = name.toLowerCase().trim();
  // Main groups: typically project title or major section headers
  if (lower.includes('key milestones') || lower.includes('closeout') || lower.includes('commissioning')) return 'group_sub';
  if (lower.includes('ritz') || lower.includes('penthouse') || lower.includes('condo renovation') || lower.includes('rev.')) return 'group_main';
  // Check for section-like patterns without activity IDs
  if (lower.startsWith('★★★') || lower.startsWith('***')) return 'group_crit';
  return null;
}

/* ── Status normalization ────────────────────────────────── */
function normalizeStatus(raw: string | number | null): string {
  if (!raw) return 'pend';
  const s = String(raw).toLowerCase().trim();
  if (s === 'done' || s === 'complete' || s === 'completed' || s === '1') return 'done';
  if (s === 'ip' || s === 'in prog' || s === 'in progress' || s === 'in_progress') return 'ip';
  return 'pend';
}

/* ── Parse CPM sheet ─────────────────────────────────────── */
function parseCPMSheet(ws: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
  
  // Find header row: look for row containing 'ID' and 'Activity Name'
  let headerRow = -1;
  let colMap: Record<string, number> = {};
  
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const cells = row.map((c: any) => String(c).trim().toLowerCase());
    const idIdx = cells.findIndex((c: string) => c === 'id');
    const nameIdx = cells.findIndex((c: string) => c === 'activity name' || c === 'activity');
    if (idIdx >= 0 && nameIdx >= 0) {
      headerRow = i;
      colMap = {};
      row.forEach((c: any, j: number) => {
        const h = String(c).trim().toLowerCase();
        if (h === 'id') colMap['id'] = j;
        else if (h === 'activity name' || h === 'activity') colMap['name'] = j;
        else if (h === 'od') colMap['od'] = j;
        else if (h === 'rd') colMap['rd'] = j;
        else if (h === '%') colMap['pct'] = j;
        else if (h === 'status') colMap['status'] = j;
        else if (h === 'start') colMap['start'] = j;
        else if (h === 'finish') colMap['finish'] = j;
        else if (h === 'ls') colMap['ls'] = j;
        else if (h === 'lf') colMap['lf'] = j;
        else if (h === 'tf') colMap['tf'] = j;
        else if (h === 'predecessors') colMap['pred'] = j;
        else if (h === 'notes') colMap['notes'] = j;
        else if (h === 'la#') colMap['la'] = j;
      });
      break;
    }
  }

  if (headerRow < 0) throw new Error('No se encontró la fila de encabezados del CPM. Se esperan columnas: ID, Activity Name, OD, RD, %, Status, Start, Finish');

  // Extract metadata from rows before header
  let revision = '';
  let dataDate: Date | null = null;
  let tcoDate: Date | null = null;
  
  for (let i = 0; i < headerRow; i++) {
    const text = String(data[i]?.[0] || '').trim();
    // Revision: look for Rev.X or Rev X
    const revMatch = text.match(/Rev\.?\s*(\d+\.?\d*)/i);
    if (revMatch) revision = `Rev.${revMatch[1]}`;
    // Data Date
    const ddMatch = text.match(/Data\s*Date[:\s]+([\w\d-]+)/i);
    if (ddMatch) {
      const parsed = new Date(ddMatch[1]);
      if (!isNaN(parsed.getTime())) dataDate = parsed;
    }
    // TCO Target
    const tcoMatch = text.match(/TCO\s*(?:Target)?[:\s]+([\w\d-]+)/i);
    if (tcoMatch) {
      const parsed = new Date(tcoMatch[1]);
      if (!isNaN(parsed.getTime())) tcoDate = parsed;
    }
  }

  // Parse activities
  const activities: any[] = [];
  let sortOrder = 0;

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    const id = String(row[colMap['id']] || '').trim();
    const name = String(row[colMap['name']] || '').trim();
    if (!name) continue;

    const od = Number(row[colMap['od']] || 0) || 0;
    const rd = Number(row[colMap['rd']] || 0) || 0;
    const pctRaw = row[colMap['pct']];
    const pct = pctRaw !== '' ? (Number(pctRaw) || 0) : 0;
    const percentComplete = pct <= 1 && pct > 0 ? Math.round(pct * 100) : pct > 100 ? 100 : Math.round(pct);
    const statusRaw = row[colMap['status']];
    const status = normalizeStatus(statusRaw);
    const startDate = excelToDate(row[colMap['start']]);
    const finishDate = excelToDate(row[colMap['finish']]);
    const tf = Number(row[colMap['tf']] || 0) || 0;
    const pred = colMap['pred'] !== undefined ? String(row[colMap['pred']] || '') : '';
    const notes = colMap['notes'] !== undefined ? String(row[colMap['notes']] || '') : '';

    // Detect if it's a group header (no ID, or detected as group)
    if (!id) {
      const groupType = detectGroupType(name) || 'group_sub';
      activities.push({
        sortOrder: sortOrder++,
        activityId: '',
        activityName: name,
        activityType: groupType,
        originalDuration: 0,
        remainingDuration: 0,
        percentComplete: 0,
        startDate: null,
        finishDate: null,
        status: 'pend',
        isCritical: groupType === 'group_crit',
        isMilestone: false,
        notes: notes || null,
        wbsCode: '',
        resourceName: '',
        costLoaded: 0,
        floatDays: 0,
        predecessors: null,
      });
      continue;
    }

    // Regular activity or milestone
    const isMilestone = od === 0;
    const isCritical = tf === 0 && !isMilestone && status !== 'done';

    // Extract resource/vendor from name pattern "Activity — Vendor ($amount)"
    let resourceName = '';
    const vendorMatch = name.match(/—\s*([^($]+)/);
    if (vendorMatch) resourceName = vendorMatch[1].trim();

    // Extract cost from name pattern "($123,456)"
    let costLoaded = 0;
    const costMatch = name.match(/\$([\d,]+(?:\.\d+)?)/);
    if (costMatch) costLoaded = parseFloat(costMatch[1].replace(/,/g, ''));

    activities.push({
      sortOrder: sortOrder++,
      activityId: id,
      activityName: name,
      activityType: isMilestone ? 'milestone' : 'task',
      originalDuration: od,
      remainingDuration: rd,
      percentComplete,
      startDate,
      finishDate,
      actualStart: status === 'done' && startDate ? startDate : null,
      actualFinish: status === 'done' && finishDate ? finishDate : null,
      status,
      isCritical,
      isMilestone,
      notes: notes || null,
      wbsCode: id.split('-')[0] || '',
      predecessors: pred || null,
      resourceName,
      costLoaded,
      floatDays: tf,
    });
  }

  return { activities, revision, dataDate, tcoDate };
}

/* ── Parse LOOK AHEAD sheet ──────────────────────────────── */
function parseLookAheadSheet(ws: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
  
  // Find header row
  let headerRow = -1;
  let colMap: Record<string, number> = {};
  
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const cells = row.map((c: any) => String(c).trim().toLowerCase());
    const idIdx = cells.findIndex((c: string) => c === 'id');
    const actIdx = cells.findIndex((c: string) => c === 'activity');
    if (idIdx >= 0 && actIdx >= 0) {
      headerRow = i;
      row.forEach((c: any, j: number) => {
        const h = String(c).trim().toLowerCase();
        if (h === '#') colMap['num'] = j;
        if (h === 'id') colMap['id'] = j;
        if (h === 'activity') colMap['name'] = j;
        if (h === 'action') colMap['action'] = j;
        if (h === 'start') colMap['start'] = j;
        if (h === 'finish') colMap['finish'] = j;
        if (h === 'dur') colMap['dur'] = j;
        if (h === '%') colMap['pct'] = j;
        if (h === 'status') colMap['status'] = j;
        if (h === 'tf') colMap['tf'] = j;
        if (h === 'notes') colMap['notes'] = j;
      });
      break;
    }
  }

  if (headerRow < 0) return [];

  const laActivities: any[] = [];
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const id = String(row[colMap['id']] || '').trim();
    const name = String(row[colMap['name']] || '').trim();
    if (!id || !name) continue;

    const pctRaw = row[colMap['pct']];
    const pct = pctRaw !== '' ? (Number(pctRaw) || 0) : 0;
    const percentComplete = pct <= 1 && pct > 0 ? Math.round(pct * 100) : Math.round(pct);

    laActivities.push({
      activityId: id,
      activityName: name,
      action: String(row[colMap['action']] || '').trim(),
      startDate: excelToDate(row[colMap['start']]),
      finishDate: excelToDate(row[colMap['finish']]),
      duration: Number(row[colMap['dur']] || 0) || 0,
      percentComplete,
      status: normalizeStatus(row[colMap['status']]),
      tf: Number(row[colMap['tf']] || 0) || 0,
      notes: String(row[colMap['notes']] || '').trim(),
    });
  }

  return laActivities;
}

/* ── POST handler ─────────────────────────────────────────── */
export async function POST(
  request: Request
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const customRevision = formData.get('revision') as string | null;
    const customDataDate = formData.get('dataDate') as string | null;
    const action = formData.get('action') as string || 'import'; // 'preview' or 'import'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Read Excel file
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });

    // Find CPM sheet (try 'CPM', 'Schedule', or first sheet)
    const cpmSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('cpm')) 
      || wb.SheetNames.find(n => n.toLowerCase().includes('schedule'))
      || wb.SheetNames[0];
    
    if (!cpmSheetName) return NextResponse.json({ error: 'No se encontró una hoja de CPM en el archivo' }, { status: 400 });

    const parsed = parseCPMSheet(wb.Sheets[cpmSheetName]);
    
    // Parse Look-Ahead if available
    const laSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('look') || n.toLowerCase().includes('lookahead'));
    let laActivities: any[] = [];
    if (laSheetName) {
      laActivities = parseLookAheadSheet(wb.Sheets[laSheetName]);
    }

    const revision = customRevision || parsed.revision || `Rev.${new Date().toISOString().slice(0, 10)}`;
    const dataDate = customDataDate ? new Date(customDataDate) : (parsed.dataDate || new Date());

    // Preview mode
    if (action === 'preview') {
      const tasks = parsed.activities.filter((a: any) => a.activityType === 'task' || a.activityType === 'milestone');
      const groups = parsed.activities.filter((a: any) => a.activityType.startsWith('group_'));
      return NextResponse.json({
        revision,
        dataDate: dataDate.toISOString().split('T')[0],
        tcoDate: parsed.tcoDate?.toISOString().split('T')[0] || null,
        totalActivities: parsed.activities.length,
        taskCount: tasks.length,
        groupCount: groups.length,
        milestoneCount: tasks.filter((a: any) => a.isMilestone).length,
        criticalCount: tasks.filter((a: any) => a.isCritical).length,
        doneCount: tasks.filter((a: any) => a.status === 'done').length,
        lookAheadCount: laActivities.length,
        sheetsFound: wb.SheetNames,
        sampleActivities: parsed.activities.slice(0, 10).map((a: any) => ({
          id: a.activityId, name: a.activityName, type: a.activityType,
          start: a.startDate?.toISOString().split('T')[0],
          finish: a.finishDate?.toISOString().split('T')[0],
          status: a.status, pct: a.percentComplete,
        })),
      });
    }

    // Import mode: mark previous active as Superseded, create new
    await prisma.schedule.updateMany({
      where: { projectId, status: 'Active' },
      data: { status: 'Superseded' },
    });

    // Calculate project dates
    const taskActs = parsed.activities.filter((a: any) => a.startDate && (a.activityType === 'task' || a.activityType === 'milestone'));
    const starts = taskActs.map((a: any) => a.startDate!.getTime());
    const finishes = taskActs.map((a: any) => a.finishDate?.getTime() || a.startDate!.getTime());
    const projectStart = starts.length > 0 ? new Date(Math.min(...starts)) : null;
    const projectFinish = finishes.length > 0 ? new Date(Math.max(...finishes)) : null;

    // Build look-ahead activity entries (flagged with isLookAhead)
    const laEntries = laActivities.map((la: any, idx: number) => {
      // Find parent activity in CPM
      const parent = parsed.activities.find((a: any) => a.activityId === la.activityId);
      return {
        sortOrder: parsed.activities.length + idx,
        activityId: la.activityId,
        activityName: la.activityName,
        activityType: 'task',
        originalDuration: la.duration,
        remainingDuration: la.duration,
        percentComplete: la.percentComplete,
        startDate: la.startDate,
        finishDate: la.finishDate,
        status: la.status,
        isCritical: la.tf === 0 && la.status !== 'done',
        isMilestone: la.duration === 0,
        notes: la.notes || null,
        wbsCode: la.activityId.split('-')[0] || '',
        resourceName: '',
        costLoaded: parent?.costLoaded || 0,
        floatDays: la.tf,
        isLookAhead: true,
        parentActivityId: parent?.activityId || null,
      };
    });

    const allActivities = [
      ...parsed.activities.map((a: any) => ({ ...a, isLookAhead: false, parentActivityId: null })),
      ...laEntries,
    ];

    const schedule = await prisma.schedule.create({
      data: {
        projectId,
        revision,
        dataDate,
        projectStart,
        projectFinish,
        tcoDate: parsed.tcoDate || null,
        notes: `Imported from Excel: ${file.name}`,
        status: 'Active',
        activities: {
          create: allActivities.map((a: any, idx: number) => ({
            sortOrder: a.sortOrder ?? idx,
            activityId: a.activityId || '',
            activityName: a.activityName || '',
            activityType: a.activityType || 'task',
            originalDuration: a.originalDuration ?? 0,
            remainingDuration: a.remainingDuration ?? 0,
            percentComplete: a.percentComplete ?? 0,
            startDate: a.startDate || null,
            finishDate: a.finishDate || null,
            actualStart: a.actualStart || null,
            actualFinish: a.actualFinish || null,
            status: a.status || 'pend',
            isCritical: a.isCritical ?? false,
            isMilestone: a.isMilestone ?? false,
            notes: a.notes || null,
            wbsCode: a.wbsCode || '',
            predecessors: a.predecessors || null,
            floatDays: a.floatDays ?? 0,
            costLoaded: a.costLoaded ?? 0,
            resourceName: a.resourceName || '',
            isLookAhead: a.isLookAhead ?? false,
            parentActivityId: a.parentActivityId || null,
          })),
        },
      },
      include: {
        activities: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { activities: true } },
      },
    });

    console.log(`Schedule imported: ${revision} for project ${projectId} — ${allActivities.length} activities (${laEntries.length} look-ahead)`);

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        revision: schedule.revision,
        dataDate: schedule.dataDate,
        status: schedule.status,
        activityCount: schedule._count.activities,
        lookAheadCount: laEntries.length,
      },
      message: `CPM ${revision} importado exitosamente. ${parsed.activities.length} actividades del CPM + ${laEntries.length} del Look-Ahead. Versiones anteriores preservadas.`,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Schedule Excel import error:', error);
    return NextResponse.json({ error: error.message || 'Failed to import schedule' }, { status: 500 });
  }
}
