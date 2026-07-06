/**
 * SitePhoto table for jobsite photo gallery.
 * Run: npx tsx -r dotenv/config scripts/migrate-site-photos.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SitePhoto" (
      "id" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "cloudStoragePath" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "fileType" TEXT,
      "caption" TEXT,
      "area" TEXT,
      "trade" TEXT,
      "tag" TEXT NOT NULL DEFAULT 'progress',
      "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "uploadedBy" TEXT,
      "uploadedByEmail" TEXT,
      "latitude" DOUBLE PRECISION,
      "longitude" DOUBLE PRECISION,
      "dailyLogId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SitePhoto_pkey" PRIMARY KEY ("id")
    );
  `);

  const statements = [
    'CREATE INDEX IF NOT EXISTS "SitePhoto_projectId_idx" ON "SitePhoto"("projectId")',
    'CREATE INDEX IF NOT EXISTS "SitePhoto_takenAt_idx" ON "SitePhoto"("takenAt")',
    'CREATE INDEX IF NOT EXISTS "SitePhoto_tag_idx" ON "SitePhoto"("tag")',
    'CREATE INDEX IF NOT EXISTS "SitePhoto_dailyLogId_idx" ON "SitePhoto"("dailyLogId")',
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('OK: SitePhoto table is ready.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
