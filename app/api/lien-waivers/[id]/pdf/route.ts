export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { getPdfBrand } from '@/lib/company-brand';
import { appBaseUrl } from '@/lib/app-url';
import { htmlToPdf } from '@/lib/pdf';

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TITLES: Record<string, string> = {
  conditional_progress: 'CONDITIONAL WAIVER AND RELEASE OF LIEN UPON PROGRESS PAYMENT',
  unconditional_progress: 'UNCONDITIONAL WAIVER AND RELEASE OF LIEN UPON PROGRESS PAYMENT',
  conditional_final: 'CONDITIONAL WAIVER AND RELEASE OF LIEN UPON FINAL PAYMENT',
  unconditional_final: 'UNCONDITIONAL WAIVER AND RELEASE OF LIEN UPON FINAL PAYMENT',
};

function bodyText(type: string, amount: string, through: string): string {
  if (type === 'conditional_progress') {
    return `Upon receipt by the undersigned of a check in the sum of <b>${amount}</b> payable to the undersigned, and when the check has been properly endorsed and paid by the bank on which it is drawn, this document becomes effective to release any mechanic's lien, any state or federal statutory bond right, any private bond right, any claim for payment and any rights under any similar ordinance, rule or statute related to claim or payment rights that the undersigned has on the job of the Owner to the following extent: labor, services, equipment or materials furnished to the Project through <b>${through}</b> only. This release covers a progress payment for all labor, services, equipment or materials furnished to the Project through the date stated, and does not cover any retention, pending modifications and changes, or items furnished after that date. Before any recipient of this document relies on it, that person should verify evidence of payment to the undersigned.`;
  }
  if (type === 'unconditional_progress') {
    return `The undersigned has been paid and has received a progress payment in the sum of <b>${amount}</b> for all labor, services, equipment or materials furnished to the Project through <b>${through}</b>, and hereby releases any mechanic's lien, any state or federal statutory bond right, any private bond right, any claim for payment and any rights under any similar ordinance, rule or statute related to claim or payment rights that the undersigned has on the job of the Owner to the extent of the payment received. This release covers a progress payment for all labor, services, equipment or materials furnished to the Project through the date stated, and does not cover any retention, pending modifications and changes, or items furnished after that date.`;
  }
  if (type === 'conditional_final') {
    return `Upon receipt by the undersigned of a check in the sum of <b>${amount}</b> payable to the undersigned, and when the check has been properly endorsed and paid by the bank on which it is drawn, this document becomes effective to release any mechanic's lien, any state or federal statutory bond right, any private bond right, any claim for payment and any rights under any similar ordinance, rule or statute related to claim or payment rights that the undersigned has on the job of the Owner. This release covers the final payment to the undersigned for all labor, services, equipment or materials furnished on the Project, except for disputed claims for extra work in the amount of $0.00 (none unless otherwise noted). Before any recipient of this document relies on it, that person should verify evidence of payment to the undersigned.`;
  }
  return `The undersigned has been paid in full for all labor, services, equipment or materials furnished to the Project, and hereby releases any mechanic's lien, any state or federal statutory bond right, any private bond right, any claim for payment and any rights under any similar ordinance, rule or statute related to claim or payment rights that the undersigned has on the job of the Owner. This release covers the final payment to the undersigned for all labor, services, equipment or materials furnished on the Project. The undersigned warrants that all persons or entities that furnished labor, services, equipment or materials through the undersigned have been paid in full.`;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const waiver = await prisma.lienWaiver.findFirst({
      where: { id: params.id, project: { companyId } },
      include: {
        project: { select: { projectNumber: true, projectName: true, client: true, location: true } },
        payApplication: { select: { applicationNumber: true, periodTo: true } },
      },
    });
    if (!waiver) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const brand = await getPdfBrand(companyId, appBaseUrl(), 38);
    const title = TITLES[waiver.waiverType] ?? TITLES.conditional_progress;
    const through = waiver.throughDate
      ? new Date(waiver.throughDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '_______________';
    const amount = waiver.amount > 0 ? money(waiver.amount) : '$_______________';
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; font-size: 11.5pt; line-height: 1.55; margin: 0; }
  .brand { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0F1B33; padding-bottom: 12px; margin-bottom: 22px; }
  .brand-info { font-family: Arial, sans-serif; font-size: 8.5pt; color: #444; text-align: right; line-height: 1.5; }
  h1 { font-family: Arial, sans-serif; font-size: 13pt; text-align: center; letter-spacing: 0.4px; margin: 18px 0 4px; color: #0F1B33; }
  .subtitle { font-family: Arial, sans-serif; text-align: center; font-size: 9pt; color: #666; margin-bottom: 22px; }
  table.fields { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 9.5pt; }
  table.fields td { border: 1px solid #bbb; padding: 7px 10px; vertical-align: top; }
  table.fields td.lbl { width: 30%; background: #f2f0ea; font-weight: bold; color: #0F1B33; }
  .legal { text-align: justify; margin: 0 0 18px; }
  .warn { font-family: Arial, sans-serif; font-size: 8.5pt; background: #fdf6e5; border: 1px solid #C9A96E; padding: 9px 12px; border-radius: 4px; margin-bottom: 26px; }
  .sig { margin-top: 46px; width: 100%; }
  .sig td { width: 50%; padding: 0 18px; vertical-align: bottom; font-family: Arial, sans-serif; font-size: 9.5pt; }
  .sig .line { border-top: 1.5px solid #1a1a1a; padding-top: 5px; margin-top: 42px; }
  .foot { font-family: Arial, sans-serif; font-size: 7.5pt; color: #999; text-align: center; margin-top: 34px; border-top: 1px solid #ddd; padding-top: 8px; }
</style></head><body>
  <div class="brand">
    <div>${brand.logoHtml}</div>
    <div class="brand-info">
      <b>${esc(brand.name)}</b>${brand.license ? `<br/>License: ${esc(brand.license)}` : ''}${brand.addressHtml ? `<br/>${brand.addressHtml}` : ''}${brand.phone ? `<br/>${esc(brand.phone)}` : ''}
    </div>
  </div>

  <h1>${title}</h1>
  <p class="subtitle">Project No. ${esc(waiver.project.projectNumber)} — ${esc(waiver.project.projectName)}</p>

  <table class="fields">
    <tr><td class="lbl">Project</td><td>${esc(waiver.project.projectName)} (No. ${esc(waiver.project.projectNumber)})${waiver.project.location ? `<br/>${esc(waiver.project.location)}` : ''}</td></tr>
    <tr><td class="lbl">Owner</td><td>${esc(waiver.project.client)}</td></tr>
    <tr><td class="lbl">General Contractor</td><td>${esc(brand.name)}</td></tr>
    <tr><td class="lbl">Subcontractor / Vendor (the undersigned)</td><td><b>${esc(waiver.subcontractor)}</b></td></tr>
    <tr><td class="lbl">Payment Amount</td><td><b>${amount}</b></td></tr>
    <tr><td class="lbl">Through Date (labor/materials furnished through)</td><td>${through}</td></tr>
    ${waiver.payApplication ? `<tr><td class="lbl">Related Pay Application</td><td>Application No. ${waiver.payApplication.applicationNumber}</td></tr>` : ''}
  </table>

  <p class="legal">${bodyText(waiver.waiverType, amount, through)}</p>

  <div class="warn"><b>NOTICE:</b> This document waives rights unconditionally or conditionally as stated above and is enforceable against the signatory to the extent of its terms. Do not sign a blank or incomplete form. Consult your attorney if you have questions about this document.</div>

  <table class="sig"><tr>
    <td>
      <div style="font-weight:bold;">${esc(waiver.subcontractor)}</div>
      <div>Subcontractor / Vendor</div>
      <div class="line">Signature — Authorized Representative</div>
      <div class="line">Printed Name and Title</div>
      <div class="line">Date</div>
    </td>
    <td>
      <div style="font-weight:bold;">${esc(brand.name)}</div>
      <div>General Contractor — Received by</div>
      <div class="line">Signature</div>
      <div class="line">Printed Name and Title</div>
      <div class="line">Date</div>
    </td>
  </tr></table>

  <div class="foot">Generated by ${esc(brand.name)} via koduPM on ${today} · Standard waiver form — verify requirements of your state and contract with legal counsel.</div>
</body></html>`;

    const pdf = await htmlToPdf(html, { format: 'Letter' });
    const fname = `LienWaiver_${waiver.project.projectNumber}_${waiver.subcontractor.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/lien-waivers/[id]/pdf error:', error);
    return NextResponse.json({ error: 'Failed to generate waiver PDF' }, { status: 500 });
  }
}
