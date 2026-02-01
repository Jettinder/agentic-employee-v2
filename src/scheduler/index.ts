/**
 * Task Scheduler
 * Proactive task execution via cron jobs
 */

import * as cron from 'node-cron';
import { runObjective } from '../core/agent-loop.js';
import { getNotificationManager } from '../integrations/notifications/index.js';
import { auditEvent } from '../audit/logger.js';
import type { RunContext } from '../core/types.js';

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string; // cron expression
  objective: string;
  domain?: string;
  enabled: boolean;
  lastRun?: number;
  lastResult?: 'success' | 'error';
  notifyOnComplete?: boolean;
  notifyOnError?: boolean;
}

export interface SchedulerConfig {
  tasks: ScheduledTask[];
  timezone?: string;
}

class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private jobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();
  private timezone: string;

  constructor(config?: Partial<SchedulerConfig>) {
    this.timezone = config?.timezone || 'Europe/Rome';
    
    if (config?.tasks) {
      for (const task of config.tasks) {
        this.addTask(task);
      }
    }
  }

  addTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
    
    if (task.enabled) {
      this.scheduleTask(task);
    }
  }

  private scheduleTask(task: ScheduledTask): void {
    // Cancel existing job if any
    const existingJob = this.jobs.get(task.id);
    if (existingJob) {
      existingJob.stop();
    }

    const job = cron.schedule(
      task.schedule,
      async () => {
        console.log(`[Scheduler] Running task: ${task.name}`);
        await this.executeTask(task);
      },
      {
        timezone: this.timezone,
      }
    );

    this.jobs.set(task.id, job);
    console.log(`[Scheduler] Scheduled: ${task.name} (${task.schedule})`);
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    const ctx: RunContext = {
      runId: `scheduled-${task.id}-${Date.now()}`,
      objective: { text: task.objective },
      createdAt: Date.now(),
    };

    try {
      await auditEvent(ctx, 'SCHEDULED_TASK_START', { taskId: task.id, name: task.name });

      const result = await runObjective(task.objective, {
        domain: task.domain as any,
        autoDomain: !task.domain,
        verbose: false,
      });

      task.lastRun = Date.now();
      task.lastResult = result.success ? 'success' : 'error';

      await auditEvent(ctx, 'SCHEDULED_TASK_END', {
        taskId: task.id,
        success: result.success,
        iterations: result.iterations,
      });

      // Notify on complete
      if (task.notifyOnComplete && result.success) {
        await getNotificationManager().notify({
          type: 'success',
          title: `Scheduled Task Complete: ${task.name}`,
          message: result.finalResponse.slice(0, 500),
        }, ctx);
      }

      // Notify on error
      if (task.notifyOnError && !result.success) {
        await getNotificationManager().notify({
          type: 'error',
          title: `Scheduled Task Failed: ${task.name}`,
          message: result.errors.join('\n'),
          priority: 'high',
        }, ctx);
      }

    } catch (error: any) {
      task.lastRun = Date.now();
      task.lastResult = 'error';

      await auditEvent(ctx, 'SCHEDULED_TASK_ERROR', {
        taskId: task.id,
        error: error.message,
      });

      if (task.notifyOnError) {
        await getNotificationManager().notify({
          type: 'error',
          title: `Scheduled Task Error: ${task.name}`,
          message: error.message,
          priority: 'urgent',
        }, ctx);
      }
    }
  }

  removeTask(taskId: string): boolean {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
    }
    return this.tasks.delete(taskId);
  }

  enableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = true;
      this.scheduleTask(task);
    }
  }

  disableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = false;
      const job = this.jobs.get(taskId);
      if (job) {
        job.stop();
        this.jobs.delete(taskId);
      }
    }
  }

  runNow(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      this.executeTask(task);
    }
  }

  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  stopAll(): void {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  startAll(): void {
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }
  }
}

// Default scheduled tasks
const DEFAULT_TASKS: ScheduledTask[] = [
  {
    id: 'daily-summary',
    name: 'Daily Summary Report',
    schedule: '0 18 * * 1-5', // 6 PM weekdays
    objective: 'Generate a daily summary report of all completed tasks, errors, and pending items. Send it via notification.',
    domain: 'operations',
    enabled: false, // Enable when needed
    notifyOnComplete: true,
    notifyOnError: true,
  },
  {
    id: 'inbox-check',
    name: 'Check Inbox',
    schedule: '0 */2 * * *', // Every 2 hours
    objective: 'Check for new important emails and summarize anything urgent.',
    enabled: false,
    notifyOnComplete: false,
    notifyOnError: true,
  },
  {
    id: 'calendar-reminder',
    name: 'Calendar Reminder',
    schedule: '0 8 * * *', // 8 AM daily
    objective: 'Check today\'s calendar and send a summary of upcoming meetings.',
    enabled: false,
    notifyOnComplete: true,
    notifyOnError: false,
  },
];

// Singleton
let scheduler: TaskScheduler | null = null;

export function getScheduler(): TaskScheduler {
  if (!scheduler) {
    scheduler = new TaskScheduler({ tasks: DEFAULT_TASKS });
  }
  return scheduler;
}

export function startScheduler(): TaskScheduler {
  const s = getScheduler();
  s.startAll();
  console.log('[Scheduler] Started');
  return s;
}

export function stopScheduler(): void {
  if (scheduler) {
    scheduler.stopAll();
    console.log('[Scheduler] Stopped');
  }
}

export { TaskScheduler };
