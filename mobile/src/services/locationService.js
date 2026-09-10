import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const LOCATION_TASK_NAME = 'moneymeters-background-location';
const QUEUE_KEY = 'offline_location_queue';
const ACTIVE_TRIP_KEY = 'active_trip_id';

// ==========================================================
// Offline Queue: بنخزن كل موقع محليًا أولاً، وبعدين نحاول نرفعه.
// لو النت مقطوع، الموقع فاضل في الطابور لحد ما يرجع النت.
// ==========================================================
async function enqueueLocation(point) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  queue.push(point);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function flushQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  if (!queue.length) return;

  const remaining = [];
  for (const point of queue) {
    try {
      await api.post('/location', point);
    } catch (err) {
      // فشل الإرسال (غالبًا مفيش نت) - رجّعه للطابور عشان يتحاول تاني بعدين
      remaining.push(point);
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

async function sendOrQueue(point) {
  try {
    await api.post('/location', point);
    // لو نجح الإرسال، جرب فضي أي حاجة متراكمة من قبل كمان
    flushQueue().catch(() => {});
  } catch (err) {
    await enqueueLocation(point);
  }
}

// ==========================================================
// Task الخلفية: يشتغل حتى لو التطبيق مقفول أو في الخلفية
// ==========================================================
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[LocationTask] خطأ:', error);
    return;
  }
  if (!data) return;

  const { locations } = data;
  const tripId = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);

  for (const loc of locations) {
    const point = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      speed: loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed : 0,
      heading: loc.coords.heading,
      accuracy: loc.coords.accuracy,
      timestamp: new Date(loc.timestamp).toISOString(),
      tripId: tripId || undefined,
    };
    await sendOrQueue(point);
  }
});

// ==========================================================
// API عامة يستخدمها الـ UI (زر Start/End Trip)
// ==========================================================
export const LocationService = {
  async requestPermissions() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') throw new Error('لازم تسمح بالوصول للموقع');

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') throw new Error('لازم تسمح بالوصول للموقع في الخلفية');
  },

  async startTracking(tripId) {
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, tripId);

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (alreadyStarted) return;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, // كل 10 ثواني حسب المطلوب
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'MoneyMeters Tracker',
        notificationBody: 'جاري تتبع رحلتك الحالية',
      },
    });
  },

  async stopTracking() {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  },

  flushQueue,
};

export default LocationService;
