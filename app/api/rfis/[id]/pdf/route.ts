export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PDFDocument } from 'pdf-lib';
import { downloadFileBuffer } from '@/lib/s3';

function esc(str: string): string {
  return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Open:           { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  'Under Review': { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
  Answered:       { bg: '#D1FAE5', text: '#047857', border: '#6EE7B7' },
  Closed:         { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Urgent: { bg: '#FEE2E2', text: '#DC2626' },
  High:   { bg: '#FFEDD5', text: '#EA580C' },
  Normal: { bg: '#DBEAFE', text: '#2563EB' },
  Low:    { bg: '#F3F4F6', text: '#6B7280' },
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id ?? '';

    const rfi = await prisma.rFI.findUnique({
      where: { id: params?.id ?? '' },
      include: {
        project: true,
        attachments: true,
      },
    });

    if (!rfi || rfi?.project?.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const logoUrl = `${baseUrl}/pdg_logo.png`;
    const proj = rfi.project;
    const sc = STATUS_COLORS[rfi.status] ?? STATUS_COLORS.Open;
    const pc = PRIORITY_COLORS[rfi.priority] ?? PRIORITY_COLORS.Normal;

    const isOverdue = rfi.dateDue && !['Answered', 'Closed'].includes(rfi.status) && new Date(rfi.dateDue) < new Date();
    const daysOpen = Math.floor((Date.now() - new Date(rfi.dateSubmitted).getTime()) / 86400000);

    const questionAttachments = (rfi.attachments ?? []).filter(a => a.attachmentType === 'question');
    const responseAttachments = (rfi.attachments ?? []).filter(a => a.attachmentType === 'response');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: letter; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.4; }
  .page { width: 8.5in; min-height: 11in; padding: 0.5in 0.6in; position: relative; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0F1B33; padding-bottom: 14px; margin-bottom: 18px; }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .header-left img { height: 50px; }
  .header-left .company { font-size: 8pt; color: #666; line-height: 1.3; }
  .header-right { text-align: right; }
  .header-right .rfi-num { font-size: 20pt; font-weight: 800; color: #0F1B33; letter-spacing: -0.5px; }
  .header-right .rfi-label { font-size: 8pt; color: #C9A96E; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }

  /* Status bar */
  .status-bar { display: flex; gap: 10px; margin-bottom: 18px; align-items: center; }
  .badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-size: 8.5pt; font-weight: 700; }
  .overdue-badge { background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; }
  .days-badge { background: #F3F4F6; color: #6B7280; font-weight: 600; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .info-box { background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 14px; }
  .info-box h4 { font-size: 7.5pt; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: 8px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .info-label { font-size: 8.5pt; color: #6B7280; }
  .info-value { font-size: 8.5pt; font-weight: 600; color: #1a1a1a; }

  /* Subject banner */
  .subject-banner { background: #0F1B33; color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 18px; }
  .subject-banner .label { font-size: 7.5pt; color: #C9A96E; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 3px; }
  .subject-banner .text { font-size: 12pt; font-weight: 700; }

  /* Sections */
  .section { margin-bottom: 18px; }
  .section-header { font-size: 9pt; font-weight: 800; color: #0F1B33; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 2px solid #C9A96E; padding-bottom: 5px; margin-bottom: 10px; }
  .section-body { font-size: 9.5pt; color: #374151; white-space: pre-wrap; line-height: 1.6; padding: 8px 0; }

  /* Response */
  .response-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px 16px; }
  .response-box .resp-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .response-box .resp-by { font-size: 9pt; font-weight: 700; color: #047857; }
  .response-box .resp-date { font-size: 8pt; color: #6B7280; }
  .response-box .resp-text { font-size: 9.5pt; color: #374151; white-space: pre-wrap; line-height: 1.6; }
  .no-response { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 14px 16px; text-align: center; color: #B45309; font-weight: 600; font-size: 9pt; }

  /* References & Attachments */
  .ref-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .ref-item { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 10px; }
  .ref-item .ref-label { font-size: 7.5pt; color: #9CA3AF; text-transform: uppercase; }
  .ref-item .ref-value { font-size: 9pt; font-weight: 600; margin-top: 2px; }
  .attach-list { list-style: none; }
  .attach-list li { font-size: 8.5pt; color: #4B5563; padding: 4px 0; border-bottom: 1px solid #F3F4F6; }
  .attach-list li:last-child { border-bottom: none; }

  /* Footer */
  .footer { position: absolute; bottom: 0.4in; left: 0.6in; right: 0.6in; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E5E7EB; padding-top: 8px; font-size: 7pt; color: #9CA3AF; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <img src="${logoUrl}" alt="PDG Logo" />
      <div class="company">
        THE PROJECT DELIVERY GROUP, LLC<br/>
        7255 NE 4th Ave., Unit 110-2<br/>
        Miami, FL 33138
      </div>
    </div>
    <div class="header-right">
      <div class="rfi-label">Request for Information</div>
      <div class="rfi-num">RFI ${esc(rfi.rfiNumber)}</div>
    </div>
  </div>

  <!-- Status Bar -->
  <div class="status-bar">
    <span class="badge" style="background:${sc.bg};color:${sc.text};border:1px solid ${sc.border}">${esc(rfi.status)}</span>
    <span class="badge" style="background:${pc.bg};color:${pc.text}">${esc(rfi.priority)} Priority</span>
    ${isOverdue ? '<span class="badge overdue-badge">⚠ OVERDUE</span>' : ''}
    <span class="badge days-badge">${daysOpen} day${daysOpen !== 1 ? 's' : ''} open</span>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <div class="info-box">
      <h4>Project Information</h4>
      <div class="info-row"><span class="info-label">Project</span><span class="info-value">${esc(proj?.projectName ?? '')}</span></div>
      <div class="info-row"><span class="info-label">Number</span><span class="info-value">#${esc(proj?.projectNumber ?? '')}</span></div>
      <div class="info-row"><span class="info-label">Client</span><span class="info-value">${esc(proj?.client ?? '')}</span></div>
      <div class="info-row"><span class="info-label">Location</span><span class="info-value">${esc(proj?.location ?? '')}</span></div>
    </div>
    <div class="info-box">
      <h4>RFI Details</h4>
      <div class="info-row"><span class="info-label">Submitted By</span><span class="info-value">${esc(rfi.submittedBy)}${rfi.submittedByRole ? ' (' + esc(rfi.submittedByRole) + ')' : ''}</span></div>
      <div class="info-row"><span class="info-label">Assigned To</span><span class="info-value">${esc(rfi.assignedTo)}${rfi.assignedToRole ? ' (' + esc(rfi.assignedToRole) + ')' : ''}</span></div>
      <div class="info-row"><span class="info-label">Date Submitted</span><span class="info-value">${fmtDate(rfi.dateSubmitted)}</span></div>
      <div class="info-row"><span class="info-label">Due Date</span><span class="info-value" ${isOverdue ? 'style="color:#DC2626"' : ''}>${fmtDate(rfi.dateDue)}${isOverdue ? ' (OVERDUE)' : ''}</span></div>
      <div class="info-row"><span class="info-label">Cost Impact</span><span class="info-value">${esc(rfi.costImpact)}</span></div>
      <div class="info-row"><span class="info-label">Schedule Impact</span><span class="info-value">${esc(rfi.scheduleImpact)}${rfi.scheduleImpactDays ? ' (' + rfi.scheduleImpactDays + ' days)' : ''}</span></div>
    </div>
  </div>

  <!-- Subject -->
  <div class="subject-banner">
    <div class="label">Subject</div>
    <div class="text">${esc(rfi.subject)}</div>
  </div>

  <!-- References -->
  ${(rfi.discipline || rfi.drawingReference || rfi.specReference) ? `
  <div class="section">
    <div class="section-header">References</div>
    <div class="ref-grid">
      ${rfi.discipline ? `<div class="ref-item"><div class="ref-label">Discipline</div><div class="ref-value">${esc(rfi.discipline)}</div></div>` : ''}
      ${rfi.drawingReference ? `<div class="ref-item"><div class="ref-label">Drawing Reference</div><div class="ref-value">${esc(rfi.drawingReference)}</div></div>` : ''}
      ${rfi.specReference ? `<div class="ref-item"><div class="ref-label">Spec Reference</div><div class="ref-value">${esc(rfi.specReference)}</div></div>` : ''}
    </div>
  </div>
  ` : ''}

  <!-- Question -->
  <div class="section">
    <div class="section-header">Question</div>
    <div class="section-body">${esc(rfi.question)}</div>
    ${questionAttachments.length > 0 ? `
    <div style="margin-top:8px">
      <div style="font-size:7.5pt;color:#9CA3AF;text-transform:uppercase;font-weight:700;margin-bottom:4px">Attachments (${questionAttachments.length})</div>
      <ul class="attach-list">
        ${questionAttachments.map(a => `<li>📎 ${esc(a.fileName)}</li>`).join('')}
      </ul>
    </div>` : ''}
  </div>

  <!-- Response -->
  <div class="section">
    <div class="section-header">Response</div>
    ${rfi.responseText ? `
    <div class="response-box">
      <div class="resp-header">
        <span class="resp-by">✓ Responded by ${esc(rfi.responseBy ?? 'Unknown')}</span>
        <span class="resp-date">${fmtDateLong(rfi.responseDate)}</span>
      </div>
      <div class="resp-text">${esc(rfi.responseText)}</div>
      ${responseAttachments.length > 0 ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #BBF7D0">
        <div style="font-size:7.5pt;color:#047857;text-transform:uppercase;font-weight:700;margin-bottom:4px">Response Attachments (${responseAttachments.length})</div>
        <ul class="attach-list">
          ${responseAttachments.map(a => `<li>📎 ${esc(a.fileName)}</li>`).join('')}
        </ul>
      </div>` : ''}
    </div>` : `
    <div class="no-response">⏳ Awaiting Response</div>`}
  </div>

  <!-- Notes -->
  ${rfi.notes ? `
  <div class="section">
    <div class="section-header">Additional Notes</div>
    <div class="section-body">${esc(rfi.notes)}</div>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <span>© Kodu GC · Confidential</span>
    <span>THE PROJECT DELIVERY GROUP, LLC</span>
    <span>Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>

</div>
</body>
</html>`;

    // Generate PDF via HTML2PDF API
    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: htmlContent,
        pdf_options: {
          format: 'Letter',
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
          print_background: true,
        },
      }),
    });

    const createResult = await createResponse.json();
    const request_id = createResult?.request_id;
    if (!request_id) {
      console.error('HTML2PDF create failed:', JSON.stringify(createResult));
      return NextResponse.json({ error: 'No request ID returned' }, { status: 500 });
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 90;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });
      const statusResult = await statusResponse.json();
      const status = statusResult?.status ?? 'FAILED';
      const result = statusResult?.result ?? null;

      if (status === 'SUCCESS') {
        if (result?.result) {
          const generatedPdfBytes = Buffer.from(result.result, 'base64');

          // Merge ALL question attachments (sub's documents) into the final PDF
          const mergeableAttachments = questionAttachments.filter(a => a.cloudStoragePath);

          let finalPdfBytes: Uint8Array;
          if (mergeableAttachments.length > 0) {
            try {
              const mergedPdf = await PDFDocument.create();

              // Copy generated RFI cover pages
              const rfiDoc = await PDFDocument.load(generatedPdfBytes);
              const rfiPages = await mergedPdf.copyPages(rfiDoc, rfiDoc.getPageIndices());
              rfiPages.forEach(page => mergedPdf.addPage(page));

              // Append each question attachment
              for (const att of mergeableAttachments) {
                try {
                  console.log('Downloading RFI attachment:', att.fileName, att.cloudStoragePath);
                  const attBuffer = await downloadFileBuffer(att.cloudStoragePath);
                  const fname = (att.fileName ?? '').toLowerCase();
                  const ftype = (att.fileType ?? '').toLowerCase();
                  const isPdf = fname.endsWith('.pdf') || ftype.includes('pdf');
                  const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|tiff?)$/i.test(fname) || ftype.startsWith('image/');

                  if (isPdf) {
                    const attDoc = await PDFDocument.load(attBuffer, { ignoreEncryption: true });
                    const attPages = await mergedPdf.copyPages(attDoc, attDoc.getPageIndices());
                    attPages.forEach(page => mergedPdf.addPage(page));
                    console.log(`Merged ${attPages.length} PDF pages from ${att.fileName}`);
                  } else if (isImage) {
                    // Embed image as a full page
                    let img;
                    if (fname.endsWith('.png') || ftype.includes('png')) {
                      img = await mergedPdf.embedPng(attBuffer);
                    } else {
                      img = await mergedPdf.embedJpg(attBuffer);
                    }
                    const { width, height } = img.scale(1);
                    // Fit to letter size (612x792) maintaining aspect ratio
                    const maxW = 572; const maxH = 752; // letter with 20pt margin
                    const scale = Math.min(maxW / width, maxH / height, 1);
                    const imgW = width * scale;
                    const imgH = height * scale;
                    const page = mergedPdf.addPage([612, 792]);
                    page.drawImage(img, {
                      x: (612 - imgW) / 2,
                      y: (792 - imgH) / 2,
                      width: imgW,
                      height: imgH,
                    });
                    console.log(`Embedded image ${att.fileName} as page`);
                  } else {
                    console.log(`Skipping non-PDF/image attachment: ${att.fileName} (${ftype})`);
                  }
                } catch (attErr: any) {
                  console.error(`Failed to merge attachment ${att.fileName}:`, attErr?.message);
                  // Skip this attachment, continue with others
                }
              }

              finalPdfBytes = await mergedPdf.save();
              console.log(`RFI PDF merged: ${rfiPages.length} RFI pages + ${mergeableAttachments.length} attachment(s)`);
            } catch (mergeErr: any) {
              console.error('Failed to merge attachments, returning RFI-only PDF:', mergeErr?.message);
              finalPdfBytes = generatedPdfBytes;
            }
          } else {
            finalPdfBytes = generatedPdfBytes;
          }

          const safeSubject = (rfi.subject ?? '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
          return new NextResponse(Buffer.from(finalPdfBytes), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="RFI_${esc(rfi.rfiNumber)}_${safeSubject}.pdf"`,
            },
          });
        }
        return NextResponse.json({ error: 'PDF generated but no data' }, { status: 500 });
      } else if (status === 'FAILED') {
        console.error('HTML2PDF failed:', JSON.stringify(result));
        return NextResponse.json({ error: result?.error ?? 'PDF generation failed' }, { status: 500 });
      }
      attempts++;
    }

    return NextResponse.json({ error: 'PDF generation timed out' }, { status: 500 });
  } catch (error: any) {
    console.error('RFI PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
