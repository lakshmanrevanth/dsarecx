// Local development database: a real PostgreSQL 17 server that runs from
// node_modules (embedded-postgres) and keeps its data in .localdb/ in this project.
// Usage: npm run db:local   (Ctrl+C stops it). Matches DATABASE_URL in .env.example.local.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('.localdb');
const port = Number(process.env.LOCAL_DB_PORT || 5433);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: true });

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
try { await pg.createDatabase('dsarecx'); } catch { /* already exists */ }
console.log(`Local database ready: postgresql://postgres:postgres@localhost:${port}/dsarecx`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
