/**
 * Add User.locale for EN/ES i18n.
 * Run: npx tsx -r dotenv/config scripts/migrate-user-locale.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
  `);
  console.log('OK: User.locale column added (or already exists).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
