/**
 * Seed Project Directory contacts from RFIs, Pay Apps, Submittals, and project fields.
 * Run: npx tsx -r dotenv/config scripts/seed-project-directory.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

type ContactSeed = { name: string; email: string; role: string; company?: string };

function addContact(map: Map<string, ContactSeed>, c: ContactSeed) {
  const email = c.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const key = `${email}|${c.role}`;
  if (!map.has(key)) map.set(key, { ...c, email, name: c.name.trim() || email });
}

async function seedProject(projectId: string, projectNumber: string) {
  const contacts = new Map<string, ContactSeed>();

  const rfis = await p.rFI.findMany({ where: { projectId } });
  for (const r of rfis) {
    addContact(contacts, { name: r.submittedBy, email: (r as any).submittedByEmail || '', role: r.submittedByRole || 'Project Manager' });
    addContact(contacts, { name: r.assignedTo, email: (r as any).assignedToEmail || '', role: r.assignedToRole || 'Architect' });
    addContact(contacts, { name: (r as any).superintendentName || '', email: (r as any).superintendentEmail || '', role: 'Superintendent' });
    addContact(contacts, { name: (r as any).requestingSubName || '', email: (r as any).requestingSubEmail || '', role: 'Subcontractor' });
  }

  const submittals = await p.submittal.findMany({ where: { projectId } });
  for (const s of submittals) {
    const sub = s as typeof s & {
      submittedByEmail?: string | null;
      assignedTo?: string | null;
      assignedToEmail?: string | null;
      assignedToRole?: string | null;
      reviewerEmail?: string | null;
      subcontractorEmail?: string | null;
      superintendentEmail?: string | null;
      superintendentName?: string | null;
    };
    addContact(contacts, { name: s.submittedBy || '', email: sub.submittedByEmail || '', role: 'Project Manager' });
    addContact(contacts, { name: sub.assignedTo || '', email: sub.assignedToEmail || '', role: sub.assignedToRole || 'Architect' });
    addContact(contacts, { name: s.subcontractor || '', email: sub.subcontractorEmail || '', role: 'Subcontractor', company: s.subcontractor || undefined });
    addContact(contacts, { name: sub.superintendentName || '', email: sub.superintendentEmail || '', role: 'Superintendent' });
    addContact(contacts, { name: 'Reviewer', email: sub.reviewerEmail || '', role: 'Architect' });
  }

  const payApps = await p.payApplication.findMany({
    where: { projectId },
    include: { lineItems: true },
  });
  for (const pa of payApps) {
    for (const li of pa.lineItems) {
      if (li.subVendor?.trim()) {
        addContact(contacts, {
          name: li.subVendor.trim(),
          email: '',
          role: 'Subcontractor',
          company: li.subVendor.trim(),
        });
      }
    }
  }

  let created = 0;
  let skipped = 0;
  for (const c of contacts.values()) {
    if (!c.email) { skipped++; continue; }
    const exists = await p.projectContact.findFirst({
      where: { projectId, email: c.email, role: c.role },
    });
    if (exists) { skipped++; continue; }
    await p.projectContact.create({
      data: {
        projectId,
        name: c.name,
        email: c.email,
        role: c.role,
        company: c.company ?? null,
      },
    });
    created++;
  }

  console.log(`  #${projectNumber}: ${created} created, ${skipped} skipped (${contacts.size} unique)`);
  return created;
}

async function main() {
  const projects = await p.project.findMany({ orderBy: { projectNumber: 'asc' } });
  let total = 0;
  for (const proj of projects) {
    total += await seedProject(proj.id, proj.projectNumber);
  }
  console.log(`OK: ${total} contacts seeded across ${projects.length} projects`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
