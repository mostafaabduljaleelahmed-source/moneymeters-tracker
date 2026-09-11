import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../services/AuthContext';

const VEHICLE_LABEL = { car: 'عربية', motorcycle: 'موتوسيكل', walking: 'على الرجل' };

// صفحة المندوب على المتصفح: بديل تطبيق الموبايل، بتستخدم GPS الجهاز مباشرة
export default function DelegateHome() {
  const { user, logout } = useAuth();
  const [tripId, setTripId] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('لا توجد رحلة حالية');
  const [speedKmh, setSpeedKmh] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);

  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const distanceMRef = useRef(0);
  const tripIdRef = useRef(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
      Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function onPosition(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let speedMps = typeof pos.coords.speed === 'number' && pos.coords.speed > 0 ? pos.coords.speed : null;

    if (lastPointRef.current) {
      const d = haversineMeters(lastPointRef.current, { lat, lng });
      if (d > 2) distanceMRef.current += d;
      if (speedMps === null) {
        const dtSec = (pos.timestamp - lastPointRef.current.t) / 1000;
        speedMps = dtSec > 0 ? d / dtSec : 0;
      }
    }
    lastPointRef.current = { lat, lng, t: pos.timestamp };

    const kmh = (speedMps || 0) * 3.6;
    setSpeedKmh(kmh);
    setDistanceKm(distanceMRef.current / 1000);
    setStatus('بيتحرك الآن — بيتبث للمدير');

    const now = Date.now();
    if (now - lastSentAtRef.current > 10000) {
      lastSentAtRef.current = now;
      api
        .post('/location', {
          lat,
          lng,
          speed: kmh / 3.6,
          tripId: tripIdRef.current,
          timestamp: new Date(pos.timestamp).toISOString(),
        })
        .catch((err) => console.error('فشل إرسال الموقع', err));
    }
  }

  function onPositionError(err) {
    let msg = 'تعذر الوصول لموقعك: ';
    if (err.code === 1) msg += 'رفضت إذن الموقع من المتصفح.';
    else if (err.code === 2) msg += 'الموقع غير متاح دلوقتي.';
    else msg += 'انتهت مهلة تحديد الموقع.';
    setError(msg);
    handleEndTrip();
  }

  async function handleStartTrip() {
    setError('');
    if (!navigator.geolocation) {
      setError('المتصفح ده مش بيدعم تحديد الموقع');
      return;
    }
    try {
      const { data } = await api.post('/trips/start');
      setTripId(data.trip.id);
      tripIdRef.current = data.trip.id;
      distanceMRef.current = 0;
      lastPointRef.current = null;
      setDistanceKm(0);
      setStatus('جاري تحديد الموقع...');

      watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onPositionError, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'فشل بدء الرحلة');
    }
  }

  async function handleEndTrip() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    const currentTripId = tripIdRef.current;
    tripIdRef.current = null;
    setTripId(null);
    setStatus('لا توجد رحلة حالية');

    if (currentTripId) {
      try {
        await api.post(`/trips/${currentTripId}/end`);
      } catch (err) {
        console.error('فشل إنهاء الرحلة', err);
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-sm text-center">
        <h1 className="font-bold text-lg mb-1">مرحبًا، {user?.name}</h1>
        <p className="text-sm text-gray-500 mb-6">
          وسيلة التنقل: {VEHICLE_LABEL[user?.vehicleType] || '-'}
        </p>

        {error && <div className="bg-red-100 text-red-700 text-sm rounded p-2 mb-4">{error}</div>}

        <p className="text-sm text-gray-600 mb-4">{status}</p>

        {tripId && (
          <div className="grid grid-cols-2 gap-2 mb-6 text-sm">
            <div className="bg-gray-50 rounded p-3">
              <p className="font-bold text-lg">{speedKmh.toFixed(0)}</p>
              <p className="text-gray-500">كم/س</p>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="font-bold text-lg">{distanceKm.toFixed(2)}</p>
              <p className="text-gray-500">كم مقطوعة</p>
            </div>
          </div>
        )}

        {!tripId ? (
          <button
            onClick={handleStartTrip}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded py-3 font-semibold mb-3"
          >
            بدء رحلة (Start Trip)
          </button>
        ) : (
          <button
            onClick={handleEndTrip}
            className="w-full bg-red-600 hover:bg-red-700 text-white rounded py-3 font-semibold mb-3"
          >
            إنهاء الرحلة (End Trip)
          </button>
        )}

        <button onClick={logout} className="text-sm text-gray-500 underline">
          تسجيل خروج
        </button>
      </div>
    </div>
  );
}
