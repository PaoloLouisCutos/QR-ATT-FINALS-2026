import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/components/AuthProvider';
import { COLORS } from '@/constants/colors';
import { StyledEventQRCode } from '@/components/StyledEventQRCode';
import {
  closeAdminEvent,
  deleteAdminEvent,
  deleteAttendanceRecord,
  getAdminAttendance,
  getAdminEvents,
  getAdminUsers,
  updateAttendanceTime,
  updateEventDetails,
  updateUserRole,
  type AdminAttendance,
  type AdminEvent,
  type AdminUser,
} from '@/lib/admin';
import { buildQRPayload } from '@/lib/qr';
import { createEvent } from '@/lib/events';
import type { UserRole } from '@/lib/profiles';

type Section = 'users' | 'events' | 'attendance' | 'reports';
type DeleteTarget = { type: 'event' | 'attendance'; id: string } | null;

const SECTIONS: { id: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'users', label: 'Users', icon: 'people-outline' },
  { id: 'events', label: 'Events', icon: 'calendar-outline' },
  { id: 'attendance', label: 'Attendance', icon: 'checkmark-done-outline' },
  { id: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
];
const ROLES: UserRole[] = ['student', 'teacher', 'administrator'];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminScreen() {
  const { role, profile, session, profileLoading, profileError, refreshProfile } = useAuth();
  const [section, setSection] = useState<Section>('users');
  const [data, setData] = useState<{ users: AdminUser[]; events: AdminEvent[]; attendance: AdminAttendance[] }>({
    users: [],
    events: [],
    attendance: [],
  });
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [attendeeCountsError, setAttendeeCountsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [createdEventQR, setCreatedEventQR] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [editScannedAt, setEditScannedAt] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const attendance = await getAdminAttendance();
      setData((current) => ({ ...current, attendance }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load attendance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const result = await getAdminEvents();
      setData((current) => ({ ...current, events: result.events }));
      setAttendeeCountsError(result.attendeeCountsError);
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : 'Could not load events.');
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const users = await getAdminUsers();
      setData((current) => ({ ...current, users }));
    } catch (error) {
      setUsersError(
        error instanceof Error
          ? error.message
          : 'Could not load users. Verify that the administrator profile policy is installed in Supabase.'
      );
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (role === 'administrator') void refresh();
    if (role === 'administrator') void refreshUsers();
    if (role === 'administrator') void refreshEvents();
    void refreshProfile();
  }, [refresh, refreshEvents, refreshProfile, refreshUsers, role]));

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      await Promise.all([refresh(), refreshUsers(), refreshEvents()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The requested change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const createAdministratorEvent = async () => {
    if (!session || !eventTitle.trim() || !eventCode.trim()) {
      setMessage('Enter an event title and code.');
      return;
    }
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    await runAction(async () => {
      const event = await createEvent({
        code: eventCode.trim(),
        title: eventTitle.trim(),
        venue: eventVenue.trim(),
        description: eventDescription.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        createdBy: session.user.id,
      });
      setCreatedEventQR(buildQRPayload({
        event: event.code,
        title: event.title,
        start: event.starts_at,
        end: event.ends_at,
      }));
      setEventTitle('');
      setEventCode('');
      setEventVenue('');
      setEventDescription('');
    }, 'Event created. It is scheduled for the next hour.');
  };

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.users.filter((user) =>
      !term ||
      user.fullName.toLowerCase().includes(term) ||
      user.id.toLowerCase().includes(term) ||
      user.role.includes(term)
    );
  }, [data.users, query]);

  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.events.filter((event) =>
      !term || event.title.toLowerCase().includes(term) || event.code.toLowerCase().includes(term)
    );
  }, [data.events, query]);

  const filteredAttendance = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.attendance.filter((record) =>
      !term || record.studentName.toLowerCase().includes(term) || record.eventTitle.toLowerCase().includes(term)
    );
  }, [data.attendance, query]);

  if (profileLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>Checking administrator access...</Text>
      </View>
    );
  }

  if (role !== 'administrator') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={COLORS.primary} />
        <Text style={styles.denied}>Administrator access is required.</Text>
        <Text style={styles.accessHelp}>
          This app checks the role in your Supabase public.profiles table for the signed-in account.
          {profile ? ` Your current role is "${profile.role}".` : ''}
        </Text>
        {profileError && <Text style={styles.message}>{profileError}</Text>}
        <Pressable
          accessibilityRole="button"
          style={styles.refreshAccessButton}
          onPress={() => void refreshProfile()}
        >
          <Ionicons name="refresh-outline" size={18} color={COLORS.textOnPrimary} />
          <Text style={styles.refreshAccessText}>Refresh account access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>SYSTEM CONTROL</Text>
      <Text style={styles.title}>Administrator</Text>
      <Text style={styles.subtitle}>Manage accounts, events, and attendance records.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
        {SECTIONS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => {
              setSection(item.id);
              setQuery('');
              setMessage(null);
              if (item.id === 'events') void refreshEvents();
              if (item.id === 'users') void refreshUsers();
            }}
            style={[styles.sectionButton, section === item.id && styles.sectionSelected]}
          >
            <Ionicons name={item.icon} size={17} color={section === item.id ? COLORS.textOnPrimary : COLORS.primary} />
            <Text style={[styles.sectionLabel, section === item.id && styles.sectionLabelSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {section !== 'reports' && (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${section}...`}
          placeholderTextColor={COLORS.textTertiary}
        />
      )}
      {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      {loading ? <Text style={styles.muted}>Loading records...</Text> : null}

      {section === 'users' && (
        <View>
          <View style={styles.headingRow}>
            <Text style={styles.sectionHeading}>All user accounts ({data.users.length})</Text>
            <ActionButton
              title={usersLoading ? 'Refreshing...' : 'Refresh users'}
              disabled={usersLoading}
              onPress={() => void refreshUsers()}
            />
          </View>
          {usersError && (
            <Text accessibilityRole="alert" style={styles.message}>
              {usersError}
              {'\n'}Confirm that the current signed-in account has the administrator role and that the latest supabase/schema.sql policies have been applied.
            </Text>
          )}
          {usersLoading && data.users.length === 0 ? (
            <Text style={styles.muted}>Loading user accounts...</Text>
          ) : filteredUsers.map((user) => {
            const isSelf = user.id === session?.user.id;
            return (
              <View key={user.id} style={styles.card}>
                <Text style={styles.cardTitle}>{user.fullName || 'Unnamed user'}</Text>
                <Text style={styles.meta}>Account ID: {user.id}</Text>
                <Text style={styles.meta}>Joined {formatDate(user.createdAt)}</Text>
                <View style={styles.userRoleHeading}>
                  <Text style={styles.label}>Current role</Text>
                  <Text style={styles.currentRole}>{user.role}</Text>
                </View>
                <Text style={styles.meta}>Change role</Text>
                <View style={styles.roleRow}>
                  {ROLES.map((nextRole) => {
                    const selected = user.role === nextRole;
                    return (
                      <Pressable
                        key={nextRole}
                        disabled={busy || isSelf || selected}
                        onPress={() => void runAction(
                          () => updateUserRole(user.id, nextRole),
                          `${user.fullName}'s role changed to ${nextRole}.`
                        )}
                        style={[styles.roleChip, selected && styles.roleChipSelected, (busy || isSelf) && styles.disabled]}
                      >
                        <Text style={[styles.roleChipText, selected && styles.roleChipTextSelected]}>
                          {nextRole === 'administrator' ? 'Admin' : nextRole[0].toUpperCase() + nextRole.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {isSelf && <Text style={styles.meta}>Your own role is protected from changes here.</Text>}
              </View>
            );
          })}
          {!usersLoading && filteredUsers.length === 0 && (
            <Text style={styles.muted}>
              {usersError
                ? 'User profiles could not be loaded.'
                : data.users.length === 0
                  ? 'No user profiles are available. Run the latest supabase/schema.sql in the Supabase SQL Editor to apply admin visibility and backfill existing accounts.'
                  : 'No matching user profiles found.'}
            </Text>
          )}
        </View>
      )}

      {section === 'events' && (
        <View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create an event</Text>
            <TextInput style={styles.input} value={eventTitle} onChangeText={setEventTitle} placeholder="Event title" placeholderTextColor={COLORS.textTertiary} />
            <TextInput style={styles.input} value={eventCode} onChangeText={setEventCode} placeholder="Unique event code" placeholderTextColor={COLORS.textTertiary} autoCapitalize="characters" />
            <TextInput style={styles.input} value={eventVenue} onChangeText={setEventVenue} placeholder="Venue" placeholderTextColor={COLORS.textTertiary} />
            <TextInput style={[styles.input, styles.multilineInput]} value={eventDescription} onChangeText={setEventDescription} placeholder="Description" placeholderTextColor={COLORS.textTertiary} multiline />
            <ActionButton title={busy ? 'Saving...' : 'Create event'} disabled={busy} onPress={() => void createAdministratorEvent()} />
            <Text style={styles.meta}>New events open now and close automatically after one hour.</Text>
            {createdEventQR && (
              <View style={styles.qrResult}>
                <Text style={styles.meta}>Scan this event QR to record attendance.</Text>
                <StyledEventQRCode value={createdEventQR} size={190} />
              </View>
            )}
          </View>
          <View style={styles.headingRow}>
            <Text style={styles.sectionHeading}>Events ({data.events.length})</Text>
            <ActionButton title={eventsLoading ? 'Refreshing...' : 'Refresh'} disabled={eventsLoading} onPress={() => void refreshEvents()} />
          </View>
          {eventsLoading && data.events.length === 0 && <Text style={styles.muted}>Loading events...</Text>}
          {eventsError && (
            <Text accessibilityRole="alert" style={styles.message}>
              Could not load events: {eventsError}
              {'\n'}If this is a permission error, run the latest supabase/schema.sql in the Supabase SQL Editor and confirm this account has the administrator role.
            </Text>
          )}
          {attendeeCountsError && (
            <Text accessibilityRole="alert" style={styles.message}>
              Events are shown, but attendee counts could not be loaded: {attendeeCountsError}
            </Text>
          )}
          {filteredEvents.map((event) => (
            <View key={event.id} style={styles.card}>
              {editingEvent?.id === event.id ? (
                <>
                  <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Event title" placeholderTextColor={COLORS.textTertiary} />
                  <TextInput style={styles.input} value={editCode} onChangeText={setEditCode} placeholder="Event code" placeholderTextColor={COLORS.textTertiary} autoCapitalize="characters" />
                  <TextInput style={styles.input} value={editVenue} onChangeText={setEditVenue} placeholder="Venue" placeholderTextColor={COLORS.textTertiary} />
                  <TextInput style={[styles.input, styles.multilineInput]} value={editDescription} onChangeText={setEditDescription} placeholder="Description" placeholderTextColor={COLORS.textTertiary} multiline />
                  <TextInput style={styles.input} value={editStartsAt} onChangeText={setEditStartsAt} placeholder="Start time (ISO)" placeholderTextColor={COLORS.textTertiary} autoCapitalize="none" />
                  <TextInput style={styles.input} value={editEndsAt} onChangeText={setEditEndsAt} placeholder="End time (ISO)" placeholderTextColor={COLORS.textTertiary} autoCapitalize="none" />
                  <View style={styles.actionRow}>
                    <ActionButton title="Save changes" disabled={busy} onPress={() => void runAction(
                      async () => {
                        await updateEventDetails(event.id, {
                          title: editTitle,
                          code: editCode,
                          venue: editVenue,
                          description: editDescription,
                          startsAt: editStartsAt,
                          endsAt: editEndsAt,
                        });
                        setEditingEvent(null);
                      },
                      'Event updated.'
                    )} />
                    <ActionButton title="Cancel" onPress={() => setEditingEvent(null)} secondary />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  <Text style={styles.meta}>Code: {event.code} · {event.attendeeCount} attendees · {event.status}</Text>
                  <Text style={styles.meta}>Created by account: {event.createdBy}</Text>
                  {event.venue ? <Text style={styles.meta}>Venue: {event.venue}</Text> : null}
                  {event.description ? <Text style={styles.meta}>{event.description}</Text> : null}
                  <Text style={styles.meta}>Starts {formatDate(event.startsAt)}</Text>
                  <Text style={styles.meta}>Ends {formatDate(event.endsAt)}</Text>
                  <View style={styles.actionRow}>
                    <ActionButton title="Edit" onPress={() => {
                      setEditingEvent(event);
                      setEditTitle(event.title);
                      setEditCode(event.code);
                      setEditVenue(event.venue);
                      setEditDescription(event.description);
                      setEditStartsAt(event.startsAt);
                      setEditEndsAt(event.endsAt);
                    }} />
                    {event.status === 'open' && (
                      <ActionButton title="Close event" disabled={busy} secondary onPress={() => void runAction(
                        () => closeAdminEvent(event.id),
                        'Event closed. Attendance can no longer be recorded.'
                      )} />
                    )}
                    <ActionButton title="Delete" secondary onPress={() => setDeleteTarget({ type: 'event', id: event.id })} />
                  </View>
                </>
              )}
              {deleteTarget?.type === 'event' && deleteTarget.id === event.id && (
                <ConfirmDelete
                  label="Delete this event and its attendance records?"
                  disabled={busy}
                  onCancel={() => setDeleteTarget(null)}
                  onConfirm={() => void runAction(async () => {
                    await deleteAdminEvent(event.id);
                    setDeleteTarget(null);
                  }, 'Event and its attendance records deleted.')}
                />
              )}
            </View>
          ))}
          {!eventsLoading && !eventsError && filteredEvents.length === 0 && (
            <Text style={styles.muted}>
              {data.events.length === 0 ? 'No events are available in the database.' : 'No matching events found.'}
            </Text>
          )}
        </View>
      )}

      {!loading && section === 'attendance' && (
        <View>
          <Text style={styles.sectionHeading}>Attendance records ({data.attendance.length})</Text>
          {filteredAttendance.map((record) => (
            <View key={record.id} style={styles.card}>
              <Text style={styles.cardTitle}>{record.studentName}</Text>
              <Text style={styles.meta}>Event: {record.eventTitle}</Text>
              <Text style={styles.meta}>Student ID: {record.studentId}</Text>
              <Text style={styles.meta}>Status: {record.status}</Text>
              {editingAttendanceId === record.id ? (
                <>
                  <Text style={styles.label}>Scanned at (ISO date/time)</Text>
                  <TextInput
                    style={styles.input}
                    value={editScannedAt}
                    onChangeText={setEditScannedAt}
                    placeholder="2026-10-19T12:00:00.000Z"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="none"
                  />
                  <View style={styles.actionRow}>
                    <ActionButton title="Save correction" disabled={busy} onPress={() => void runAction(async () => {
                      await updateAttendanceTime(record.id, editScannedAt);
                      setEditingAttendanceId(null);
                    }, 'Attendance time corrected.')} />
                    <ActionButton title="Cancel" onPress={() => setEditingAttendanceId(null)} secondary />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.meta}>Scanned {formatDate(record.scannedAt)}</Text>
                  <View style={styles.actionRow}>
                    <ActionButton title="Correct time" onPress={() => {
                      setEditingAttendanceId(record.id);
                      setEditScannedAt(record.scannedAt);
                    }} />
                    <ActionButton title="Delete record" secondary onPress={() => setDeleteTarget({ type: 'attendance', id: record.id })} />
                  </View>
                </>
              )}
              {deleteTarget?.type === 'attendance' && deleteTarget.id === record.id && (
                <ConfirmDelete
                  label="Delete this attendance record?"
                  disabled={busy}
                  onCancel={() => setDeleteTarget(null)}
                  onConfirm={() => void runAction(async () => {
                    await deleteAttendanceRecord(record.id);
                    setDeleteTarget(null);
                  }, 'Attendance record deleted.')}
                />
              )}
            </View>
          ))}
          {filteredAttendance.length === 0 && <Text style={styles.muted}>No matching attendance records found.</Text>}
        </View>
      )}

      {!loading && section === 'reports' && (
        <View>
          <Text style={styles.sectionHeading}>System overview</Text>
          <View style={styles.statsRow}>
            <StatCard label="Users" value={data.users.length} icon="people-outline" />
            <StatCard label="Events" value={data.events.length} icon="calendar-outline" />
            <StatCard label="Attendance" value={data.attendance.length} icon="checkmark-done-outline" />
          </View>
          <Text style={styles.sectionHeading}>Attendance by event</Text>
          {data.events.map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.meta}>{event.code} · {event.attendeeCount} attendance records</Text>
            </View>
          ))}
          {data.events.length === 0 && <Text style={styles.muted}>No event records to report.</Text>}
          <ActionButton title="Refresh report" onPress={() => void refresh()} />
        </View>
      )}

      {profile && <Text style={styles.footer}>Signed in as {profile.full_name}</Text>}
    </ScrollView>
  );
}

function ActionButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, secondary && styles.actionButtonSecondary, disabled && styles.disabled]}
    >
      <Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

function ConfirmDelete({
  label,
  onCancel,
  onConfirm,
  disabled,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.confirmBox}>
      <Text style={styles.confirmText}>{label}</Text>
      <View style={styles.actionRow}>
        <ActionButton title="Confirm delete" disabled={disabled} onPress={onConfirm} secondary />
        <ActionButton title="Cancel" disabled={disabled} onPress={onCancel} />
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={COLORS.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, paddingBottom: 48, width: '100%', maxWidth: 900, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  denied: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 10 },
  accessHelp: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 360, marginHorizontal: 24, marginTop: 8 },
  refreshAccessButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  refreshAccessText: { color: COLORS.textOnPrimary, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: COLORS.textPrimary, fontSize: 31, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 20 },
  sectionRow: { gap: 9, paddingVertical: 4, marginBottom: 14 },
  sectionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, paddingHorizontal: 14 },
  sectionSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sectionLabel: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  sectionLabelSelected: { color: COLORS.textOnPrimary },
  search: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, color: COLORS.textPrimary, marginBottom: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionHeading: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 7, marginBottom: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 12 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 5 },
  meta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  label: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 7 },
  userRoleHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  currentRole: { color: COLORS.textOnPrimary, backgroundColor: COLORS.primary, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 5, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  roleChip: { borderColor: COLORS.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  roleChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleChipText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  roleChipTextSelected: { color: COLORS.textOnPrimary },
  input: { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.textPrimary, marginTop: 9 },
  multilineInput: { minHeight: 78, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 11, marginTop: 4 },
  actionButtonSecondary: { backgroundColor: COLORS.surface },
  actionButtonText: { color: COLORS.textOnPrimary, fontSize: 12, fontWeight: '800' },
  actionButtonTextSecondary: { color: COLORS.primary },
  disabled: { opacity: 0.5 },
  message: { color: COLORS.primary, fontWeight: '700', marginBottom: 10 },
  muted: { color: COLORS.textSecondary, marginVertical: 12 },
  confirmBox: { borderWidth: 1, borderColor: COLORS.accent, borderRadius: 12, padding: 10, marginTop: 12 },
  confirmText: { color: COLORS.textPrimary, fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { flexGrow: 1, minWidth: 100, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, alignItems: 'center' },
  statValue: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 5 },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  footer: { color: COLORS.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 18 },
  qrResult: { alignItems: 'center', gap: 12, marginTop: 16, padding: 16, backgroundColor: COLORS.surfaceLight, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
});
