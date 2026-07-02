export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { GC_ADDRESS_FULL, GC_NAME, GC_NAME_UPPER } from '@/lib/gc-branding';

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtShort(d: Date | string | null) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}

function fmtMonthDay(d: Date | string | null) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

function fmtMonShort(d: Date | string | null) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[dt.getMonth()]} ${dt.getDate()}`;
}

function fmtWindowRange(start: Date, end: Date) {
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const sM = months[start.getMonth()];
  const eM = months[end.getMonth()];
  if (sM === eM) return `${sM} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  return `${sM.substring(0,3)} ${start.getDate()} – ${eM.substring(0,3)} ${end.getDate()}, ${start.getFullYear()}`;
}

function fmtDayRange(start: Date, end: Date) {
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${days[start.getDay()]} ${months[start.getMonth()]} ${start.getDate()} THROUGH ${days[end.getDay()]} ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function extractAction(name: string): { cleanName: string; action: string } {
  const m = name.match(/\[([^\]]+)\]\s*$/);
  if (m) {
    return { cleanName: name.replace(/\s*\[[^\]]+\]\s*$/, '').replace(/^LA-/, ''), action: m[1].toUpperCase() };
  }
  return { cleanName: name.replace(/^LA-/, ''), action: '' };
}

function statusLabel(s: string) {
  if (s === 'done') return 'Done';
  if (s === 'ip') return 'In Prog';
  return 'Pend';
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    const companyId = (session?.user as any)?.companyId ?? '';

    const schedule = await prisma.schedule.findFirst({
      where: { id: params.id, project: { companyId } },
      include: {
        activities: { orderBy: { sortOrder: 'asc' } },
        project: { select: { projectName: true, projectNumber: true, client: true, location: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Accept optional startDate in POST body
    let bodyData: any = {};
    try { bodyData = await request.json(); } catch {}
    const startDateParam = bodyData?.startDate;
    const windowStart = startDateParam ? new Date(startDateParam) : new Date(schedule.dataDate);
    if (isNaN(windowStart.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    const windowEnd = new Date(windowStart.getTime() + 13 * 86400000); // 14 days inclusive

    // Get CPM activities that fall within the 2-week window (always include these)
    const cpmInWindow = schedule.activities.filter(a => {
      if (a.isLookAhead) return false;
      if (a.activityType.startsWith('group_')) return false;
      if (a.status === 'done') return false;
      if (!a.startDate) return false;
      const start = new Date(a.startDate);
      const end = a.finishDate ? new Date(a.finishDate) : start;
      return start <= windowEnd && end >= windowStart;
    });

    // Also get explicit look-ahead detail activities
    const laActivities = schedule.activities.filter(a => a.isLookAhead);
    
    // Merge: CPM window activities + any look-ahead details, deduplicate by id
    const seen = new Set<string>();
    const windowActivities = [...cpmInWindow, ...laActivities].filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    // Classify activities by action
    const starts: any[] = [];
    const finishes: any[] = [];
    const continues_: any[] = [];
    const startFinish: any[] = [];
    const criticalActs: any[] = [];

    for (const act of windowActivities) {
      const { action } = extractAction(act.activityName);
      const isCritical = act.floatDays === 0 && act.status !== 'done';
      if (isCritical) criticalActs.push(act);
      
      if (action.includes('START') && action.includes('FINISH')) startFinish.push(act);
      else if (action.includes('FINISH')) finishes.push(act);
      else if (action.includes('START')) starts.push(act);
      else if (action.includes('CONTINU')) continues_.push(act);
      else {
        // Auto-classify based on dates
        const s = act.startDate ? new Date(act.startDate) : null;
        const f = act.finishDate ? new Date(act.finishDate) : null;
        if (s && s >= windowStart && s <= windowEnd) starts.push(act);
        else if (f && f >= windowStart && f <= windowEnd) finishes.push(act);
        else continues_.push(act);
      }
    }

    // Build activity summary for LLM
    const actSummary = windowActivities.map(a => {
      const { cleanName, action } = extractAction(a.activityName);
      return `${a.activityId.replace('LA-','')}: ${cleanName} | Action: ${action || 'N/A'} | ${fmtShort(a.startDate)}–${fmtShort(a.finishDate)} | Status: ${statusLabel(a.status)} | TF: ${a.floatDays}d${a.floatDays === 0 ? ' ★CRITICAL' : ''}`;
    }).join('\n');

    // Get all CPM critical activities for context
    const allCritical = schedule.activities.filter(a => a.floatDays === 0 && a.status !== 'done' && !a.isLookAhead && !a.activityType.startsWith('group_'));
    const critSummary = allCritical.slice(0, 10).map(a => 
      `${a.activityId}: ${a.activityName} | ${fmtShort(a.startDate)}–${fmtShort(a.finishDate)} | TF: ${a.floatDays}d`
    ).join('\n');

    const tcoDate = schedule.tcoDate ? fmtMonthDay(schedule.tcoDate) : 'TBD';
    const projName = schedule.project.projectName || 'Project';
    const client = schedule.project.client || 'Owner';

    // ── Generate narrative via LLM ──
    let narrative = '';
    let alertText = '';
    let criticalChainHtml = '';
    
    try {
      const llmRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/llm-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'generate', type: 'schedule-narrative' }),
      }).catch(() => null);

      // Direct LLM call
      const apiKey = process.env.ABACUSAI_API_KEY;
      if (apiKey) {
        const llmResponse = await fetch('https://api.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-5.4-mini',
            max_tokens: 1500,
            messages: [{
              role: 'system',
              content: `You are a Senior Construction PM writing an executive schedule report for the Owner. Be concise, factual, direct. Use construction PM language. Output JSON only with these fields:
- "summary": 2-3 sentence paragraph about the window's activities count, what starts/finishes, and critical path status. Reference the TCO date.
- "alert": 1-2 sentence schedule alert if any critical path items exist or risk exists. If none, empty string.
- "criticalChain": array of {id, name, dateRange, tf} for the top 3 critical chain activities (TF=0). If none, empty array.`
            }, {
              role: 'user',
              content: `Project: ${projName}\nOwner: ${client}\nTCO Target: ${tcoDate}\nCPM: ${schedule.revision}\nData Date: ${fmtMonthDay(schedule.dataDate)}\nWindow: ${fmtDayRange(windowStart, windowEnd)}\n\n--- LOOK AHEAD ACTIVITIES (${windowActivities.length} total) ---\n${actSummary}\n\n--- CRITICAL PATH (CPM-wide, TF=0) ---\n${critSummary || 'None identified'}\n\nStarts: ${starts.length} | Finishes: ${finishes.length} | Continues: ${continues_.length} | Critical in window: ${criticalActs.length}`
            }]
          })
        });
        
        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          const content = llmData.choices?.[0]?.message?.content || '';
          // Extract JSON from possible markdown code block
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              narrative = parsed.summary || '';
              alertText = parsed.alert || '';
              if (parsed.criticalChain && parsed.criticalChain.length > 0) {
                criticalChainHtml = `
                <div style="margin-top:12px; border:2px solid #C9A96E; border-radius:6px; padding:10px 14px;">
                  <div style="font-size:10px; font-weight:bold; color:#0F1B33; margin-bottom:8px; letter-spacing:1px;">CRITICAL CHAIN — ZERO FLOAT</div>
                  <div style="display:flex; gap:16px; flex-wrap:wrap;">
                    ${parsed.criticalChain.map((c: any) => `
                      <div style="flex:1; min-width:160px; background:#fff8f0; border:1px solid #C9A96E; border-radius:4px; padding:8px 10px;">
                        <div style="font-size:10px; font-weight:bold; color:#8B0000;">${esc(c.id || '')}  ${esc(c.name || '')}</div>
                        <div style="font-size:9px; color:#555; margin-top:3px;">${esc(c.dateRange || '')}  ·  TF = ${c.tf ?? 0}d</div>
                      </div>
                    `).join('')}
                  </div>
                </div>`;
              }
            } catch (e) {
              console.error('LLM JSON parse error:', e);
            }
          }
        }
      }
    } catch (llmErr) {
      console.error('LLM narrative generation error:', llmErr);
    }

    // Fallback narrative if LLM failed
    if (!narrative) {
      narrative = `${windowActivities.length} activities are active in this window. ${starts.length} activities start, ${finishes.length} finish, and ${continues_.length} continue. ${criticalActs.length > 0 ? `${criticalActs.length} critical path activit${criticalActs.length === 1 ? 'y is' : 'ies are'} in this window.` : 'No critical path activities in this window.'} TCO target holds at ${tcoDate}.`;
    }

    // ── Build 2-page Executive HTML ──
    const windowRangeLabel = fmtWindowRange(windowStart, windowEnd);
    const dayRangeLabel = fmtDayRange(windowStart, windowEnd);
    const dataDateLabel = fmtMonShort(schedule.dataDate);
    const projTitle = projName.toUpperCase().replace(/RITZ.*CARLTON\s*/i, 'RITZ ').replace(/PH\s*/i, 'PH AT ');

    // Starts detail text
    const startsDetail = starts.map(a => { const { cleanName } = extractAction(a.activityName); return cleanName.split('—')[0].trim(); }).slice(0, 4).join(', ');
    const finishDetail = finishes.map(a => { const { cleanName } = extractAction(a.activityName); return cleanName.split('—')[0].trim(); }).slice(0, 3).join(', ');
    const contDetail = continues_.map(a => { const { cleanName } = extractAction(a.activityName); return cleanName.split('—')[0].trim(); }).slice(0, 4).join(', ');
    const critDetail = criticalActs.map(a => { const { cleanName } = extractAction(a.activityName); return cleanName.split('—')[0].trim(); }).slice(0, 2).join(', ');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a1a; font-size: 10px; }
  
  /* ═══ PAGE 1 ═══ */
  .page1 { width: 100%; min-height: 100vh; position: relative; }
  .p1-topbar { background: #0F1B33; color: #fff; padding: 10px 28px; display: flex; justify-content: space-between; align-items: center; }
  .p1-topbar h1 { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .p1-topbar .right { font-size: 9px; text-align: right; opacity: 0.85; }
  .p1-topbar .gold { color: #C9A96E; }
  
  .p1-hero { padding: 20px 28px 12px; border-bottom: 3px solid #C9A96E; }
  .p1-hero .project-title { font-size: 26px; font-weight: 800; letter-spacing: 3px; color: #0F1B33; text-transform: uppercase; }
  .p1-hero .company { font-size: 11px; font-weight: 600; color: #C9A96E; letter-spacing: 2px; margin-top: 2px; }
  .p1-hero .owner-line { font-size: 10px; color: #555; margin-top: 6px; }
  
  .p1-section-header { background: #1B2A4A; color: #C9A96E; padding: 8px 28px; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 14px; }
  .p1-window-info { padding: 6px 28px; font-size: 9px; color: #555; border-bottom: 1px solid #ddd; display: flex; gap: 20px; }
  .p1-window-info b { color: #0F1B33; }
  
  .p1-narrative { padding: 10px 28px; font-size: 10.5px; line-height: 1.6; color: #333; }
  
  .p1-stats { display: flex; gap: 12px; padding: 10px 28px; }
  .stat-box { flex: 1; text-align: center; border: 1px solid #ddd; border-radius: 6px; padding: 10px 6px; }
  .stat-box .num { font-size: 28px; font-weight: 800; color: #0F1B33; }
  .stat-box .label { font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #777; margin-top: 2px; }
  .stat-box .detail { font-size: 7.5px; color: #999; margin-top: 4px; line-height: 1.3; }
  .stat-box.critical { border-color: #C00000; background: #fff5f5; }
  .stat-box.critical .num { color: #C00000; }
  
  .p1-alert { margin: 10px 28px; padding: 10px 14px; background: #FFF3CD; border: 1px solid #FFCC02; border-left: 4px solid #FFCC02; border-radius: 4px; font-size: 9.5px; line-height: 1.5; }
  .p1-alert .alert-title { font-weight: 700; color: #856404; font-size: 10px; margin-bottom: 3px; }
  
  .p1-footer { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 28px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 8px; color: #888; }
  .p1-footer .left { font-weight: 600; }
  
  /* ═══ PAGE 2 ═══ */
  .page2 { page-break-before: always; width: 100%; min-height: 100vh; position: relative; }
  .p2-topbar { background: #0F1B33; color: #fff; padding: 8px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; }
  .p2-topbar .title { font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
  .p2-topbar .gold { color: #C9A96E; }
  .p2-subtitle { padding: 6px 20px; font-size: 9px; color: #555; background: #f8f8f8; border-bottom: 1px solid #ddd; font-weight: 600; }
  
  .la-table { width: calc(100% - 40px); margin: 8px 20px; border-collapse: collapse; }
  .la-table th { background: #0F1B33; color: #fff; font-size: 8px; font-weight: 700; padding: 5px 8px; text-align: left; letter-spacing: 0.5px; border: 1px solid #0a1225; }
  .la-table th.center { text-align: center; }
  .la-table td { font-size: 9px; padding: 5px 8px; border: 1px solid #ddd; vertical-align: middle; }
  .la-table tr:nth-child(even) td { background: #f9fafb; }
  .la-table tr.critical-row td { font-weight: 700; }
  .la-table tr.critical-row td.act-name { color: #8B0000; }
  .la-table .tf-zero { color: #C00000; font-weight: 800; }
  .la-table .status-done { color: #16a34a; }
  .la-table .status-ip { color: #2563eb; }
  .la-table .status-pend { color: #6b7280; }
  .la-table .action-col { font-size: 8px; text-transform: uppercase; font-weight: 600; color: #555; }
  
  .p2-notes { padding: 6px 20px; font-size: 7.5px; color: #999; line-height: 1.5; margin-top: 4px; }
  .p2-footer { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 20px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 8px; color: #888; }
</style></head><body>

<!-- ═══════════════ PAGE 1: EXECUTIVE SUMMARY ═══════════════ -->
<div class="page1">
  <div class="p1-topbar">
    <h1>Executive Look Ahead Report</h1>
    <div class="right">
      <span class="gold">${esc(windowRangeLabel)}</span><br/>
      <span>CONFIDENTIAL</span>
    </div>
  </div>

  <div style="padding:2px 28px; background:#1B2A4A; display:flex; justify-content:space-between; font-size:8px; color:#C9A96E;">
    <span>CPM ${esc(schedule.revision || '')}</span>
    <span>Data Date: ${esc(dataDateLabel)}</span>
  </div>

  <div class="p1-hero">
    <div class="project-title">${esc(projTitle)}</div>
    <div class="company">${esc(GC_NAME_UPPER)}</div>
    <div class="owner-line">${esc(client)}  |  Project #${esc(schedule.project.projectNumber || '')}  |  ${esc(schedule.project.location || '')}</div>
  </div>

  <div class="p1-section-header">Two-Week Look Ahead</div>
  <div class="p1-window-info">
    <span><b>FIELD & PROCUREMENT WINDOW</b> — ${esc(dayRangeLabel)}</span>
    <span><b>CPM</b> ${esc(schedule.revision || '')}</span>
  </div>

  <div class="p1-narrative">${esc(narrative)}</div>

  <div class="p1-stats">
    <div class="stat-box">
      <div class="num">${starts.length}</div>
      <div class="label">Activities Start</div>
      <div class="detail">${esc(startsDetail) || '—'}</div>
    </div>
    <div class="stat-box">
      <div class="num">${finishes.length}</div>
      <div class="label">Activities Finish</div>
      <div class="detail">${esc(finishDetail) || '—'}</div>
    </div>
    <div class="stat-box">
      <div class="num">${continues_.length + startFinish.length}</div>
      <div class="label">Continue</div>
      <div class="detail">${esc(contDetail) || '—'}</div>
    </div>
    <div class="stat-box critical">
      <div class="num">${criticalActs.length}</div>
      <div class="label">Critical Path</div>
      <div class="detail">${esc(critDetail) || 'No critical items'}</div>
    </div>
  </div>

  ${alertText ? `
  <div class="p1-alert">
    <div class="alert-title">⚠ SCHEDULE ALERT</div>
    ${esc(alertText)}
  </div>` : ''}

  ${criticalChainHtml}

  <div class="p1-footer">
    <span class="left">${GC_NAME_UPPER}  |  ${esc(GC_ADDRESS_FULL)}</span>
    <span>Page 1 of 2  |  CONFIDENTIAL</span>
  </div>
</div>

<!-- ═══════════════ PAGE 2: ACTIVITY DETAIL ═══════════════ -->
<div class="page2">
  <div class="p2-topbar">
    <span class="title">Look Ahead Detail</span>
    <span class="gold">${esc(projTitle)}</span>
    <span>WINDOW: ${esc(windowRangeLabel)}</span>
    <span>DATA DATE: ${esc(dataDateLabel)}</span>
  </div>
  <div class="p2-subtitle">
    ${windowActivities.length} ACTIVITIES IN WINDOW${criticalActs.length > 0 ? ` — ${criticalActs.length} ON CRITICAL PATH` : ''}
  </div>

  <table class="la-table">
    <thead>
      <tr>
        <th style="width:55px;">ID</th>
        <th>ACTIVITY</th>
        <th class="center" style="width:80px;">ACTION</th>
        <th class="center" style="width:60px;">START</th>
        <th class="center" style="width:60px;">FINISH</th>
        <th class="center" style="width:60px;">STATUS</th>
        <th class="center" style="width:45px;">TF</th>
      </tr>
    </thead>
    <tbody>
      ${windowActivities.map(a => {
        const { cleanName, action } = extractAction(a.activityName);
        const isCritical = a.floatDays === 0 && a.status !== 'done';
        const rowClass = isCritical ? 'critical-row' : '';
        const statusClass = a.status === 'done' ? 'status-done' : a.status === 'ip' ? 'status-ip' : 'status-pend';
        const id = (a.activityId || '').replace(/^LA-/, '');
        const tfDisplay = a.status === 'done' ? '—' : (a.floatDays === 0 ? '0d' : `${a.floatDays}d`);
        const tfClass = a.floatDays === 0 && a.status !== 'done' ? 'tf-zero' : '';
        const star = isCritical ? '★ ' : '';
        return `<tr class="${rowClass}">
          <td style="font-weight:600;">${esc(id)}</td>
          <td class="act-name">${esc(star + cleanName)}</td>
          <td class="action-col" style="text-align:center;">${esc(action)}</td>
          <td style="text-align:center;">${fmtShort(a.startDate)}</td>
          <td style="text-align:center;">${fmtShort(a.finishDate)}</td>
          <td class="${statusClass}" style="text-align:center; font-weight:600;">${statusLabel(a.status)}</td>
          <td class="${tfClass}" style="text-align:center;">${tfDisplay}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="p2-notes">
    TF = Total Float (CPM ${esc(schedule.revision || '')})  ·  0d = CRITICAL PATH  ·  Source: CPM_${esc((schedule.project.projectName || '').replace(/\s+/g, '_'))}_${esc(schedule.revision || '')} — Look Ahead sheet
  </div>

  <div class="p2-footer">
    <span>${GC_NAME_UPPER}  |  Prepared by: A. Padilla, Senior PM  |  ${esc(fmtMonShort(schedule.dataDate))}</span>
    <span>Page 2 of 2  |  CONFIDENTIAL</span>
  </div>
</div>

</body></html>`;

    // ── Generate PDF locally ──
    const pdfBuf = await htmlToPdf(html, {
      format: 'Letter',
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    const projNum = schedule.project.projectNumber || 'LA';
    const rev = schedule.revision || '';
    const dateStr = windowStart.toISOString().slice(5, 10).replace('-', '');
    const safeName = `${dateStr}_${projNum}_Executive_LookAhead_${rev}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuf.length),
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    });
  } catch (err) {
    console.error('Look-ahead PDF error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
