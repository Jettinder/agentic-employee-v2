import Database from 'better-sqlite3';
export function queryByRun(runId: string){
  const db = new Database('.data/audit.sqlite');
  const stmt = db.prepare('SELECT id, run_id, event_type, data, created_at FROM audit_events WHERE run_id = ? ORDER BY id ASC');
  const rows = stmt.all(runId).map(r => ({ id: r.id, event: r.event_type, data: safeParse(r.data), at: r.created_at }));
  return rows;
}

export function getAllRuns(){
  const db = new Database('.data/audit.sqlite');
  const stmt = db.prepare('SELECT DISTINCT run_id FROM audit_events ORDER BY run_id DESC');
  const rows = stmt.all();
  return rows.map(r => r.run_id);
}

function safeParse(s: string){ try { return JSON.parse(s); } catch { return { raw: s }; } }
