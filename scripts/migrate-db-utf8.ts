import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
});

async function main() {
  await client.connect();
  console.log('Connected to maintenance database "postgres"...');

  // Terminate any existing connections to pos_db
  await client.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'pos_db'
      AND pid <> pg_backend_pid();
  `);

  console.log('Dropping non-UTF8 pos_db...');
  await client.query(`DROP DATABASE IF EXISTS pos_db;`);

  console.log('Creating UTF-8 pos_db with LC_COLLATE = "C"...');
  await client.query(
    `CREATE DATABASE pos_db WITH ENCODING 'UTF8' LC_COLLATE = 'C' LC_CTYPE = 'C' TEMPLATE template0;`,
  );

  const res = await client.query(
    `SELECT datname, pg_encoding_to_char(encoding) as enc, datcollate, datctype FROM pg_database WHERE datname='pos_db';`,
  );
  console.log('pos_db verification:', res.rows);

  await client.end();
  console.log('Migration to UTF-8 pos_db complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
