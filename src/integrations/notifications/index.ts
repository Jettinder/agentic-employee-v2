/**
 * Notification System
 * Unified notifications via Email, Slack, Desktop, Webhooks
 */

import { getEmailClient } from '../email/index.js';
import { getSlackClient } from '../slack/index.js';
import { auditEvent } from '../../audit/logger.js';
import type { RunContext } from '../../core/types.js';

export type NotificationChannel = 'email' | 'slack' | 'desktop' | 'webhook' | 'all';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationConfig {
  channels: NotificationChannel[];
  email?: {
    recipients: string[];
  };
  slack?: {
    channel: string;
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
}

export interface Notification {
  type: 'info' | 'success' | 'warning' | 'error' | 'approval';
  title: string;
  message: string;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
}

export interface NotificationResult {
  success: boolean;
  results: Record<NotificationChannel, { success: boolean; error?: string }>;
}

// Default config from env
const defaultConfig: NotificationConfig = {
  channels: ['slack', 'email'],
  email: {
    recipients: process.env.NOTIFICATION_EMAILS?.split(',') || [],
  },
  slack: {
    channel: process.env.SLACK_DEFAULT_CHANNEL || '#agent-notifications',
  },
  webhook: {
    url: process.env.NOTIFICATION_WEBHOOK || '',
  },
};

export class NotificationManager {
  private config: NotificationConfig;
  private pendingApprovals: Map<string, {
    action: string;
    reason: string;
    impact: string;
    createdAt: number;
    resolve: (approved: boolean) => void;
  }> = new Map();

  constructor(config?: Partial<NotificationConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  async notify(notification: Notification, ctx?: RunContext): Promise<NotificationResult> {
    const channels = notification.channels || this.config.channels;
    const results: Record<NotificationChannel, { success: boolean; error?: string }> = {
      email: { success: false, error: 'Not attempted' },
      slack: { success: false, error: 'Not attempted' },
      desktop: { success: false, error: 'Not attempted' },
      webhook: { success: false, error: 'Not attempted' },
      all: { success: false, error: 'N/A' },
    };

    const promises: Promise<void>[] = [];

    // Email
    if (channels.includes('email') || channels.includes('all')) {
      promises.push(
        this.sendEmail(notification).then(r => { results.email = r; })
      );
    }

    // Slack
    if (channels.includes('slack') || channels.includes('all')) {
      promises.push(
        this.sendSlack(notification).then(r => { results.slack = r; })
      );
    }

    // Desktop (using notify-send on Linux)
    if (channels.includes('desktop') || channels.includes('all')) {
      promises.push(
        this.sendDesktop(notification).then(r => { results.desktop = r; })
      );
    }

    // Webhook
    if (channels.includes('webhook') || channels.includes('all')) {
      promises.push(
        this.sendWebhook(notification).then(r => { results.webhook = r; })
      );
    }

    await Promise.all(promises);

    if (ctx) {
      await auditEvent(ctx, 'NOTIFICATION_SENT', {
        type: notification.type,
        title: notification.title,
        channels,
        results,
      });
    }

    const anySuccess = Object.values(results).some(r => r.success);
    return { success: anySuccess, results };
  }

  private async sendEmail(notification: Notification): Promise<{ success: boolean; error?: string }> {
    const client = getEmailClient();
    if (!client.isConfigured() || !this.config.email?.recipients.length) {
      return { success: false, error: 'Email not configured' };
    }

    const templateMap: Record<string, 'task_complete' | 'approval_needed' | 'error_report'> = {
      success: 'task_complete',
      approval: 'approval_needed',
      error: 'error_report',
    };

    const template = templateMap[notification.type];
    if (template) {
      return client.sendTemplate(this.config.email.recipients, template, {
        taskName: notification.title,
        result: notification.message,
        ...notification.data,
      });
    }

    return client.send({
      to: this.config.email.recipients,
      subject: `[Agent] ${notification.title}`,
      html: `<h2>${notification.title}</h2><p>${notification.message}</p>`,
    });
  }

  private async sendSlack(notification: Notification): Promise<{ success: boolean; error?: string }> {
    const client = getSlackClient();
    if (!client.isConfigured()) {
      return { success: false, error: 'Slack not configured' };
    }

    const typeMap: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
      info: 'info',
      success: 'success',
      warning: 'warning',
      error: 'error',
      approval: 'warning',
    };

    return client.sendNotification(
      typeMap[notification.type] || 'info',
      notification.title,
      notification.message,
      this.config.slack?.channel
    );
  }

  private async sendDesktop(notification: Notification): Promise<{ success: boolean; error?: string }> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const urgency = notification.priority === 'urgent' ? 'critical' :
                      notification.priority === 'high' ? 'normal' : 'low';

      await execAsync(`notify-send -u ${urgency} "${notification.title}" "${notification.message}"`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async sendWebhook(notification: Notification): Promise<{ success: boolean; error?: string }> {
    if (!this.config.webhook?.url) {
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers,
        },
        body: JSON.stringify({
          type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          data: notification.data,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Approval system
  async requestApproval(
    action: string,
    reason: string,
    impact: 'low' | 'medium' | 'high' | 'critical',
    timeoutMs: number = 5 * 60 * 1000, // 5 min default
    ctx?: RunContext
  ): Promise<{ approved: boolean; timedOut: boolean }> {
    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Send notification
    await this.notify({
      type: 'approval',
      title: `Approval Needed: ${action}`,
      message: reason,
      priority: impact === 'critical' ? 'urgent' : impact === 'high' ? 'high' : 'medium',
      data: { action, reason, impact, approvalId },
    }, ctx);

    // Also send Slack with buttons if configured
    const slack = getSlackClient();
    if (slack.isConfigured()) {
      await slack.sendApprovalRequest(action, reason, approvalId, this.config.slack?.channel);
    }

    // Wait for approval (with timeout)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(approvalId);
        resolve({ approved: false, timedOut: true });
      }, timeoutMs);

      this.pendingApprovals.set(approvalId, {
        action,
        reason,
        impact,
        createdAt: Date.now(),
        resolve: (approved: boolean) => {
          clearTimeout(timeout);
          this.pendingApprovals.delete(approvalId);
          resolve({ approved, timedOut: false });
        },
      });
    });
  }

  // Handle approval response (called from webhook or Slack action)
  handleApprovalResponse(approvalId: string, approved: boolean): boolean {
    const pending = this.pendingApprovals.get(approvalId);
    if (pending) {
      pending.resolve(approved);
      return true;
    }
    return false;
  }

  getPendingApprovals(): Array<{ id: string; action: string; reason: string; createdAt: number }> {
    return Array.from(this.pendingApprovals.entries()).map(([id, data]) => ({
      id,
      action: data.action,
      reason: data.reason,
      createdAt: data.createdAt,
    }));
  }
}

// Singleton
let notificationManager: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}

// Quick helpers
export async function notify(
  type: Notification['type'],
  title: string,
  message: string,
  ctx?: RunContext
): Promise<NotificationResult> {
  return getNotificationManager().notify({ type, title, message }, ctx);
}

export async function notifySuccess(title: string, message: string, ctx?: RunContext): Promise<NotificationResult> {
  return notify('success', title, message, ctx);
}

export async function notifyError(title: string, message: string, ctx?: RunContext): Promise<NotificationResult> {
  return notify('error', title, message, ctx);
}

export async function requestApproval(
  action: string,
  reason: string,
  impact: 'low' | 'medium' | 'high' | 'critical',
  ctx?: RunContext
): Promise<{ approved: boolean; timedOut: boolean }> {
  return getNotificationManager().requestApproval(action, reason, impact, undefined, ctx);
}
