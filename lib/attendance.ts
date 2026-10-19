import { supabase } from '@/lib/supabase';
import { getEventByCode } from '@/lib/events';
import { parseQRPayload } from '@/lib/qr';

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventEndsAt: string;
  scannedAt: string;
  status: 'present';
};

export async function registerAttendance(rawPayload: string, studentId: string): Promise<RegisterResult> {
  let payload;
  try {
    payload = parseQRPayload(rawPayload);
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Invalid QR code.' };
  }

  const event = await getEventByCode(payload.event);
  if (!event) return { success: false, message: 'Event not found.' };
  if (event.status !== 'open') {
    return { success: false, message: 'This event is closed.', eventTitle: event.title };
  }

  const now = Date.now();
  if (now < new Date(event.starts_at).getTime()) {
    return { success: false, message: 'Event has not started yet.', eventTitle: event.title };
  }
  if (now > new Date(event.ends_at).getTime()) {
    return { success: false, message: 'Event has already ended.', eventTitle: event.title };
  }

  const { error } = await supabase.from('attendance').insert({
    event_id: event.id,
    student_id: studentId,
  });
  if (error?.code === '23505') {
    return { success: false, message: 'Already registered for this event.', eventTitle: event.title };
  }
  if (error?.code === 'P0001') {
    const messages: Record<string, string> = {
      attendance_unauthorized: 'Only the signed-in student can record their own attendance.',
      attendance_event_not_found: 'Event not found.',
      attendance_event_closed: 'This event is closed.',
      attendance_event_not_started: 'Event has not started yet.',
      attendance_event_ended: 'Event has already ended.',
    };
    return {
      success: false,
      message: messages[error.message] ?? 'Attendance could not be validated.',
      eventTitle: event.title,
    };
  }
  if (error?.code === '42501') {
    return { success: false, message: 'Your account is not authorized to record attendance.', eventTitle: event.title };
  }
  if (error) return { success: false, message: error.message, eventTitle: event.title };
  return { success: true, message: 'Attendance recorded!', eventTitle: event.title };
}

export async function getAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, status, events!inner(id, title, ends_at)')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    eventId: row.events.id,
    eventTitle: row.events.title,
    eventEndsAt: row.events.ends_at,
    scannedAt: row.scanned_at,
    status: row.status,
  }));
}

export async function getEventAttendance(eventId: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, status, profiles!inner(id, full_name)')
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    studentId: row.profiles.id,
    studentName: row.profiles.full_name,
    scannedAt: row.scanned_at,
    status: row.status,
  }));
}

export type TeacherEventSummary = {
  id: string;
  code: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  description: string;
  status: 'open' | 'closed';
  attendeeCount: number;
};

export async function getTeacherEventSummaries(teacherId: string): Promise<TeacherEventSummary[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, code, title, starts_at, ends_at, venue, description, status, attendance(count)')
    .eq('created_by', teacherId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venue: row.venue,
    description: row.description,
    status: row.status,
    attendeeCount: row.attendance?.[0]?.count ?? 0,
  }));
}