/**
 * Calendar Integration
 * Manage events via Google Calendar API
 */

import { google, calendar_v3 } from 'googleapis';

export interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId?: string;
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date | string;
  end: Date | string;
  attendees?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method: 'email' | 'popup'; minutes: number }>;
  };
}

export interface EventResult {
  success: boolean;
  event?: CalendarEvent & { id: string; htmlLink?: string };
  error?: string;
}

export class CalendarClient {
  private calendar: calendar_v3.Calendar | null = null;
  private config: CalendarConfig;
  private calendarId: string;

  constructor(config?: Partial<CalendarConfig>) {
    this.config = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      ...config,
    };
    this.calendarId = this.config.calendarId || 'primary';
  }

  async init(): Promise<void> {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      console.warn('[Calendar] Google Calendar not configured');
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret
    );

    oauth2Client.setCredentials({
      refresh_token: this.config.refreshToken,
    });

    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log('[Calendar] Google Calendar initialized');
  }

  async createEvent(event: CalendarEvent): Promise<EventResult> {
    if (!this.calendar) {
      await this.init();
    }

    if (!this.calendar) {
      return { success: false, error: 'Calendar not configured' };
    }

    try {
      const startDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
      const endDate = typeof event.end === 'string' ? new Date(event.end) : event.end;

      const result = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: {
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: {
            dateTime: startDate.toISOString(),
            timeZone: 'Europe/Rome',
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: 'Europe/Rome',
          },
          attendees: event.attendees?.map(email => ({ email })),
          reminders: event.reminders || { useDefault: true },
        },
      });

      return {
        success: true,
        event: {
          id: result.data.id!,
          summary: result.data.summary!,
          description: result.data.description || undefined,
          start: result.data.start?.dateTime || result.data.start?.date!,
          end: result.data.end?.dateTime || result.data.end?.date!,
          htmlLink: result.data.htmlLink || undefined,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async listEvents(options?: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
  }): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }> {
    if (!this.calendar) {
      await this.init();
    }

    if (!this.calendar) {
      return { success: false, error: 'Calendar not configured' };
    }

    try {
      const result = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: (options?.timeMin || new Date()).toISOString(),
        timeMax: options?.timeMax?.toISOString(),
        maxResults: options?.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events: CalendarEvent[] = (result.data.items || []).map(item => ({
        id: item.id!,
        summary: item.summary || 'No title',
        description: item.description || undefined,
        location: item.location || undefined,
        start: item.start?.dateTime || item.start?.date!,
        end: item.end?.dateTime || item.end?.date!,
      }));

      return { success: true, events };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getUpcoming(hours: number = 24): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }> {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return this.listEvents({ timeMin: now, timeMax: future });
  }

  async deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.calendar) {
      await this.init();
    }

    if (!this.calendar) {
      return { success: false, error: 'Calendar not configured' };
    }

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async findFreeSlot(
    duration: number, // minutes
    options?: { withinHours?: number; startHour?: number; endHour?: number }
  ): Promise<{ success: boolean; slot?: { start: Date; end: Date }; error?: string }> {
    const events = await this.getUpcoming(options?.withinHours || 48);
    if (!events.success) {
      return { success: false, error: events.error };
    }

    const startHour = options?.startHour || 9;
    const endHour = options?.endHour || 18;
    const now = new Date();

    // Simple slot finder - find first gap
    let checkTime = new Date(now);
    if (checkTime.getHours() < startHour) {
      checkTime.setHours(startHour, 0, 0, 0);
    }

    const busyTimes = (events.events || []).map(e => ({
      start: new Date(e.start),
      end: new Date(e.end),
    }));

    for (let i = 0; i < 48 * 60; i += 15) { // Check every 15 min for 48h
      const slotStart = new Date(checkTime.getTime() + i * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

      if (slotStart.getHours() < startHour || slotEnd.getHours() > endHour) {
        continue;
      }

      const isConflict = busyTimes.some(busy =>
        (slotStart >= busy.start && slotStart < busy.end) ||
        (slotEnd > busy.start && slotEnd <= busy.end)
      );

      if (!isConflict) {
        return { success: true, slot: { start: slotStart, end: slotEnd } };
      }
    }

    return { success: false, error: 'No free slot found' };
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.refreshToken);
  }
}

// Singleton
let calendarClient: CalendarClient | null = null;

export function getCalendarClient(): CalendarClient {
  if (!calendarClient) {
    calendarClient = new CalendarClient();
  }
  return calendarClient;
}
