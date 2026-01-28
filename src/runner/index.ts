import { runSteps } from '../core/orchestrator.js';
import type { RunContext, PlanStep } from '../core/types.js';

export async function startDemoE2E(){
  const ctx: RunContext = { runId: 'demo-'+Date.now(), objective: { text: 'demo-e2e' }, createdAt: Date.now() };
  const steps: PlanStep[] = [
    // Simulated denied action: path outside sandbox, with fallback to allowed path
    { id:'s0', type:'filesystem', params:{ op:'write', path:'outside/main.sh', content:'# placeholder' }, fallbackParams:{ op:'write', path:'demo_v2/main.sh', content:'# will be overwritten later' } },
    { id:'s1', type:'filesystem', params:{ op:'mkdir', path:'demo_v2' }, deps:['s0'] },
    { id:'s2', type:'filesystem', params:{ op:'write', path:'demo_v2/main.sh', content:'#!/usr/bin/env bash\necho "Agent OK $(date -Iseconds)"\n' }, deps:['s1'] },
    { id:'s3', type:'filesystem', params:{ op:'chmod', path:'demo_v2/main.sh', mode:'755' }, deps:['s2'] },
    { id:'s4', type:'terminal', params:{ cmd:'./demo_v2/main.sh' }, deps:['s3'], retry:{ attempts:2, baseMs:200, factor:2, jitterPct:0.1 } }
  ];
  await runSteps(ctx, steps);
}
