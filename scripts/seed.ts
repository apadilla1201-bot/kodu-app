import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test user
  const hashedPassword = await bcrypt.hash('johndoe123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'Augusto Padilla',
      password: hashedPassword,
      role: 'admin',
    },
  });
  console.log('User created:', user.email);

  // Create sample project
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-169' },
    update: {},
    create: {
      id: 'seed-project-169',
      projectNumber: '169',
      projectName: 'Arena Madness Sports',
      client: 'Arena Madness LLC',
      location: '1089 NW 20th ST, Miami FL 33127',
      contractAmount: 2500000,
      startDate: new Date('2025-06-01'),
      userId: user.id,
    },
  });
  console.log('Project created:', project.projectName);

  // Create sample CORs
  const corsData = [
    { seq: 21, desc: 'Furnish and Installation of Chase wall', sub: 'Florida Demo', amount: 9460, csi: '', date: '2026-01-26' },
    { seq: 52, desc: 'FOR LEVELING SOCCER COURT', sub: 'J. Socarras Concrete & Civil', amount: 4407.50, csi: '', date: '2026-03-04' },
    { seq: 59, desc: 'T & M. Electrical Conduit', sub: 'Sparky Electric Inc.', amount: 3223.54, csi: '', date: '2026-03-04' },
    { seq: 80, desc: 'HM Exterior Doors - Supply', sub: 'F.P.G. Home Design Center', amount: 6209.73, csi: '08 11 00', date: '2026-04-24' },
    { seq: 81, desc: 'General Conditions April to June 2026', sub: 'PDG Internal', amount: 91942.41, csi: '', date: '2026-05-06' },
    { seq: 87, desc: '2 commercial gates — parking exit & field divider', sub: 'Jimenez Global Services Corp.', amount: 1520, csi: '32 31 00', date: '2026-05-26' },
    { seq: 88, desc: 'Elevator landing — concrete cut & chip-hammer 3" depth', sub: 'J. Socarras Concrete & Civil', amount: 1200, csi: '03 30 00', date: '2026-05-26' },
  ];

  for (const corData of corsData) {
    const corNumber = `169-${String(corData.seq).padStart(3, '0')}`;
    const salesTax = corData.amount * 0.07;
    const supplierTotal = corData.amount + salesTax;
    const op = supplierTotal * 0.06;
    const gl = supplierTotal * 0.015;
    const total = supplierTotal + op + gl;

    const existing = await prisma.changeOrder.findFirst({
      where: { corNumber, projectId: project.id },
    });

    if (!existing) {
      await prisma.changeOrder.create({
        data: {
          projectId: project.id,
          corNumber,
          sequence: corData.seq,
          date: new Date(corData.date),
          description: corData.desc,
          subcontractor: corData.sub,
          status: corData.seq <= 59 ? 'Approved' : 'Pending',
          approvalDate: corData.seq <= 59 ? new Date() : null,
          csiCode: corData.csi || null,
          subtotal: corData.amount,
          overheadProfit: op,
          generalLiability: gl,
          salesTax: salesTax,
          totalAmount: total,
          lineItems: {
            create: [{
              description: corData.desc,
              quantity: 1,
              unit: 'LS',
              unitPrice: corData.amount,
              total: corData.amount,
              isMaterial: true,
            }],
          },
        },
      });
      console.log('COR created:', corNumber);
    } else {
      console.log('COR already exists:', corNumber);
    }
  }

  // Create Ritz project #176
  const ritzProject = await prisma.project.upsert({
    where: { id: 'seed-project-176' },
    update: {},
    create: {
      id: 'seed-project-176',
      projectNumber: '176',
      projectName: 'RITZ PH at Coconut Grove',
      client: 'Mr Jeff Slovin',
      location: 'Coconut Grove, Miami FL',
      contractAmount: 0,
      startDate: new Date('2026-06-01'),
      userId: user.id,
    },
  });
  console.log('Project created:', ritzProject.projectName);

  // Note: Ritz PA#1 (Pay Application #1) with 130 line items was migrated to
  // Augusto's account (apadilla1201@gmail.com) project cmq1nbvpm0001mm08t1m32ygr.
  // The duplicate john@doe.com Ritz project was removed.

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
