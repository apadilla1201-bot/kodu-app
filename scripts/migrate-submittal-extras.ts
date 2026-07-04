/**
 * Submittal email/ball-in-court columns + RFI externalToken.
 * Run: npx tsx -r dotenv/config scripts/migrate-submittal-extras.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const statements = [
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "submittedByEmail" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "assignedTo" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "assignedToRole" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "assignedToEmail" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "reviewerEmail" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "subcontractorEmail" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "superintendentName" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "superintendentEmail" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "ballInCourt" TEXT',
    'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "ballInCourtRole" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "externalToken" TEXT',
    'CREATE UNIQUE INDEX IF NOT EXISTS "RFI_externalToken_key" ON "RFI"("externalToken")',
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('OK: Submittal email/ball-in-court and RFI externalToken columns are ready.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
