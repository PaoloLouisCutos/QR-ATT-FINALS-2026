import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/components/AuthProvider';
import { COLORS } from '@/constants/colors';
import {
  getAvailableEvents,
  getTeacherEvents,
  type Event,
} from '@/lib/events';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function EventsScreen() {
  const { role, session } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    if (!session || !role) return;
    setLoading(true);
    setError(null);
    try {
      const records = role === 'student'
        ? await getAvailableEvents()
        : await getTeacherEvents(session.user.id, role === 'administrator');
      setEvents(records);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, [role, session]);

  useFocusEffect(useCallback(() => {
    void refreshEvents();
  }, [refreshEvents]));

  const isStudent = role === 'student';
  const title = isStudent ? 'Available Events' : role === 'administrator' ? 'All Events' : 'Your Events';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshEvents} />}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {isStudent
          ? 'Browse open school events and scan an event QR code to check in.'
          : role === 'administrator'
            ? 'Review events created across the school.'
            : 'Review the events you have created and their attendance.'}
      </Text>

      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading && events.length === 0 ? (
        <Text style={styles.empty}>Loading events...</Text>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>
          {isStudent ? 'No open events are available right now.' : 'No events to show yet.'}
        </Text>
      ) : events.map((event) => {
        const upcoming = Date.now() < new Date(event.starts_at).getTime();
        return (
          <View key={event.id} style={styles.eventCard}>
            <View style={styles.eventHeading}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={[styles.status, event.status === 'closed' && styles.closedStatus]}>
                {event.status === 'closed' ? 'Closed' : upcoming ? 'Upcoming' : 'Open'}
              </Text>
            </View>
            <Text style={styles.detail}>Code: {event.code}</Text>
            <Text style={styles.detail}>Starts: {formatDateTime(event.starts_at)}</Text>
            <Text style={styles.detail}>Ends: {formatDateTime(event.ends_at)}</Text>
            {event.venue ? <Text style={styles.detail}>Venue: {event.venue}</Text> : null}
            {event.description ? <Text style={styles.detail}>{event.description}</Text> : null}
            {!isStudent && (
              <Text style={styles.detail}>
                {event.attendeeCount ?? 0} attendance record{event.attendeeCount === 1 ? '' : 's'}
              </Text>
            )}
          </View>
        );
      })}

      {isStudent && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/scan')}
          style={styles.scanButton}
        >
          <Text style={styles.scanButtonText}>Scan Event QR</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 22, paddingBottom: 42, width: '100%', maxWidth: 900, alignSelf: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 29, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  eventCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  eventHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  status: { color: COLORS.primary, fontSize: 12, fontWeight: '800', backgroundColor: COLORS.surface, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  closedStatus: { color: COLORS.textSecondary },
  detail: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: 24 },
  error: { color: '#B3261E', marginBottom: 12 },
  scanButton: { backgroundColor: COLORS.primary, borderRadius: 18, alignItems: 'center', padding: 16, marginTop: 8, shadowColor: COLORS.shadow, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  scanButtonText: { color: COLORS.textOnPrimary, fontSize: 15, fontWeight: '800' },
});
