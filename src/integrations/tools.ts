/**
 * Integration Tools for AI
 * Email, Calendar, Slack, Notifications
 */

import type { ToolDefinition } from '../ai/types.js';

export const emailTool: ToolDefinition = {
  name: 'email',
  description: 'Send emails. Use for communication, notifications, reports.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['send', 'send_template'],
        description: 'Email action',
      },
      to: {
        type: 'array',
        items: { type: 'string' },
        description: 'Recipient email addresses',
      },
      subject: {
        type: 'string',
        description: 'Email subject',
      },
      body: {
        type: 'string',
        description: 'Email body (text or HTML)',
      },
      template: {
        type: 'string',
        enum: ['task_complete', 'approval_needed', 'error_report', 'daily_summary'],
        description: 'Template name (for send_template)',
      },
      templateData: {
        type: 'object',
        description: 'Data for template',
      },
    },
    required: ['action'],
  },
};

export const calendarTool: ToolDefinition = {
  name: 'calendar',
  description: 'Manage calendar events. Create meetings, check schedule, find free slots.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'upcoming', 'delete', 'find_slot'],
        description: 'Calendar action',
      },
      summary: {
        type: 'string',
        description: 'Event title/summary',
      },
      description: {
        type: 'string',
        description: 'Event description',
      },
      start: {
        type: 'string',
        description: 'Start time (ISO 8601 or natural language like "tomorrow 2pm")',
      },
      end: {
        type: 'string',
        description: 'End time',
      },
      duration: {
        type: 'number',
        description: 'Duration in minutes (for find_slot)',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Attendee email addresses',
      },
      eventId: {
        type: 'string',
        description: 'Event ID (for delete)',
      },
      hours: {
        type: 'number',
        description: 'Hours ahead to look (for upcoming/list)',
      },
    },
    required: ['action'],
  },
};

export const slackTool: ToolDefinition = {
  name: 'slack',
  description: 'Send Slack messages and notifications to team channels.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['send', 'notify', 'list_channels'],
        description: 'Slack action',
      },
      channel: {
        type: 'string',
        description: 'Channel name or ID (e.g., #general)',
      },
      message: {
        type: 'string',
        description: 'Message text',
      },
      type: {
        type: 'string',
        enum: ['info', 'success', 'warning', 'error'],
        description: 'Notification type (for notify)',
      },
      title: {
        type: 'string',
        description: 'Notification title (for notify)',
      },
      threadTs: {
        type: 'string',
        description: 'Thread timestamp to reply to',
      },
    },
    required: ['action'],
  },
};

export const notifyTool: ToolDefinition = {
  name: 'notify',
  description: 'Send notifications via multiple channels (email, slack, desktop). Use for important updates.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['info', 'success', 'warning', 'error'],
        description: 'Notification type',
      },
      title: {
        type: 'string',
        description: 'Notification title',
      },
      message: {
        type: 'string',
        description: 'Notification message',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
        description: 'Priority level',
      },
      channels: {
        type: 'array',
        items: { type: 'string', enum: ['email', 'slack', 'desktop', 'webhook', 'all'] },
        description: 'Channels to notify (default: all configured)',
      },
    },
    required: ['type', 'title', 'message'],
  },
};

export function getIntegrationTools(): ToolDefinition[] {
  return [emailTool, calendarTool, slackTool, notifyTool];
}
