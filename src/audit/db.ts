import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
let db: Database.Database;
export function getDb(){ if(!db){ if(!existsSync('.data')) mkdirSync('.data'); db = new Database('.data/audit.sqlite'); ensureSchema(); } return db; }
function ensureSchema(){ const schema = readFileSync('db/schema.sql','utf8'); getDb().exec(schema); }
export function insertAudit(event: any){ const d = getDb(); const stmt = d.prepare(`INSERT INTO audit_events (run_id,event_type,severity,message,data,created_at) VALUES (@runId,@event,@severity,@message,@data,@createdAt)`);
  stmt.run({ runId: event.runId, event: event.event, severity: event.severity||'info', message: event.message||'', data: JSON.stringify(event.data||{}), createdAt: new Date().toISOString() }); }
