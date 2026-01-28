export type PolicyVerdict = 'ALLOW'|'DENY';
export interface PolicyDecision { verdict: PolicyVerdict; reason?: string }
export function evaluatePolicy(_step: any): PolicyDecision { return { verdict: 'ALLOW' } }
