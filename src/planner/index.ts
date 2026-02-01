/**
 * Planner Module
 * Converts high-level objectives into structured execution plans
 */

import type { PlanStep, RunContext } from '../core/types.js';
import type { Message } from '../ai/types.js';
import { AIRouter, createRouterFromEnv } from '../ai/router.js';
import { auditEvent } from '../audit/logger.js';

export interface Plan {
  objective: string;
  steps: PlanStep[];
  estimatedDuration?: string;
  requiredResources?: string[];
  risks?: string[];
}

const PLANNER_SYSTEM_PROMPT = `You are a task planning AI. Your job is to break down objectives into concrete, executable steps.

## Output Format

Respond with a JSON object:
{
  "objective": "summary of the objective",
  "steps": [
    {
      "id": "s1",
      "type": "filesystem|terminal|editor|verify|custom",
      "description": "human-readable description",
      "params": { ... },
      "deps": ["s0"],  // optional: step dependencies
      "retry": { "attempts": 3, "baseMs": 1000 }  // optional
    }
  ],
  "estimatedDuration": "5 minutes",
  "requiredResources": ["filesystem access", "npm"],
  "risks": ["may require sudo for some operations"]
}

## Step Types

- **filesystem**: { op: "read|write|mkdir|chmod|list|delete", path: "...", content?: "..." }
- **terminal**: { cmd: "...", cwd?: "..." }
- **editor**: { path: "...", op: "replace|insert", search?: "...", replace?: "...", content?: "..." }
- **verify**: { type: "file_exists|command_succeeds|contains", target: "...", expected?: "..." }
- **custom**: { action: "...", params: { ... } }

## Guidelines

1. Be specific - each step should be executable without interpretation
2. Order steps by dependencies
3. Include verification steps where appropriate
4. Consider error cases and add fallbacks when possible
5. Keep steps atomic - one clear action per step
`;

export class Planner {
  private router: AIRouter;

  constructor(router?: AIRouter) {
    this.router = router || createRouterFromEnv();
  }

  /**
   * Generate a plan from an objective
   */
  async plan(ctx: RunContext, objective: string): Promise<Plan> {
    await auditEvent(ctx, 'PLAN_START', { objective });

    const messages: Message[] = [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: `Create an execution plan for: ${objective}` },
    ];

    const response = await this.router.complete({ messages }, ctx);
    
    try {
      // Extract JSON from response
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in planner response');
      }

      const plan = JSON.parse(jsonMatch[0]) as Plan;
      
      // Validate and normalize steps
      plan.steps = plan.steps.map((step, idx) => ({
        ...step,
        id: step.id || `s${idx}`,
        type: step.type || 'custom',
        params: step.params || {},
      }));

      await auditEvent(ctx, 'PLAN_COMPLETE', { 
        stepCount: plan.steps.length,
        estimatedDuration: plan.estimatedDuration,
      });

      return plan;

    } catch (error: any) {
      await auditEvent(ctx, 'PLAN_ERROR', { error: error.message });
      
      // Return a simple fallback plan
      return {
        objective,
        steps: [{
          id: 's0',
          type: 'custom',
          params: { action: 'manual', note: 'Could not auto-generate plan' },
          description: response.message.content,
        }],
        risks: ['Automatic planning failed, manual review required'],
      };
    }
  }

  /**
   * Refine a plan based on feedback
   */
  async refinePlan(ctx: RunContext, plan: Plan, feedback: string): Promise<Plan> {
    const messages: Message[] = [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: `Original objective: ${plan.objective}\n\nCurrent plan:\n${JSON.stringify(plan, null, 2)}\n\nFeedback: ${feedback}\n\nPlease refine the plan.` },
    ];

    const response = await this.router.complete({ messages }, ctx);
    
    try {
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in planner response');
      }
      return JSON.parse(jsonMatch[0]) as Plan;
    } catch {
      return plan; // Return original if refinement fails
    }
  }

  /**
   * Validate a plan for completeness
   */
  validatePlan(plan: Plan): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!plan.steps || plan.steps.length === 0) {
      issues.push('Plan has no steps');
    }

    const stepIds = new Set<string>();
    for (const step of plan.steps) {
      if (!step.id) {
        issues.push(`Step missing id`);
      } else if (stepIds.has(step.id)) {
        issues.push(`Duplicate step id: ${step.id}`);
      }
      stepIds.add(step.id);

      if (!step.type) {
        issues.push(`Step ${step.id} missing type`);
      }

      // Check dependencies exist
      if (step.deps) {
        for (const dep of step.deps) {
          if (!stepIds.has(dep)) {
            // Dependency might be later in the list, that's ok
            // But we should check circular deps
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * Create planner from environment
 */
export function createPlanner(): Planner {
  return new Planner(createRouterFromEnv());
}

/**
 * Quick plan generation
 */
export async function generatePlan(objective: string): Promise<Plan> {
  const ctx: RunContext = {
    runId: `plan-${Date.now()}`,
    objective: { text: objective },
    createdAt: Date.now(),
  };

  const planner = createPlanner();
  return planner.plan(ctx, objective);
}
