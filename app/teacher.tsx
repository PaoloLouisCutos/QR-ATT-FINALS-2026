import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { useAuth } from '@/components/AuthProvider';
import { COLORS } from '@/constants/colors';
import { StyledEventQRCode } from '@/components/StyledEventQRCode';
import {
  closeTeacherEvent,
  createEvent,
  deleteEvent,
  getTeacherEvents,
  updateTeacherEvent,
  type Event,
} from '@/lib/events';
import { getEventAttendance } from '@/lib/attendance';
import { buildQRPayload } from '@/lib/qr';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { role, session } = useAuth();
  const canManageAllEvents = role === 'administrator';
  const canManageEvents = role === 'teacher' || canManageAllEvents;
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [attendanceEventId, setAttendanceEventId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Awaited<ReturnType<typeof getEventAttendance>>>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAndroid = Platform.OS === 'android';

  const refreshEvents = useCallback(async () => {
    if (!session || !canManageEvents) {
      setLoadingEvents(false);
      return;
    }
    setLoadingEvents(true);
    try {
      setEvents(await getTeacherEvents(session.user.id, canManageAllEvents));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your events.');
    } finally {
      setLoadingEvents(false);
    }
  }, [canManageAllEvents, canManageEvents, session]);

  useFocusEffect(useCallback(() => {
    void refreshEvents();
  }, [refreshEvents]));

  const resetForm = () => {
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
    setEditingEvent(null);
  };

  const startEditing = (event: Event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setEventId(event.code);
    setVenue(event.venue);
    setDescription(event.description);
    setStartDate(new Date(event.starts_at));
    setEndDate(new Date(event.ends_at));
    setPayload(null);
    setMessage(null);
  };

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = async () => {
    if (!canManageEvents || !session) {
      setMessage('Teacher or administrator access is required to manage events.');
      return;
    }
    const event = {
      code: eventId.trim(),
      title: title.trim(),
      venue: venue.trim(),
      description: description.trim(),
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
    };

    if (!event.code || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      if (editingEvent) {
        await updateTeacherEvent(editingEvent.id, session.user.id, event, canManageAllEvents);
        setEvents((current) => current.map((item) => item.id === editingEvent.id
          ? { ...item, ...event, starts_at: event.startsAt, ends_at: event.endsAt }
          : item));
        setMessage('Event updated.');
        setPayload(null);
        setEditingEvent(null);
      } else {
        const savedEvent = await createEvent({ ...event, createdBy: session.user.id });
        setEvents((current) => [savedEvent, ...current]);
        setMessage('Event saved. Scan this QR code to record attendance.');
        setPayload(buildQRPayload({
          event: savedEvent.code,
          title: savedEvent.title,
          start: savedEvent.starts_at,
          end: savedEvent.ends_at,
        }));
        setTitle('');
        setEventId('');
        setVenue('');
        setDescription('');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not save event: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCloseEvent = async (event: Event) => {
    if (!session || event.status === 'closed') return;
    setBusy(true);
    setMessage(null);
    try {
      await closeTeacherEvent(event.id, session.user.id, canManageAllEvents);
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, status: 'closed' } : item));
      setMessage(`"${event.title}" is closed. Attendance can no longer be recorded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not close the event.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    if (!session) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteEvent(event.id, session.user.id, canManageAllEvents);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      if (attendanceEventId === event.id) {
        setAttendanceEventId(null);
        setAttendees([]);
      }
      setMessage(`"${event.title}" and its attendance records were deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete the event.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAttendance = async (eventId: string) => {
    if (attendanceEventId === eventId) {
      setAttendanceEventId(null);
      return;
    }
    setAttendanceEventId(eventId);
    setLoadingAttendance(true);
    setMessage(null);
    try {
      setAttendees(await getEventAttendance(eventId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load attendance records.');
    } finally {
      setLoadingAttendance(false);
    }
  };

  if (!role) {
    return <View style={styles.container}><Text style={styles.message}>Loading account...</Text></View>;
  }

  if (!canManageEvents) {
    return <View style={styles.container}><Text style={styles.message}>Teacher or administrator access is required to manage events.</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loadingEvents} onRefresh={refreshEvents} />}
    >
      <Text style={styles.title}>{canManageAllEvents ? 'Manage Events' : 'Create Event QR'}</Text>
      <Text style={styles.subtitle}>
        Create, update, or close events, view attendance, and generate QR codes.
      </Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Venue</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="e.g. Main Hall"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="What is this event about?"
        placeholderTextColor={COLORS.textSecondary}
        multiline
      />

      <Text style={styles.label}>Starts</Text>
      <PickerField
        value={formatDateTime(startDate)}
        icon="sunny-outline"
        onPress={() => openPicker('start')}
      />

      <Text style={styles.label}>Ends</Text>
      <PickerField
        value={formatDateTime(endDate)}
        icon="moon-outline"
        onPress={() => openPicker('end')}
      />
      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={styles.chip}
            onPress={() => handleQuickEnd(option.ms)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Tap a chip to set the end time from start.</Text>

      {message && <Text style={styles.message}>{message}</Text>}

      <AppButton
        theme="primary"
        title={busy ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}
        icon={editingEvent ? 'save-outline' : 'add-circle-outline'}
        onPress={handleCreateEvent}
        disabled={busy}
      />
      {editingEvent && (
        <AppButton title="Cancel Edit" icon="close-outline" onPress={resetForm} disabled={busy} />
      )}

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      )}

      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>
          <View style={styles.qrBox}>
            <StyledEventQRCode value={payload} size={200} />
          </View>
          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Your Events</Text>
      {loadingEvents ? (
        <Text style={styles.emptyText}>Loading your events...</Text>
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>You have not created any events yet.</Text>
      ) : events.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <View style={styles.eventHeading}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={[styles.status, event.status === 'closed' && styles.closedStatus]}>
              {event.status === 'open' ? 'Open' : 'Closed'}
            </Text>
          </View>
          <Text style={styles.eventDetail}>Code: {event.code}</Text>
          <Text style={styles.eventDetail}>
            {event.attendeeCount ?? 0} attendance record{event.attendeeCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.eventDetail}>{formatDateTime(new Date(event.starts_at))} – {formatDateTime(new Date(event.ends_at))}</Text>
          {event.venue ? <Text style={styles.eventDetail}>Venue: {event.venue}</Text> : null}
          {event.description ? <Text style={styles.eventDetail}>{event.description}</Text> : null}
          <View style={styles.eventActions}>
            <Pressable style={styles.actionButton} onPress={() => startEditing(event)} disabled={busy}>
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => void toggleAttendance(event.id)} disabled={loadingAttendance}>
              <Text style={styles.actionText}>{attendanceEventId === event.id ? 'Hide attendance' : 'View attendance'}</Text>
            </Pressable>
            {event.status === 'open' && (
              <Pressable
                style={[styles.actionButton, styles.closeAction]}
                disabled={busy}
                onPress={() => Alert.alert('Close event?', 'Students will no longer be able to record attendance.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Close event', style: 'destructive', onPress: () => { void handleCloseEvent(event); } },
                ])}
              >
                <Text style={styles.closeActionText}>Close</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.actionButton, styles.deleteAction]}
              disabled={busy}
              onPress={() => Alert.alert('Delete event?', `Delete "${event.title}" and its attendance records?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { void handleDeleteEvent(event); } },
              ])}
            >
              <Text style={styles.deleteActionText}>Delete</Text>
            </Pressable>
          </View>
          {attendanceEventId === event.id && (
            <View style={styles.attendanceList}>
              <Text style={styles.eventDetail}>
                {loadingAttendance ? 'Loading attendance...' : `${attendees.length} attendance record${attendees.length === 1 ? '' : 's'}`}
              </Text>
              {!loadingAttendance && attendees.length === 0 && <Text style={styles.eventDetail}>No students have checked in.</Text>}
              {attendees.map((attendee) => (
                <Text key={attendee.id} style={styles.eventDetail}>
                  {attendee.studentName} · {attendee.status} · {new Date(attendee.scannedAt).toLocaleString()}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 48,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  multilineInput: { minHeight: 84, textAlignVertical: 'top' },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: COLORS.textPrimary, marginTop: 26, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: 16 },
  eventCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12 },
  eventHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  eventTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  status: { color: '#18794E', fontWeight: '700', fontSize: 12 },
  closedStatus: { color: '#B3261E' },
  eventDetail: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  eventActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: COLORS.surface },
  actionText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  closeAction: { backgroundColor: '#FFF2D9' },
  closeActionText: { color: '#8A5A00', fontWeight: '700', fontSize: 12 },
  deleteAction: { backgroundColor: '#FCE8E6' },
  deleteActionText: { color: '#B3261E', fontWeight: '700', fontSize: 12 },
  attendanceList: { borderTopWidth: 1, borderColor: COLORS.border, marginTop: 12, paddingTop: 10 },
});
