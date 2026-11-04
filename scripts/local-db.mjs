// Local development database: a real PostgreSQL 17 server that runs from
// node_modules (embedded-postgres) and keeps its data in .localdb/ in this project.
// Usage: npm run db:local   (Ctrl+C stops it). Matches the local DATABASE_URL in .env.example.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('.localdb');
const port = Number(process.env.LOCAL_DB_PORT || 5433);
const DB = 'dsarecx';
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  // Without these, Windows creates the cluster in WIN1252, which rejects "→",
  // non-Latin scripts and emoji. Neon is UTF-8, so match it.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

// A crash can leave a stale lock file behind; remove it only if no server owns it.
const pidFile = path.join(dir, 'postmaster.pid');
if (fs.existsSync(pidFile)) {
  const pid = Number(fs.readFileSync(pidFile, 'utf8').split('\n')[0]);
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch {}
  if (alive) {
    console.error(`A database server (PID ${pid}) is already using ${dir}.`);
    process.exit(1);
  }
  fs.rmSync(pidFile);
}

if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) await pg.initialise();
await pg.start();

// Make sure the app database exists and is UTF-8. A database created by an older
// version of this script may be WIN1252: keep it as a backup and start a UTF-8 one.
const admin = pg.getPgClient('postgres', 'localhost');
await admin.connect();
const { rows } = await admin.query('SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1', [DB]);
if (rows[0] && rows[0].enc !== 'UTF8') {
  const backup = `${DB}_${rows[0].enc.toLowerCase()}_backup_${Date.now()}`;
  await admin.query(`ALTER DATABASE "${DB}" RENAME TO "${backup}"`);
  console.log(`Database "${DB}" was ${rows[0].enc}; kept it as "${backup}" and created a UTF-8 one.`);
  console.log('Run `npm run db:migrate` (with DATABASE_URL pointing here) to create the tables.');
}
if (!rows[0] || rows[0].enc !== 'UTF8') {
  await admin.query(`CREATE DATABASE "${DB}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
}
await admin.end();

console.log(`Local database ready: postgresql://postgres:postgres@localhost:${port}/${DB}`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
