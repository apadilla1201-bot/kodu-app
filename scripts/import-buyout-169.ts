/**
 * Import Arena Madness buyout Excel into project 169.
 * Run: npx tsx -r dotenv/config scripts/import-buyout-169.ts dotenv_config_path=.env.local
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { parseBuyoutWorkbook } from '../lib/buyout-import';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { projectNumber: '169' } });
  if (!project) throw new Error('Project 169 not found');

  const filePath = resolve(
    process.cwd(),
    'data/imports/07032026 AP ArenaMadness_Budget_ContractTracking.xlsx'
  );
  const buffer = readFileSync(filePath);
  const rows = parseBuyoutWorkbook(buffer);
  console.log(`Parsed ${rows.length} rows`);

  await prisma.buyoutItem.deleteMany({ where: { projectId: project.id } });
  await prisma.buyoutItem.createMany({
    data: rows.map((r) => ({
      projectId: project.id,
      ...r,
    })),
  });

  const counts = await prisma.buyoutItem.groupBy({
    by: ['lineType'],
    where: { projectId: project.id },
    _count: true,
  });
  console.log('Imported to project 169:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
