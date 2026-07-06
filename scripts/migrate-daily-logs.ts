/**
 * DailyLog table + SitePhoto.dailyLogId FK.
 * Run: npx tsx -r dotenv/config scripts/migrate-daily-logs.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyLog" (
      "id" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "logDate" TIMESTAMP(3) NOT NULL,
      "authorName" TEXT NOT NULL,
      "authorEmail" TEXT,
      "weather" TEXT,
      "temperature" TEXT,
      "workPerformed" TEXT,
      "crewNotes" TEXT,
      "deliveries" TEXT,
      "delays" TEXT,
      "status" TEXT NOT NULL DEFAULT 'Draft',
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
    );
  `);

  const statements = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "DailyLog_projectId_logDate_key" ON "DailyLog"("projectId", "logDate")',
    'CREATE INDEX IF NOT EXISTS "DailyLog_projectId_idx" ON "DailyLog"("projectId")',
    'CREATE INDEX IF NOT EXISTS "DailyLog_logDate_idx" ON "DailyLog"("logDate")',
    'CREATE INDEX IF NOT EXISTS "DailyLog_status_idx" ON "DailyLog"("status")',
    `DO $$ BEGIN
      ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_dailyLogId_fkey"
        FOREIGN KEY ("dailyLogId") REFERENCES "DailyLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('OK: DailyLog table and SitePhoto link are ready.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
