import { RunContext, PlanStep } from './types.js';
import { execFilesystem, execTerminal, execEditor } from '../execution/index.js';
import { preCheck, postValidate } from '../guardrails/hooks.js';
import { auditEvent } from '../audit/logger.js';

export async function runSteps(ctx: RunContext, steps: PlanStep[]) {
  for (const step of steps) {
    await auditEvent(ctx, 'STEP_START', { step });
    await preCheck(ctx, step);
    let result: any;
    if (step.type === 'filesystem') result = await execFilesystem(ctx, step.params);
    else if (step.type === 'terminal') result = await execTerminal(ctx, step.params);
    else if (step.type === 'editor') result = await execEditor(ctx, step.params);
    else result = { ok: true };
    await postValidate(ctx, step, result);
    await auditEvent(ctx, 'STEP_END', { step, result });
  }
}
