import { z } from 'zod';
import { auditEvent } from '../audit/logger.js';
import type { RunContext } from '../core/types.js';

const FSParams = z.object({ op: z.enum(['write','mkdir','chmod']), path: z.string(), content: z.string().optional(), mode: z.string().optional() });
export async function execFilesystem(ctx: RunContext, params: any){ const p = FSParams.parse(params); await auditEvent(ctx,'FS_EXEC',{p}); return { ok: true, code: 'FS_OK' } }

const TermParams = z.object({ cmd: z.string(), cwd: z.string().optional() });
export async function execTerminal(ctx: RunContext, params: any){ const p = TermParams.parse(params); await auditEvent(ctx,'TERM_EXEC',{p}); return { ok: true, code: 'TERM_OK', stdout: 'Agent OK '+new Date().toISOString(), exitCode: 0 } }

const EditParams = z.object({ path: z.string(), patch: z.string() });
export async function execEditor(ctx: RunContext, params: any){ const p = EditParams.parse(params); await auditEvent(ctx,'EDIT_EXEC',{p}); return { ok: true, code: 'EDIT_OK' } }
