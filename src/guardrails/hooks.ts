import { evaluatePolicy } from './policy.js';
import type { RunContext, PlanStep } from '../core/types.js';
export async function preCheck(_ctx: RunContext, step: PlanStep){ const dec = evaluatePolicy(step); if(dec.verdict==='DENY') { const e = new Error('Denied: '+(dec.reason||'policy')); (e as any).code='DENIED'; throw e; } }
export async function postValidate(_ctx: RunContext, step: PlanStep, result: any){ if(step.type==='terminal'){ if(!(result?.stdout||'').includes('Agent OK')) throw new Error('VERIFY_FAIL: missing Agent OK'); } }
