// Calendar export utilities for coaching sessions

export interface CalendarEvent {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  meetLink?: string;
}

/**
 * Generate iCal (.ics) file content
 */
export function generateICalFile(event: CalendarEvent): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const escapeText = (text: string): string => {
    return text.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
  };

  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@duodrive.app`;
  const now = formatDate(new Date());
  
  let description = event.description;
  if (event.meetLink) {
    description += `\\n\\nJoin meeting: ${event.meetLink}`;
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DuoDrive//Coaching Session//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatDate(event.startTime)}`,
    `DTEND:${formatDate(event.endTime)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : '',
    event.meetLink ? `URL:${event.meetLink}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  return icsContent;
}

/**
 * Download iCal file
 */
export function downloadICalFile(event: CalendarEvent, filename?: string): void {
  const icsContent = generateICalFile(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `duodrive-session-${Date.now()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar URL for quick add
 */
export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const formatGoogleDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  let details = event.description;
  if (event.meetLink) {
    details += `\n\nJoin meeting: ${event.meetLink}`;
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startTime)}/${formatGoogleDate(event.endTime)}`,
    details: details,
    ...(event.location && { location: event.location }),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Open Google Calendar to add event
 */
export function addToGoogleCalendar(event: CalendarEvent): void {
  const url = getGoogleCalendarUrl(event);
  window.open(url, '_blank', 'noopener,noreferrer');
}
