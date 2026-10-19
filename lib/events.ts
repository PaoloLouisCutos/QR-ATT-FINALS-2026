import { supabase } from '@/lib/supabase';

export type Event = {
  id: string;
  code: string;
  title: string;
  venue: string;
  description: string;
  starts_at: string;
  ends_at: string;
  status: 'open' | 'closed';
  created_by: string;
  created_at: string;
  attendeeCount?: number;
};

export type EventDetailsInput = {
  code: string;
  title: string;
  venue: string;
  description: string;
  startsAt: string;
  endsAt: string;
};

export type CreateEventInput = EventDetailsInput & {
  createdBy: string;
};

function validateEventDetails(input: EventDetailsInput) {
  if (!input.title.trim() || !input.code.trim()) {
    throw new Error('Event title and code are required.');
  }
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new Error('Enter valid event start and end times.');
  }
  if (endsAt <= startsAt) {
    throw new Error('End time must be after start time.');
  }
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  if (!input.createdBy) {
    throw new Error('No signed-in user was found. Sign out and sign in again.');
  }
  validateEventDetails(input);

  const { data, error } = await supabase
    .from('events')
    .insert({
      code: input.code.trim(),
      title: input.title.trim(),
      venue: input.venue.trim(),
      description: input.description.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error?.code === '42501') {
    throw new Error('Your account is not authorized to create events. Ask an administrator to check your role.');
  }
  if (error?.code === '23505') {
    throw new Error('This event code already exists. Choose a different code.');
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    throw new Error('The events table is missing in Supabase. Open the Supabase SQL Editor and run supabase/schema.sql.');
  }
  if (error) {
    throw new Error(`Supabase could not create the event (${error.code ?? 'unknown'}): ${error.message}`);
  }
  return data as Event;
}

export async function getEventByCode(code: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

export async function getTeacherEvents(
  teacherId: string,
  canManageAll = false
): Promise<Event[]> {
  let query = supabase
    .from('events')
    .select('*, attendance(count)')
    .order('starts_at', { ascending: false });
  if (!canManageAll) query = query.eq('created_by', teacherId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    attendeeCount: row.attendance?.[0]?.count ?? 0,
  })) as Event[];
}

export async function getAvailableEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'open')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function updateTeacherEvent(
  eventId: string,
  teacherId: string,
  input: EventDetailsInput,
  canManageAll = false
): Promise<void> {
  validateEventDetails(input);

  let query = supabase
    .from('events')
    .update({
      code: input.code.trim(),
      title: input.title.trim(),
      venue: input.venue.trim(),
      description: input.description.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    })
    .eq('id', eventId);
  if (!canManageAll) query = query.eq('created_by', teacherId);
  const { error } = await query
    .select('id')
    .single();
  if (error) throw error;
}

export async function closeTeacherEvent(
  eventId: string,
  teacherId: string,
  canManageAll = false
): Promise<void> {
  let query = supabase
    .from('events')
    .update({ status: 'closed' })
    .eq('id', eventId);
  if (!canManageAll) query = query.eq('created_by', teacherId);
  const { error } = await query
    .select('id')
    .single();
  if (error) throw error;
}

export async function deleteEvent(
  eventId: string,
  teacherId: string,
  canManageAll = false
): Promise<void> {
  let query = supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (!canManageAll) query = query.eq('created_by', teacherId);
  const { error } = await query
    .select('id')
    .single();
  if (error) throw error;
}