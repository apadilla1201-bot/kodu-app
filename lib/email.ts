import { Resend } from 'resend';
import { appBaseUrl } from '@/lib/app-url';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveEmailAddress(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed && EMAIL_RE.test(trimmed)) return trimmed;
  }
  const fallback = process.env.EMAIL_DEFAULT_TO?.trim();
  return fallback && EMAIL_RE.test(fallback) ? fallback : null;
}

/** Collect unique valid emails from candidates (for To / CC lists). */
export function collectEmails(...candidates: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const c of candidates) {
    const trimmed = c?.trim().toLowerCase();
    if (trimmed && EMAIL_RE.test(trimmed) && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

function emailFrom(): string {
  const addr = process.env.EMAIL_FROM || 'rfi@kodupm.com';
  const name = process.env.EMAIL_FROM_NAME || 'Kodu PM';
  return `${name} <${addr}>`;
}

export async function sendEmail(opts: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; skipped?: boolean; id?: string; error?: string }> {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e));
  const uniqueTo = [...new Set(recipients)];
  const ccList = (Array.isArray(opts.cc) ? opts.cc : opts.cc ? [opts.cc] : [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e) && !uniqueTo.includes(e));
  const uniqueCc = [...new Set(ccList)];

  if (uniqueTo.length === 0) {
    console.warn('[email] No valid recipients for:', opts.subject);
    return { ok: false, error: 'no_recipients' };
  }

  if (!resend) {
    console.warn(
      '[email] RESEND_API_KEY not set — skipping:',
      opts.subject,
      '→',
      uniqueTo.join(', '),
      uniqueCc.length ? `cc:${uniqueCc.join(',')}` : ''
    );
    return { ok: false, skipped: true };
  }

  try {
    const result = await resend.emails.send({
      from: emailFrom(),
      to: uniqueTo,
      cc: uniqueCc.length ? uniqueCc : undefined,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    if (result.error) {
      console.error('[email] Resend error:', result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[email] send failed:', err);
    return { ok: false, error: err?.message ?? String(err) };
  }
}

function wrapEmail(headerBg: string, headerTitle: string, headerColor: string, body: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:${headerBg};padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="color:${headerColor};margin:0;font-size:18px;">${headerTitle}</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
        ${body}
        <p style="margin-top:16px;font-size:11px;color:#9ca3af;">The Project Delivery Group LLC · Kodu PM</p>
      </div>
    </div>
  `;
}

export async function sendRfiAssignedEmail(opts: {
  to: string | string[];
  cc?: string | string[];
  replyTo?: string;
  rfiNumber: string;
  projectName: string;
  projectNumber: string;
  subject: string;
  question: string;
  assignedTo: string;
  submittedBy: string;
  dueDate: Date;
  rfiId: string;
  priority?: string;
  ballInCourt?: string;
  superintendent?: string;
  requestingSub?: string;
  externalRespondUrl?: string;
}) {
  const link = `${appBaseUrl()}/dashboard/rfis/${opts.rfiId}`;
  const externalLink = opts.externalRespondUrl
    ? `<p style="margin-top:12px;"><a href="${opts.externalRespondUrl}" style="display:inline-block;background:#C9A96E;color:#0F1B33;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Respond Without Login</a></p>`
    : '';
  const html = wrapEmail(
    '#0F1B33',
    'New RFI Assigned',
    '#C9A96E',
    `
      <p><strong>RFI #:</strong> ${opts.rfiNumber}</p>
      <p><strong>Project:</strong> ${opts.projectName} (#${opts.projectNumber})</p>
      <p><strong>Subject:</strong> ${opts.subject}</p>
      <p><strong>Priority:</strong> ${opts.priority || 'Normal'}</p>
      <p><strong>Ball in Court:</strong> ${opts.ballInCourt || opts.assignedTo}</p>
      <p><strong>Assigned To (respond):</strong> ${opts.assignedTo}</p>
      <p><strong>PM / Submitted By:</strong> ${opts.submittedBy}</p>
      ${opts.superintendent ? `<p><strong>Superintendent (CC):</strong> ${opts.superintendent}</p>` : ''}
      ${opts.requestingSub ? `<p><strong>Requesting Subcontractor (CC):</strong> ${opts.requestingSub}</p>` : ''}
      <p><strong>Due Date:</strong> ${opts.dueDate.toLocaleDateString('en-US')}</p>
      <div style="background:white;padding:15px;border-radius:4px;border-left:4px solid #C9A96E;margin:12px 0;">
        <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;">Question</p>
        <p style="margin:4px 0 0 0;">${opts.question.substring(0, 800)}</p>
      </div>
      <p><a href="${link}" style="display:inline-block;background:#0F1B33;color:#C9A96E;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">View RFI in Kodu</a></p>
      ${externalLink}
    `,
  );
  return sendEmail({
    to: opts.to,
    cc: opts.cc,
    replyTo: opts.replyTo,
    subject: `RFI ${opts.rfiNumber} Assigned — ${opts.subject.substring(0, 60)}`,
    html,
  });
}

export async function sendRfiAnsweredEmail(opts: {
  to: string | string[];
  cc?: string | string[];
  rfiNumber: string;
  subject: string;
  responseText: string;
  responseBy: string;
  costImpact: string;
  scheduleImpact: string;
  rfiId: string;
}) {
  const link = `${appBaseUrl()}/dashboard/rfis/${opts.rfiId}`;
  const html = wrapEmail(
    '#2E7D32',
    'RFI Answered',
    '#fff',
    `
      <p><strong>RFI #:</strong> ${opts.rfiNumber}</p>
      <p><strong>Subject:</strong> ${opts.subject}</p>
      <p><strong>Responded By:</strong> ${opts.responseBy}</p>
      <div style="background:white;padding:15px;border-radius:4px;border-left:4px solid #2E7D32;margin:12px 0;">
        <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;">Response</p>
        <p style="margin:4px 0 0 0;">${opts.responseText.substring(0, 800)}</p>
      </div>
      <p><strong>Cost Impact:</strong> ${opts.costImpact}</p>
      <p><strong>Schedule Impact:</strong> ${opts.scheduleImpact}</p>
      <p><a href="${link}" style="display:inline-block;background:#2E7D32;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">View RFI in Kodu</a></p>
    `,
  );
  return sendEmail({
    to: opts.to,
    cc: opts.cc,
    subject: `RFI ${opts.rfiNumber} Answered — ${opts.subject.substring(0, 60)}`,
    html,
  });
}

export async function sendSubmittalEmail(opts: {
  to: string | string[];
  cc?: string | string[];
  replyTo?: string;
  event: 'submitted' | 'approved' | 'revise' | 'rejected' | 'under_review';
  submittalNumber: string;
  title: string;
  projectName: string;
  projectNumber: string;
  subcontractor?: string | null;
  submittedBy?: string | null;
  reviewedBy?: string | null;
  assignedTo?: string | null;
  ballInCourt?: string | null;
  submittalId: string;
}) {
  const titles: Record<typeof opts.event, { bg: string; label: string; color: string }> = {
    submitted: { bg: '#0F1B33', label: 'Submittal Submitted', color: '#C9A96E' },
    under_review: { bg: '#B45309', label: 'Submittal Under Review', color: '#fff' },
    approved: { bg: '#2E7D32', label: 'Submittal Approved', color: '#fff' },
    revise: { bg: '#C2410C', label: 'Submittal — Revise & Resubmit', color: '#fff' },
    rejected: { bg: '#B91C1C', label: 'Submittal Rejected', color: '#fff' },
  };
  const t = titles[opts.event];
  const link = `${appBaseUrl()}/dashboard/submittals/${opts.submittalId}`;
  const html = wrapEmail(
    t.bg,
    t.label,
    t.color,
    `
      <p><strong>Submittal #:</strong> ${opts.submittalNumber}</p>
      <p><strong>Project:</strong> ${opts.projectName} (#${opts.projectNumber})</p>
      <p><strong>Title:</strong> ${opts.title}</p>
      ${opts.ballInCourt ? `<p><strong>Ball in Court:</strong> ${opts.ballInCourt}</p>` : ''}
      ${opts.assignedTo ? `<p><strong>Assigned To:</strong> ${opts.assignedTo}</p>` : ''}
      ${opts.subcontractor ? `<p><strong>Subcontractor:</strong> ${opts.subcontractor}</p>` : ''}
      ${opts.submittedBy ? `<p><strong>Submitted By:</strong> ${opts.submittedBy}</p>` : ''}
      ${opts.reviewedBy ? `<p><strong>Reviewed By:</strong> ${opts.reviewedBy}</p>` : ''}
      <p><a href="${link}" style="display:inline-block;background:${t.bg};color:${t.color};padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid ${t.color};">View Submittal in Kodu</a></p>
    `,
  );
  return sendEmail({
    to: opts.to,
    cc: opts.cc,
    replyTo: opts.replyTo,
    subject: `${opts.submittalNumber} — ${t.label}`,
    html,
  });
}
