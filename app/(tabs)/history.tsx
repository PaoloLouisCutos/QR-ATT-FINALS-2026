import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/components/AuthProvider';
import { COLORS } from '@/constants/colors';
import { deleteEvent } from '@/lib/events';
import {
  getAttendanceHistory,
  getTeacherEventSummaries,
  type AttendanceRecord,
  type TeacherEventSummary,
} from '@/lib/attendance';

export default function HistoryScreen() {
  const { session, profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<TeacherEventSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    setError(null);
    try {
      if (profile?.role === 'student') {
        setRecords(await getAttendanceHistory(session.user.id));
      } else if (profile?.role === 'teacher') {
        setEvents(await getTeacherEventSummaries(session.user.id));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load history.');
    } finally {
      setRefreshing(false);
    }
  }, [profile?.role, session]);

  const deleteTeacherEvent = useCallback(async (eventId: string) => {
    if (!session) return;
    setDeletingEventId(eventId);
    setError(null);
    try {
      await deleteEvent(eventId, session.user.id);
      setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete event.');
    } finally {
      setDeletingEventId(null);
    }
  }, [session]);

  useFocusEffect(useCallback(() => {
    void refreshHistory();
  }, [refreshHistory]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh history"
          accessibilityState={{ disabled: refreshing }}
          disabled={refreshing}
          hitSlop={8}
          onPress={refreshHistory}
          style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
        >
          <Ionicons name="refresh-outline" size={20} color={COLORS.textPrimary} />
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {profile?.role === 'teacher' ? (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshHistory} />}
          contentContainerStyle={events.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.subtitle}>Your created events will appear here.</Text>}
          renderItem={({ item }) => (
            <View style={styles.record}>
              <View style={styles.teacherRow}>
                <View style={styles.teacherDetails}>
                  <Text style={styles.recordTitle}>{item.title}</Text>
                  <Text style={styles.recordDetail}>Code: {item.code}</Text>
                  <Text style={styles.recordDetail}>Status: {item.status}</Text>
                  <Text style={styles.recordDetail}>{item.attendeeCount} attendee{item.attendeeCount === 1 ? '' : 's'}</Text>
                  <Text style={styles.recordDetail}>{new Date(item.startsAt).toLocaleString()}</Text>
                  {item.venue ? <Text style={styles.recordDetail}>Venue: {item.venue}</Text> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title}`}
                  accessibilityState={{ disabled: deletingEventId === item.id }}
                  disabled={deletingEventId === item.id}
                  onPress={() => Alert.alert(
                    'Delete event?',
                    `Delete "${item.title}"? Its attendance records will also be removed.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => { void deleteTeacherEvent(item.id); } },
                    ],
                  )}
                  style={[styles.deleteButton, deletingEventId === item.id && styles.refreshButtonDisabled]}
                >
                  <Ionicons name="trash-outline" size={20} color="#B71C1C" />
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshHistory} />}
          contentContainerStyle={records.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.subtitle}>Your past attendance records will appear here.</Text>}
          renderItem={({ item }) => (
            <View style={styles.record}>
              <View style={styles.historyRow}>
                <View style={styles.historyDetails}>
                  <Text style={styles.recordTitle}>{item.eventTitle}</Text>
                  <Text style={styles.recordDetail}>{new Date(item.scannedAt).toLocaleString()}</Text>
                  <Text style={styles.recordDetail}>Status: {item.status}</Text>
                </View>
              {now >= new Date(item.eventEndsAt).getTime() && (
                  <Text style={styles.expired}>Expired</Text>
              )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 22, paddingTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 25, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  refreshButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  refreshButtonDisabled: { opacity: 0.5 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teacherDetails: { flex: 1, minWidth: 0 },
  deleteButton: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  list: { paddingBottom: 24 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  record: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDetails: { flex: 1, minWidth: 0 },
  recordTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  recordDetail: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: 2 },
  expired: { fontSize: 13, fontWeight: '600', color: '#B71C1C', marginLeft: 12 },
  error: { color: '#B71C1C', marginBottom: 12 },
});
