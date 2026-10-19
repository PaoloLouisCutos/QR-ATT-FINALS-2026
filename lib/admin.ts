import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/profiles';

export type AdminUser = {
  id: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
};

export type AdminEvent = {
  id: string;
  code: string;
  title: string;
  venue: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'closed';
  createdBy: string;
  attendeeCount: number;
};

export type AdminAttendance = {
  id: string;
  eventId: string;
  eventTitle: string;
  studentId: string;
  studentName: string;
  scannedAt: string;
  status: 'present';
};

export type AdminEventsResult = {
  events: AdminEvent[];
  attendeeCountsError: string | null;
};

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role as UserRole,
    createdAt: row.created_at,
  }));
}

export async function getAdminEvents(): Promise<AdminEventsResult> {
  const { data, error } = await supabase
    .from('events')
    .select('id, code, title, venue, description, starts_at, ends_at, status, created_by')
    .order('starts_at', { ascending: false });
  if (error) throw error;

  const events = (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    venue: row.venue,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    createdBy: row.created_by,
    attendeeCount: 0,
  }));
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from('attendance')
    .select('event_id');

  if (attendanceError) {
    return {
      events,
      attendeeCountsError: attendanceError.message,
    };
  }

  const attendeeCounts = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendeeCounts.set(row.event_id, (attendeeCounts.get(row.event_id) ?? 0) + 1);
  }
  return {
    events: events.map((event) => ({
      ...event,
      attendeeCount: attendeeCounts.get(event.id) ?? 0,
    })),
    attendeeCountsError: null,
  };
}

export async function getAdminAttendance(): Promise<AdminAttendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, event_id, student_id, scanned_at, status, profiles!inner(full_name), events!inner(title)')
    .order('scanned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: row.events[0]?.title ?? 'Unknown event',
    studentId: row.student_id,
    studentName: row.profiles[0]?.full_name ?? 'Unknown student',
    scannedAt: row.scanned_at,
    status: row.status,
  }));
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id')
    .single();
  if (error) throw error;
}

export async function updateEventDetails(
  eventId: string,
  details: {
    title: string;
    code: string;
    venue: string;
    description: string;
    startsAt: string;
    endsAt: string;
  }
): Promise<void> {
  if (!details.title.trim() || !details.code.trim()) {
    throw new Error('Event title and code are required.');
  }
  const startsAt = new Date(details.startsAt).getTime();
  const endsAt = new Date(details.endsAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new Error('Enter valid event start and end times.');
  }
  if (endsAt <= startsAt) {
    throw new Error('End time must be after start time.');
  }

  const { error } = await supabase
    .from('events')
    .update({
      title: details.title.trim(),
      code: details.code.trim(),
      venue: details.venue.trim(),
      description: details.description.trim(),
      starts_at: details.startsAt,
      ends_at: details.endsAt,
    })
    .eq('id', eventId)
    .select('id')
    .single();
  if (error) throw error;
}

export async function closeAdminEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'closed' })
    .eq('id', eventId)
    .select('id')
    .single();
  if (error) throw error;
}

export async function deleteAdminEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId).select('id').single();
  if (error) throw error;
}

export async function updateAttendanceTime(attendanceId: string, scannedAt: string): Promise<void> {
  const date = new Date(scannedAt);
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.');

  const { error } = await supabase
    .from('attendance')
    .update({ scanned_at: date.toISOString() })
    .eq('id', attendanceId)
    .select('id')
    .single();
  if (error) throw error;
}

export async function deleteAttendanceRecord(attendanceId: string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('id', attendanceId).select('id').single();
  if (error) throw error;
}
