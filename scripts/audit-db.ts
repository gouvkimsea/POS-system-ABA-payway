import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('=== Database Audit Inspection ===');
  try {
    // 1. Check _prisma_migrations table
    try {
      const migrations: any = await prisma.$queryRawUnsafe(
        `SELECT id, checksum, migration_name, finished_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at ASC`,
      );
      console.log('Prisma Migrations Applied in DB:', migrations);
    } catch (e: any) {
      console.log('No _prisma_migrations table or query failed:', e.message);
    }

    // 2. Check total tables
    const tables: any = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(
      `Total Public Tables (${tables.length}):`,
      tables.map((t: any) => t.table_name).join(', '),
    );

    // 3. Check all indexes in public schema
    const indexes: any = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.log(`\nTotal Indexes defined: ${indexes.length}`);
    const indexesByTable = indexes.reduce((acc: any, idx: any) => {
      acc[idx.tablename] = acc[idx.tablename] || [];
      acc[idx.tablename].push(idx.indexname);
      return acc;
    }, {});
    console.log('Indexes per Table:', indexesByTable);

    // 4. Check foreign keys
    const fks: any = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);
    console.log(`\nTotal Foreign Key constraints: ${fks.length}`);
  } catch (err: any) {
    console.error('Audit DB error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
