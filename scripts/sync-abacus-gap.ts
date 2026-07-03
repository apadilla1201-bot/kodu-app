/**
 * One-time sync: fill gaps between Abacus UI and Kodu DB (same Supabase).
 * Run: npx tsx -r dotenv/config scripts/sync-abacus-gap.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GC_ADDRESS = '7255 NE 4th Ave, Suite 110-2, Miami, FL 33138';

const RFIS_176 = [
  { sequence: 2, subject: 'A/C closet and Trims' },
  { sequence: 3, subject: 'Closet and a door' },
  { sequence: 4, subject: 'A/C Closet' },
  { sequence: 5, subject: 'Elevation' },
  { sequence: 6, subject: 'AC linera difuser' },
];

async function updateCompany() {
  const updated = await prisma.company.updateMany({
    data: {
      name: 'The Project Delivery Group LLC',
      address: GC_ADDRESS,
    },
  });
  console.log('Company records updated:', updated.count);
}

async function seedRfis176(projectId: string) {
  const template = await prisma.rFI.findFirst({ where: { projectId, rfiNumber: '176-001' } });
  if (!template) throw new Error('176-001 not found');

  for (const row of RFIS_176) {
    const rfiNumber = `176-${String(row.sequence).padStart(3, '0')}`;
    const exists = await prisma.rFI.findFirst({ where: { projectId, rfiNumber } });
    if (exists) {
      console.log('RFI exists, skip:', rfiNumber);
      continue;
    }

    const dateSubmitted = new Date();
    dateSubmitted.setDate(dateSubmitted.getDate() - (7 - row.sequence));

    await prisma.rFI.create({
      data: {
        projectId,
        rfiNumber,
        sequence: row.sequence,
        subject: row.subject,
        question: `RFI regarding ${row.subject}. Migrated from Abacus — please review and add full question text.`,
        discipline: template.discipline,
        priority: 'Normal',
        status: 'Open',
        submittedBy: template.submittedBy,
        submittedByRole: template.submittedByRole,
        assignedTo: template.assignedTo,
        assignedToRole: template.assignedToRole,
        dateSubmitted,
        daysToRespond: 7,
        dateDue: new Date(dateSubmitted.getTime() + 7 * 86400000),
        costImpact: 'TBD',
        scheduleImpact: 'TBD',
      },
    });
    console.log('Created RFI:', rfiNumber, row.subject);
  }
}

async function clonePayApp176Pa2(projectId: string) {
  const exists = await prisma.payApplication.findFirst({
    where: { projectId, applicationNumber: 2 },
  });
  if (exists) {
    console.log('PA#2 already exists:', exists.id);
    return;
  }

  const pa1 = await prisma.payApplication.findFirst({
    where: { projectId, applicationNumber: 1 },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!pa1) throw new Error('PA#1 not found for project 176');

  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    lineItems,
    ...header
  } = pa1;

  const pa2 = await prisma.payApplication.create({
    data: {
      ...header,
      projectId,
      applicationNumber: 2,
      applicationDate: new Date('2026-07-02'),
      periodFrom: new Date('2026-06-01'),
      periodTo: new Date('2026-06-30'),
      status: 'Submitted',
      retainagePercent: 0.013,
      originalContractSum: 3145952.34,
      g702NetChange: 0,
      g702ContractSumToDate: 3145952.34,
      g702TotalCompleted: 1375643.52,
      g702Retainage: 18193.58,
      g702TotalEarned: 1357449.94,
      previousCertificates: 1253070.85,
      advancePayments: 2326.77,
      advancePaymentsLabel: 'Received by PDG until invoice 176-10 from 04/31/2026',
      g702CurrentPaymentDue: 102052.32,
      g702BalanceToFinish: 1788502.4,
      ownerName: 'Mr. Jeff Slovin',
      ownerAddress: '1234 Brickell Avenue',
      ownerCity: 'Miami, FL 33131',
      architectName: 'Ritz-Carlton PH2201 — Slovin Residence',
      architectAddress: '420 Lincoln Road, Suite 600',
      architectCity: 'Miami Beach, FL 33139',
      contractDate: new Date('2026-04-24'),
      contractFor: 'Ritz-Carlton Residences, Penthouse 2201, Coconut Grove',
      contractForm: 'Cost Plus — AIA A103',
      contractorPrinted: 'Augusto Padilla. Project Manager',
      lineItems: {
        create: lineItems.map((li, i) => ({
          sortOrder: li.sortOrder ?? i + 1,
          itemNumber: li.itemNumber,
          sectionCode: li.sectionCode,
          sectionTitle: li.sectionTitle,
          description: li.description,
          subVendor: li.subVendor,
          scheduledValue: li.scheduledValue,
          budgetRealloc: li.budgetRealloc,
          previousChanges: li.previousChanges,
          currentChanges: li.currentChanges,
          previousCompleted: li.previousCompleted + li.thisCompleted,
          thisCompleted: 0,
          retainage: 0,
          isSection: li.isSection,
          isBelowLine: li.isBelowLine,
          isFee: li.isFee,
        })),
      },
    },
    include: { _count: { select: { lineItems: true } } },
  });

  console.log('Created PA#2:', pa2.id, 'line items:', (pa2 as any)._count?.lineItems);
}

/** Abacus PA#2 G703 — prev / this period / retainage by line sortOrder */
const ABACUS_PA2_G703: Record<number, { prev: number; this: number; ret: number }> = {
  2: { prev: 86424.4, this: 43212.2, ret: 0 },
  4: { prev: 700, this: 0, ret: 0 },
  6: { prev: 55000, this: 0, ret: 0 },
  8: { prev: 18600, this: 0, ret: 0 },
  14: { prev: 13500, this: 8500, ret: 2200 },
  15: { prev: 0, this: 5000, ret: 500 },
  27: { prev: 400000, this: 0, ret: 0 },
  28: { prev: 40000, this: 0, ret: 0 },
  40: { prev: 223500, this: 0, ret: 11175 },
  44: { prev: 0, this: 6600, ret: 660 },
  49: { prev: 42305.93, this: 0, ret: 0 },
  61: { prev: 68667.1, this: 0, ret: 0 },
  64: { prev: 0, this: 29235.83, ret: 2923.58 },
  76: { prev: 48610.1, this: 0, ret: 0 },
  79: { prev: 0, this: 7350, ret: 735 },
  85: { prev: 24546.68, this: 0, ret: 0 },
  120: { prev: 36016.2, this: 0, ret: 0 },
  126: { prev: 91909.65, this: 7991.84, ret: 0 },
  128: { prev: 24815.6, this: 2157.8, ret: 0 },
};

