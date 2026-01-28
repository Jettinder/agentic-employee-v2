import pino from 'pino';
import type { RunContext } from '../core/types.js';
const logger = pino({ level: process.env.LOG_LEVEL||'info' });
export async function auditEvent(ctx: RunContext, event: string, data: any){ logger.info({runId: ctx.runId, event, ...data}); }
