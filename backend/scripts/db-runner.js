import EmbeddedPostgres from 'embedded-postgres';
import net from 'net';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const DB_NAME = process.env.POSTGRES_DB || 'pos_db';
const USER = process.env.POSTGRES_USER || 'postgres';
const PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
const DB_DIR = path.resolve(__dirname, '../../data/postgres');

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function startDb() {
  const isRunning = await isPortOpen(PORT);
  if (isRunning) {
    console.log(`[Database] PostgreSQL is already active on port ${PORT}.`);
    return;
  }

  console.log(`[Database] Starting Embedded PostgreSQL on port ${PORT}...`);
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const pg = new EmbeddedPostgres({
    port: PORT,
    databaseDir: DB_DIR,
    user: USER,
    password: PASSWORD,
    persistent: true,
  });

  try {
    if (!fs.existsSync(path.join(DB_DIR, 'PG_VERSION'))) {
      console.log('[Database] Initializing new PostgreSQL cluster...');
      await pg.initialise();
    }
    await pg.start();
    console.log(`[Database] PostgreSQL started successfully on port ${PORT}.`);

    try {
      await pg.createDatabase(DB_NAME);
      console.log(`[Database] Created database "${DB_NAME}".`);
    } catch (err) {
      // Database might already exist, ignore error
    }
  } catch (error) {
    console.error('[Database] Error starting PostgreSQL:', error);
    process.exit(1);
  }
}

const command = process.argv[2] || 'start';

if (command === 'start') {
  startDb().catch(console.error);
} else if (command === 'status') {
  isPortOpen(PORT).then((open) => {
    console.log(`Port ${PORT} is ${open ? 'OPEN (PostgreSQL is running)' : 'CLOSED'}`);
    process.exit(open ? 0 : 1);
  });
}
