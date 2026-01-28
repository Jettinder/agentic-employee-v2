import { runSteps } from '../core/orchestrator.js';
import type { RunContext, PlanStep } from '../core/types.js';

export async function startDemoE2E(){
  const ctx: RunContext = { runId: 'demo-'+Date.now(), objective: { text: 'demo-e2e' }, createdAt: Date.now() };
  const steps: PlanStep[] = [
    { id:'s1', type:'filesystem', params:{ op:'mkdir', path:'demo_v2' } },
    { id:'s2', type:'filesystem', params:{ op:'write', path:'demo_v2/main.sh', content:'#!/usr/bin/env bash\necho "Agent OK $(date -Iseconds)"\n' } },
    { id:'s3', type:'filesystem', params:{ op:'chmod', path:'demo_v2/main.sh', mode:'755' } },
    { id:'s4', type:'terminal', params:{ cmd:'./demo_v2/main.sh' } }
  ];
  await runSteps(ctx, steps);
}
