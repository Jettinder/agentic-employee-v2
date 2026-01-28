export type RunId = string;
export type StepId = string;

export interface Objective { text: string }

export interface PlanStep {
  id: StepId;
  type: 'filesystem'|'terminal'|'editor'|'verify'|'policy'|'audit'|'custom';
  params: Record<string, unknown>;
  deps?: StepId[];
  fallbackParams?: Record<string, unknown>;
  retry?: { attempts: number; baseMs?: number; factor?: number; jitterPct?: number };
}

export interface RunContext {
  runId: RunId;
  objective: Objective;
  createdAt: number;
}
