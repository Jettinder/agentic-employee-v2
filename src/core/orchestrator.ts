import { RunContext, PlanStep } from './types.js';
import { execFilesystem, execTerminal, execEditor } from '../execution/index.js';
import { preCheck, postValidate } from '../guardrails/hooks.js';
import { auditEvent } from '../audit/logger.js';
import { withRetry } from './retry.js';
import { emitRunReport } from './report.js';

function topoSort(steps: PlanStep[]): PlanStep[]{
  const byId=new Map<string,PlanStep>(); steps.forEach(s=>byId.set(s.id,s));
  const indeg=new Map<string,number>(); steps.forEach(s=>indeg.set(s.id,0));
  steps.forEach(s=> (s.deps||[]).forEach(d=> indeg.set(s.id, (indeg.get(s.id)||0)+1)) );
  const q:PlanStep[]=[]; indeg.forEach((deg,id)=>{ if(deg===0) q.push(byId.get(id)!); });
  const out:PlanStep[]=[]; while(q.length){ const n=q.shift()!; out.push(n); (n.deps||[]).forEach(()=>{}); steps.forEach(s=>{ if((s.deps||[]).includes(n.id)){ const nd=(indeg.get(s.id)||0)-1; indeg.set(s.id,nd); if(nd===0) q.push(s); } }); }
  return out.length?out:steps; // fallback to given order
}

export async function runSteps(ctx: RunContext, steps: PlanStep[]) {
  const ordered = topoSort(steps);
  let ok=0, retries=0, fallbacks=0; const startedAt=Date.now();
  for (const step of ordered) {
    await auditEvent(ctx, 'STEP_START', { step });
    const runner = async () => {
      await preCheck(ctx, step);
      let result: any;
      if (step.type === 'filesystem') result = await execFilesystem(ctx, step.params);
      else if (step.type === 'terminal') result = await execTerminal(ctx, step.params);
      else if (step.type === 'editor') result = await execEditor(ctx, step.params);
      else result = { ok: true };
      await postValidate(ctx, step, result);
      return result;
    };

    try{
      const attempts = step.retry?.attempts ?? 1;
      const res = await withRetry(runner, { attempts, baseMs: step.retry?.baseMs, factor: step.retry?.factor, jitterPct: step.retry?.jitterPct });
      if(res?.ok) ok++;
    }catch(e:any){
      // If denied and we have fallback params, try once more with fallback
      if(step.fallbackParams){
        await auditEvent(ctx,'FALLBACK_APPLY',{ stepId: step.id });
        const original = step.params; step.params = step.fallbackParams; fallbacks++;
        const attempts = step.retry?.attempts ?? 1;
        try{
          const res2 = await withRetry(async()=>{
            await preCheck(ctx, step);
            let result: any;
            if (step.type === 'filesystem') result = await execFilesystem(ctx, step.params);
            else if (step.type === 'terminal') result = await execTerminal(ctx, step.params);
            else if (step.type === 'editor') result = await execEditor(ctx, step.params);
            else result = { ok: true };
            await postValidate(ctx, step, result);
            return result;
          }, { attempts, baseMs: step.retry?.baseMs, factor: step.retry?.factor, jitterPct: step.retry?.jitterPct });
          if(res2?.ok) ok++;
        }catch(e2){ await auditEvent(ctx,'STEP_FAIL',{ step, error: String(e2)}); throw e2; }
        finally{ step.params = original; }
      } else {
        await auditEvent(ctx,'STEP_FAIL',{ step, error: String(e)}); throw e;
      }
    }
    await auditEvent(ctx, 'STEP_END', { step });
  }
  await emitRunReport(ctx, ordered.length, ok, retries, fallbacks, startedAt);
}
