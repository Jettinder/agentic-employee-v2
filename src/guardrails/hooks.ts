import { evaluatePolicy } from './policy.js';
import type { RunContext, PlanStep } from '../core/types.js';

export async function preCheck(_ctx: RunContext, step: PlanStep){ const dec = evaluatePolicy(step); if(dec.verdict==='DENY') throw new Error('Denied: '+(dec.reason||'policy')); }
export async function postValidate(_ctx: RunContext, _step: PlanStep, _result: any){ return }
