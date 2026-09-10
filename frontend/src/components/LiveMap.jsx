import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';
import { connectSocket } from '../services/socket';

// ألوان مختلفة لكل مندوب عند فتح أكتر من مندوب في نفس الوقت (Multi-tracking)
const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777'];
const colorForIndex = (i) => COLORS[i % COLORS.length];

// أيقونة توضح وسيلة تنقل المندوب: عربية / موتوسيكل / ماشي على رجله
const VEHICLE_EMOJI = { car: '🚗', motorcycle: '🏍️', walking: '🚶' };
const VEHICLE_LABEL = { car: 'عربية', motorcycle: 'موتوسيكل', walking: 'على الرجل' };

function makeIcon(color, vehicle) {
  const emoji = VEHICLE_EMOJI[vehicle] || '📍';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      width:30px;height:30px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;line-height:1;
      border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);
    ">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// يحرك مركز الخريطة تلقائيًا عند تغيير آخر موقع لأول مندوب مختار
function RecenterOnUpdate({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function LiveMap({ delegateIds, delegatesById }) {
  // tracks[delegateId] = { path: [[lat,lng],...], last: {...} }
  const [tracks, setTracks] = useState({});
  const socketRef = useRef(null);

  // تحميل آخر رحلة نشطة أو الأخيرة لكل مندوب مختار عشان نرسم مساره الحالي
  useEffect(() => {
    let cancelled = false;

    async function loadInitialRoutes() {
      for (const id of delegateIds) {
        try {
          const { data } = await api.get(`/trips/${id}`);
          const activeTrip = data.trips?.find((t) => t.status === 'active') || data.trips?.[0];
          if (!activeTrip) continue;

          const routeRes = await api.get(`/trips/${activeTrip.id}/route`);
          if (cancelled) return;

          const path = routeRes.data.route.map((p) => [p.lat, p.lng]);
          setTracks((prev) => ({
            ...prev,
            [id]: {
              path,
              last: path.length ? { lat: path[path.length - 1][0], lng: path[path.length - 1][1] } : null,
              tripId: activeTrip.id,
            },
          }));
        } catch (err) {
          console.error('فشل تحميل مسار المندوب', id, err);
        }
      }
    }

    if (delegateIds.length) loadInitialRoutes();
    return () => {
      cancelled = true;
    };
  }, [delegateIds]);

  // الاشتراك في Socket.io لاستقبال تحديثات الموقع اللحظية لكل مندوب مختار
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    delegateIds.forEach((id) => socket.emit('watch:delegate', id));

    function handleUpdate(payload) {
      setTracks((prev) => {
        const existing = prev[payload.userId] || { path: [], last: null };
        const newPoint = [payload.lat, payload.lng];
        return {
          ...prev,
          [payload.userId]: {
            path: [...existing.path, newPoint],
            last: payload,
            tripId: payload.tripId,
          },
        };
      });
    }

    socket.on('location:update', handleUpdate);

    return () => {
      delegateIds.forEach((id) => socket.emit('unwatch:delegate', id));
      socket.off('location:update', handleUpdate);
    };
  }, [delegateIds]);

  const center = useMemo(() => {
    const firstTrack = tracks[delegateIds[0]];
    if (firstTrack?.last) return [firstTrack.last.lat, firstTrack.last.lng];
    return [30.0444, 31.2357]; // القاهرة كنقطة افتراضية
  }, [tracks, delegateIds]);

  return (
    <MapContainer center={center} zoom={13} className="w-full h-full">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <RecenterOnUpdate position={tracks[delegateIds[0]]?.last ? center : null} />

      {delegateIds.map((id, index) => {
        const track = tracks[id];
        if (!track) return null;
        const color = colorForIndex(index);
        const delegate = delegatesById[id];

        return (
          <div key={id}>
            {track.path.length > 1 && (
              <Polyline positions={track.path} pathOptions={{ color, weight: 4 }} />
            )}

            {track.last && (
              <Marker
                position={[track.last.lat, track.last.lng]}
                icon={makeIcon(color, track.last.vehicle)}
              >
                <Popup>
                  <div className="text-sm" dir="rtl">
                    <p className="font-bold">
                      {VEHICLE_EMOJI[track.last.vehicle] || ''} {delegate?.name || 'مندوب'}
                    </p>
                    <p>وسيلة التنقل: {VEHICLE_LABEL[track.last.vehicle] || 'غير محدد'}</p>
                    <p>السرعة: {((track.last.speed || 0) * 3.6).toFixed(0)} كم/س</p>
                    <p>
                      آخر تحديث:{' '}
                      {track.last.timestamp
                        ? new Date(track.last.timestamp).toLocaleTimeString('ar-EG')
                        : '-'}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}
