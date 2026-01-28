import pino from 'pino';
import type { RunContext } from '../core/types.js';
import { insertAudit } from './db.js';
const logger = pino({ level: process.env.LOG_LEVEL||'info' });
export async function auditEvent(ctx: RunContext, event: string, data: any){ const payload = { runId: ctx.runId, event, data } as any; logger.info(payload); insertAudit({ runId: ctx.runId, event, data }); }
