import { auditEvent } from '../audit/logger.js';
import type { RunContext } from './types.js';
export interface RunReport { summary: string; timings: Record<string,number>; stats: Record<string,number>; generatedAt: string }
export async function emitRunReport(ctx:RunContext, steps:number, ok:number, retries:number, fallbacks:number, startedAt:number){
  const report: RunReport = { summary: 'Run completed', timings: { totalMs: Date.now()-startedAt }, stats: { steps, ok, retries, fallbacks }, generatedAt: new Date().toISOString() };
  await auditEvent(ctx,'RUN_REPORT', { report });
  console.log(JSON.stringify({ runId: ctx.runId, report }, null, 2));
}
