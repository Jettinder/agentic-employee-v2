import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
let db: any;
export function getDb(){
  if(!db){
    if(!existsSync('.data')) mkdirSync('.data');
    db = new Database('.data/audit.sqlite');
    ensureSchema(db);
  }
  return db;
}
function ensureSchema(d: any){
  const schema = readFileSync('db/schema.sql','utf8');
  d.exec(schema);
}
export function insertAudit(event: any){
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO audit_events (run_id,event_type,severity,message,data,created_at) VALUES (@runId,@event,@severity,@message,@data,@createdAt)`);
  stmt.run({
    runId: event.runId,
    event: event.event,
    severity: event.severity||'info',
    message: event.message||'',
    data: JSON.stringify(event.data||{}),
    createdAt: new Date().toISOString()
  });
}
