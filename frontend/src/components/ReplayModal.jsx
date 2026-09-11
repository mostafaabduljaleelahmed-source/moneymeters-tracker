import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import api from '../services/api';

// نافذة عرض تاريخ رحلة معينة (Replay) لمندوب بتاريخ ووقت محدد
export default function ReplayModal({ delegateId, onClose }) {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [route, setRoute] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/trips/${delegateId}`).then(({ data }) => setTrips(data.trips || []));
  }, [delegateId]);

  // اقفل النافذة بزرار Esc كمان، مش بس بالضغط على ✕
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!selectedTripId) return;
    setLoading(true);
    api
      .get(`/trips/${selectedTripId}/route`)
      .then(({ data }) => setRoute(data.route.map((p) => [p.lat, p.lng])))
      .finally(() => setLoading(false));
  }, [selectedTripId]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-3xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold">إعادة عرض رحلة</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-10 h-10 flex items-center justify-center rounded-full text-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="p-4 border-b">
          <label className="text-sm text-gray-600 ml-2">اختر رحلة:</label>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">-- اختر --</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {new Date(t.started_at).toLocaleString('ar-EG')} ({t.status === 'active' ? 'نشطة' : 'منتهية'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">جاري التحميل...</div>
          ) : route.length ? (
            <MapContainer center={route[0]} zoom={13} className="w-full h-full">
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline positions={route} pathOptions={{ color: '#2563eb', weight: 4 }} />
              <Marker position={route[0]} />
              <Marker position={route[route.length - 1]} />
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              اختر رحلة لعرض مسارها
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
