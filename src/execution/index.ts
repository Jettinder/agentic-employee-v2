import { z } from 'zod';
import { auditEvent } from '../audit/logger.js';
import type { RunContext } from '../core/types.js';
import { ensureUnderAllowed } from '../config/sandbox.js';
import { ok, err, ResultEnvelope } from '../core/errors.js';

const FSParams = z.object({ op: z.enum(['write','mkdir','chmod']), path: z.string(), content: z.string().optional(), mode: z.string().optional() });
export async function execFilesystem(ctx: RunContext, params: any): Promise<ResultEnvelope>{ const t0=Date.now(); try{ const p = FSParams.parse(params); ensureUnderAllowed(p.path); await auditEvent(ctx,'FS_EXEC',{p}); const { promises: fs } = await import('fs'); if(p.op==='mkdir'){ await fs.mkdir(p.path,{ recursive:true }); } else if(p.op==='write'){ await fs.writeFile(p.path, p.content||''); } else if(p.op==='chmod'){ await fs.chmod(p.path, p.mode||'755'); } return ok(Date.now()-t0); }catch(e:any){ return err(e?.code==='DENIED'?'DENIED':'EXEC_ERROR', Date.now()-t0, e); } }

const TermParams = z.object({ cmd: z.string(), cwd: z.string().optional() });
export async function execTerminal(ctx: RunContext, params: any): Promise<ResultEnvelope>{ const t0=Date.now(); try{ const p = TermParams.parse(params); await auditEvent(ctx,'TERM_EXEC',{p}); const { exec } = await import('child_process'); const { promisify } = await import('util'); const ex = promisify(exec); const res = await ex(p.cmd, { cwd: p.cwd }); return { ok:true, code:'OK', timingMs: Date.now()-t0, stdout: res.stdout, stderr: res.stderr, exitCode: 0 }; }catch(e:any){ return err('EXEC_ERROR', Date.now()-t0, e); } }

const EditParams = z.object({ path: z.string(), patch: z.string().optional(), content: z.string().optional() });
export async function execEditor(ctx: RunContext, params: any): Promise<ResultEnvelope>{ const t0=Date.now(); try{ const p = EditParams.parse(params); ensureUnderAllowed(p.path); await auditEvent(ctx,'EDIT_EXEC',{p}); const { promises: fs } = await import('fs'); if(typeof p.content==='string'){ await fs.writeFile(p.path, p.content); } return ok(Date.now()-t0); }catch(e:any){ return err(e?.code==='DENIED'?'DENIED':'EXEC_ERROR', Date.now()-t0, e); } }
