/**
 * Email Integration
 * Send, read, and manage emails via SMTP/IMAP or Gmail API
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  provider: 'smtp' | 'gmail';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  gmail?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  from: string;
}

export interface Email {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailClient {
  private transporter: Transporter | null = null;
  private config: EmailConfig;

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      provider: 'smtp',
      from: process.env.EMAIL_FROM || 'agent@company.com',
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      ...config,
    };
  }

  async init(): Promise<void> {
    if (this.config.provider === 'smtp' && this.config.smtp) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: {
          user: this.config.smtp.user,
          pass: this.config.smtp.pass,
        },
      });

      // Verify connection
      try {
        await this.transporter.verify();
        console.log('[Email] SMTP connection verified');
      } catch (error: any) {
        console.warn(`[Email] SMTP connection failed: ${error.message}`);
      }
    }
  }

  async send(email: Email): Promise<EmailResult> {
    if (!this.transporter) {
      await this.init();
    }

    if (!this.transporter) {
      return { success: false, error: 'Email not configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: this.config.from,
        to: Array.isArray(email.to) ? email.to.join(', ') : email.to,
        cc: email.cc ? (Array.isArray(email.cc) ? email.cc.join(', ') : email.cc) : undefined,
        bcc: email.bcc ? (Array.isArray(email.bcc) ? email.bcc.join(', ') : email.bcc) : undefined,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
      });

      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendTemplate(
    to: string | string[],
    template: 'task_complete' | 'approval_needed' | 'error_report' | 'daily_summary',
    data: Record<string, any>
  ): Promise<EmailResult> {
    const templates: Record<string, (data: any) => { subject: string; html: string }> = {
      task_complete: (d) => ({
        subject: `✅ Task Completed: ${d.taskName}`,
        html: `
          <h2>Task Completed</h2>
          <p><strong>Task:</strong> ${d.taskName}</p>
          <p><strong>Duration:</strong> ${d.duration}</p>
          <p><strong>Result:</strong> ${d.result}</p>
          ${d.details ? `<pre>${d.details}</pre>` : ''}
        `,
      }),
      approval_needed: (d) => ({
        subject: `⚠️ Approval Needed: ${d.action}`,
        html: `
          <h2>Approval Required</h2>
          <p><strong>Action:</strong> ${d.action}</p>
          <p><strong>Reason:</strong> ${d.reason}</p>
          <p><strong>Impact:</strong> ${d.impact}</p>
          <p><a href="${d.approveUrl}">Approve</a> | <a href="${d.rejectUrl}">Reject</a></p>
        `,
      }),
      error_report: (d) => ({
        subject: `❌ Error: ${d.taskName}`,
        html: `
          <h2>Error Report</h2>
          <p><strong>Task:</strong> ${d.taskName}</p>
          <p><strong>Error:</strong> ${d.error}</p>
          <pre>${d.stack || ''}</pre>
        `,
      }),
      daily_summary: (d) => ({
        subject: `📊 Daily Summary - ${d.date}`,
        html: `
          <h2>Daily Summary</h2>
          <p><strong>Tasks Completed:</strong> ${d.completed}</p>
          <p><strong>Tasks Failed:</strong> ${d.failed}</p>
          <p><strong>Pending Approvals:</strong> ${d.pending}</p>
          <h3>Highlights</h3>
          <ul>${d.highlights?.map((h: string) => `<li>${h}</li>`).join('') || '<li>No highlights</li>'}</ul>
        `,
      }),
    };

    const tmpl = templates[template];
    if (!tmpl) {
      return { success: false, error: `Unknown template: ${template}` };
    }

    const { subject, html } = tmpl(data);
    return this.send({ to, subject, html });
  }

  isConfigured(): boolean {
    return !!(this.config.smtp?.user && this.config.smtp?.pass);
  }
}

// Singleton
let emailClient: EmailClient | null = null;

export function getEmailClient(): EmailClient {
  if (!emailClient) {
    emailClient = new EmailClient();
  }
  return emailClient;
}
