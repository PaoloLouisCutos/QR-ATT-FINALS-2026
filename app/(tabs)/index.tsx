import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { useAuth } from '@/components/AuthProvider';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { getAvailableEvents, type Event } from '@/lib/events';

export default function Index() {
  const { profile, role } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    if (role !== 'student') return;
    setLoadingEvents(true);
    setEventError(null);
    try {
      setEvents(await getAvailableEvents());
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'Could not load available events.');
    } finally {
      setLoadingEvents(false);
    }
  }, [role]);

  useFocusEffect(useCallback(() => {
    void refreshEvents();
  }, [refreshEvents]));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loadingEvents} onRefresh={refreshEvents} />}
      >
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.bodyContainer}>
          <Text style={styles.mainTitle}>School Event Attendance</Text>
          <Text style={styles.subtitle}>
            Scan QR Codes to record attendance during school activities.
          </Text>
        </View>

        <View style={styles.footerContainer}>
          {role === 'student' && (
            <View style={styles.eventsSection}>
              <Text style={styles.sectionTitle}>Available Events</Text>
              {eventError && <Text accessibilityRole="alert" style={styles.eventError}>{eventError}</Text>}
              {loadingEvents && events.length === 0 ? (
                <Text style={styles.eventEmpty}>Loading available events...</Text>
              ) : events.length === 0 ? (
                <Text style={styles.eventEmpty}>No open events are available right now.</Text>
              ) : events.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventDetail}>
                    {new Date(event.starts_at).toLocaleString()} – {new Date(event.ends_at).toLocaleString()}
                  </Text>
                  {event.venue ? <Text style={styles.eventDetail}>Venue: {event.venue}</Text> : null}
                  {event.description ? <Text style={styles.eventDetail}>{event.description}</Text> : null}
                  <Text style={styles.eventStatus}>
                    {Date.now() < new Date(event.starts_at).getTime() ? 'Upcoming' : 'Open for attendance'}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push('/scan')}
          />
          <AppButton
            title="Attendance History"
            icon="time-outline"
            onPress={() => router.push('/history')}
          />
          <AppButton
            title="Profile"
            icon="person-outline"
            onPress={() => router.push('/profile')}
          />
          {(profile?.role === 'teacher' || profile?.role === 'administrator') && (
            <AppButton
              theme="primary"
              title="Create Event QR"
              icon="school-outline"
              onPress={() => router.push('/teacher')}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingVertical: 20 },
  headerContainer: { justifyContent: 'center', width: '100%', alignItems: 'center' },
  bodyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
    marginBottom: 18,
    width: '90%',
    maxWidth: 560,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mainTitle: { fontSize: 21, fontWeight: '800', color: COLORS.primary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },
  footerContainer: { alignItems: 'center', paddingHorizontal: 24, width: '100%', maxWidth: 620 },
  eventsSection: { width: '100%', marginBottom: 16 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '800', marginBottom: 12 },
  eventCard: { width: '100%', backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 5 },
  eventDetail: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  eventStatus: { color: COLORS.primary, fontSize: 12, fontWeight: '800', marginTop: 10, backgroundColor: COLORS.surface, alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  eventEmpty: { color: COLORS.textSecondary, textAlign: 'center', marginVertical: 14 },
  eventError: { color: '#B71C1C', marginBottom: 8 },
});
