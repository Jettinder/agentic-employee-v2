import { SANDBOX } from '../config/sandbox.js';
export type PolicyVerdict = 'ALLOW'|'DENY';
export interface PolicyDecision { verdict: PolicyVerdict; reason?: string }
export function evaluatePolicy(step: any): PolicyDecision {
  if(step.type==='filesystem'){
    const p = step.params?.path as string;
    if(!p || !p.startsWith(SANDBOX.allowedRoot)) return { verdict:'DENY', reason:'path_outside_sandbox' };
  }
  if(step.type==='terminal'){
    const cmd = String(step.params?.cmd||'');
    if(!SANDBOX.allowedTerminal.some(rx=>rx.test(cmd))) return { verdict:'DENY', reason:'terminal_cmd_not_whitelisted' };
  }
  return { verdict:'ALLOW' };
}
