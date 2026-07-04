/**
 * Ensures ProjectContact table and RFI email/ball-in-court columns exist.
 * Run: npx tsx -r dotenv/config scripts/migrate-rfi-directory.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProjectContact" (
      "id" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "company" TEXT,
      "phone" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
    );
  `);

  const statements = [
    'CREATE INDEX IF NOT EXISTS "ProjectContact_projectId_idx" ON "ProjectContact"("projectId")',
    'CREATE INDEX IF NOT EXISTS "ProjectContact_role_idx" ON "ProjectContact"("role")',
    'CREATE INDEX IF NOT EXISTS "ProjectContact_email_idx" ON "ProjectContact"("email")',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "submittedByEmail" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "assignedToEmail" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "superintendentName" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "superintendentEmail" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "requestingSubName" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "requestingSubEmail" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "ballInCourt" TEXT',
    'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "ballInCourtRole" TEXT',
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('OK: ProjectContact table and RFI email columns are ready.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
