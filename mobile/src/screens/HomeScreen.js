import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import LocationService from '../services/locationService';

export default function HomeScreen({ user, onLogout }) {
  const [tripId, setTripId] = useState(null);
  const [loading, setLoading] = useState(false);

  // لو التطبيق رجع من الخلفية، حاول نفضي أي مواقع متراكمة في الطابور
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') LocationService.flushQueue().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  async function handleStartTrip() {
    setLoading(true);
    try {
      await LocationService.requestPermissions();
      const { data } = await api.post('/trips/start');
      setTripId(data.trip.id);
      await LocationService.startTracking(data.trip.id);
      Alert.alert('تم', 'بدأت الرحلة وجاري تتبع موقعك كل 10 ثواني');
    } catch (err) {
      Alert.alert('خطأ', err.message || err.response?.data?.error || 'فشل بدء الرحلة');
    } finally {
      setLoading(false);
    }
  }

  async function handleEndTrip() {
    if (!tripId) return;
    setLoading(true);
    try {
      await api.post(`/trips/${tripId}/end`);
      await LocationService.stopTracking();
      setTripId(null);
      Alert.alert('تم', 'انتهت الرحلة بنجاح');
    } catch (err) {
      Alert.alert('خطأ', err.response?.data?.error || 'فشل إنهاء الرحلة');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await AsyncStorage.multiRemove(['token', 'user']);
    onLogout();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>مرحبًا، {user?.name}</Text>
      <Text style={styles.status}>
        {tripId ? 'الرحلة نشطة الآن 🟢' : 'لا توجد رحلة حالية'}
      </Text>

      {!tripId ? (
        <TouchableOpacity style={styles.startButton} onPress={handleStartTrip} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '...' : 'بدء رحلة (Start Trip)'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.endButton} onPress={handleEndTrip} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '...' : 'إنهاء الرحلة (End Trip)'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>تسجيل خروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f3f4f6' },
  welcome: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  status: { fontSize: 14, color: '#6b7280', marginBottom: 32 },
  startButton: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 16, paddingHorizontal: 40 },
  endButton: { backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 16, paddingHorizontal: 40 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { marginTop: 24 },
  logoutText: { color: '#6b7280', textDecorationLine: 'underline' },
});