async function fixPa2G703176(projectId: string) {
  const pa1 = await prisma.payApplication.findFirst({
    where: { projectId, applicationNumber: 1 },
    include: { lineItems: true },
  });
  const pa2 = await prisma.payApplication.findFirst({
    where: { projectId, applicationNumber: 2 },
    include: { lineItems: true },
  });
  if (!pa1 || !pa2) {
    console.log('PA#1 or PA#2 missing — skip G703 fix');
    return;
  }

  const pa1BySort = new Map(pa1.lineItems.map((l) => [l.sortOrder, l]));
  let updated = 0;

  for (const li of pa2.lineItems) {
    if (li.isSection) continue;
    const abacus = ABACUS_PA2_G703[li.sortOrder];
    const pa1li = pa1BySort.get(li.sortOrder);
    const prev = abacus?.prev ?? ((pa1li?.previousCompleted ?? 0) + (pa1li?.thisCompleted ?? 0));
    const thisPeriod = abacus?.this ?? 0;
    const ret = abacus?.ret ?? 0;

    if (
      li.previousCompleted === prev &&
      li.thisCompleted === thisPeriod &&
      li.retainage === ret
    ) continue;

    await prisma.payAppLineItem.update({
      where: { id: li.id },
      data: { previousCompleted: prev, thisCompleted: thisPeriod, retainage: ret },
    });
    updated++;
  }

  const totals = { prev: 0, this: 0, ret: 0 };
  for (const li of pa2.lineItems) {
    if (li.isSection) continue;
    const abacus = ABACUS_PA2_G703[li.sortOrder];
    const pa1li = pa1BySort.get(li.sortOrder);
    totals.prev += abacus?.prev ?? ((pa1li?.previousCompleted ?? 0) + (pa1li?.thisCompleted ?? 0));
    totals.this += abacus?.this ?? 0;
    totals.ret += abacus?.ret ?? 0;
  }

  console.log(`Fixed PA#2 G703: ${updated} lines updated`);
  console.log('PA#2 line totals — prev:', totals.prev.toFixed(2), 'this:', totals.this.toFixed(2), 'retainage:', totals.ret.toFixed(2));
}

async function seedSubmittal169() {
  const p169 = await prisma.project.findFirst({ where: { projectNumber: '169' } });
  if (!p169) return;

  const exists = await prisma.submittal.findFirst({
    where: { projectId: p169.id, submittalNumber: '169-SUB-001' },
  });
  if (exists) {
    console.log('Submittal 169-SUB-001 exists');
    return;
  }

  await prisma.submittal.create({
    data: {
      projectId: p169.id,
      submittalNumber: '169-SUB-001',
      sequence: 1,
      title: 'Technical submittal for a custom hybrid sauna and cold plunge',
      description: 'Migrated from Abacus — WellnessPro Services & Solutions',
      submittalType: 'Shop Drawing',
      subcontractor: 'WellnessPro Services & Solutions',
      priority: 'High',
      status: 'Submitted',
      requiredDate: new Date('2026-07-05'),
      submittedBy: 'Augusto Padilla',
      submittedDate: new Date(),
    },
  });
  console.log('Created submittal 169-SUB-001');
}

async function main() {
  console.log('=== Sync Abacus gaps ===\n');

  await updateCompany();

  const p176 = await prisma.project.findFirst({ where: { projectNumber: '176' } });
  if (!p176) throw new Error('Project 176 not found');

  await seedRfis176(p176.id);
  await clonePayApp176Pa2(p176.id);
  await fixPa2G703176(p176.id);
  await seedSubmittal169();

  const counts176 = await prisma.project.findUnique({
    where: { id: p176.id },
    include: { _count: { select: { changeOrders: true, rfis: true, payApplications: true } } },
  });
  console.log('\nProject 176 after sync:', counts176?._count);

  const p169 = await prisma.project.findFirst({ where: { projectNumber: '169' } });
  const counts169 = await prisma.project.findUnique({
    where: { id: p169!.id },
    include: { _count: { select: { changeOrders: true, payApplications: true } } },
  });
  console.log('Project 169 (unchanged — COR gaps need Abacus export):', counts169?._count);
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
