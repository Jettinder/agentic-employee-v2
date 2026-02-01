/**
 * Slack Integration
 * Send messages, manage channels, handle notifications
 */

import { WebClient, ChatPostMessageResponse } from '@slack/web-api';

export interface SlackConfig {
  token: string;
  defaultChannel?: string;
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  threadTs?: string;
  attachments?: any[];
}

export interface SlackResult {
  success: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

export class SlackClient {
  private client: WebClient | null = null;
  private config: SlackConfig;

  constructor(config?: Partial<SlackConfig>) {
    this.config = {
      token: process.env.SLACK_BOT_TOKEN || '',
      defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#general',
      ...config,
    };
  }

  async init(): Promise<void> {
    if (!this.config.token) {
      console.warn('[Slack] Bot token not configured');
      return;
    }

    this.client = new WebClient(this.config.token);

    try {
      const result = await this.client.auth.test();
      console.log(`[Slack] Connected as ${result.user}`);
    } catch (error: any) {
      console.warn(`[Slack] Connection failed: ${error.message}`);
      this.client = null;
    }
  }

  async sendMessage(message: SlackMessage | string): Promise<SlackResult> {
    if (!this.client) {
      await this.init();
    }

    if (!this.client) {
      return { success: false, error: 'Slack not configured' };
    }

    const msg: SlackMessage = typeof message === 'string'
      ? { channel: this.config.defaultChannel!, text: message }
      : message;

    try {
      const result = await this.client.chat.postMessage({
        channel: msg.channel,
        text: msg.text,
        blocks: msg.blocks,
        thread_ts: msg.threadTs,
        attachments: msg.attachments,
      });

      return {
        success: true,
        ts: result.ts,
        channel: result.channel,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendNotification(
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
    channel?: string
  ): Promise<SlackResult> {
    const colors = {
      info: '#0066cc',
      success: '#00cc66',
      warning: '#ffcc00',
      error: '#cc0000',
    };

    const emojis = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    return this.sendMessage({
      channel: channel || this.config.defaultChannel!,
      text: `${emojis[type]} ${title}`,
      attachments: [{
        color: colors[type],
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*${title}*\n${message}` },
          },
        ],
      }],
    });
  }

  async sendTaskComplete(
    taskName: string,
    result: string,
    duration: string,
    channel?: string
  ): Promise<SlackResult> {
    return this.sendMessage({
      channel: channel || this.config.defaultChannel!,
      text: `✅ Task Completed: ${taskName}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '✅ Task Completed' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Task:*\n${taskName}` },
            { type: 'mrkdwn', text: `*Duration:*\n${duration}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Result:*\n${result}` },
        },
      ],
    });
  }

  async sendApprovalRequest(
    action: string,
    reason: string,
    approvalId: string,
    channel?: string
  ): Promise<SlackResult> {
    return this.sendMessage({
      channel: channel || this.config.defaultChannel!,
      text: `⚠️ Approval Needed: ${action}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '⚠️ Approval Required' },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Action:* ${action}\n*Reason:* ${reason}` },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ Approve' },
              style: 'primary',
              action_id: `approve_${approvalId}`,
              value: approvalId,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '❌ Reject' },
              style: 'danger',
              action_id: `reject_${approvalId}`,
              value: approvalId,
            },
          ],
        },
      ],
    });
  }

  async listChannels(): Promise<{ success: boolean; channels?: Array<{ id: string; name: string }>; error?: string }> {
    if (!this.client) {
      await this.init();
    }

    if (!this.client) {
      return { success: false, error: 'Slack not configured' };
    }

    try {
      const result = await this.client.conversations.list({ types: 'public_channel,private_channel' });
      const channels = (result.channels || []).map(ch => ({
        id: ch.id!,
        name: ch.name!,
      }));
      return { success: true, channels };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  isConfigured(): boolean {
    return !!this.config.token;
  }
}

// Singleton
let slackClient: SlackClient | null = null;

export function getSlackClient(): SlackClient {
  if (!slackClient) {
    slackClient = new SlackClient();
  }
  return slackClient;
}
