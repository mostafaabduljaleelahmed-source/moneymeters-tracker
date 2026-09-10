import { useEffect, useState } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import DelegateList from '../components/DelegateList';
import LiveMap from '../components/LiveMap';
import ReplayModal from '../components/ReplayModal';
import { useAuth } from '../services/AuthContext';

export default function Dashboard() {
  const [delegates, setDelegates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [replayDelegateId, setReplayDelegateId] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const { user, logout } = useAuth();

  async function loadDelegates() {
    const { data } = await api.get('/delegates');
    setDelegates(data.delegates || []);
  }

  useEffect(() => {
    loadDelegates();
    const socket = connectSocket();

    // تحديث حالة الأونلاين/الأوفلاين مباشرة في القائمة
    function handleStatus({ userId, isOnline }) {
      setDelegates((prev) =>
        prev.map((d) => (d.id === userId ? { ...d, is_online: isOnline } : d))
      );
    }

    function handleIdleAlert(payload) {
      setAlerts((prev) => [{ ...payload, kind: 'idle' }, ...prev].slice(0, 20));
    }
    function handleGeofenceAlert(payload) {
      setAlerts((prev) => [{ ...payload, kind: 'geofence' }, ...prev].slice(0, 20));
    }

    socket.on('delegate:status', handleStatus);
    socket.on('alert:idle', handleIdleAlert);
    socket.on('alert:geofence', handleGeofenceAlert);

    return () => {
      socket.off('delegate:status', handleStatus);
      socket.off('alert:idle', handleIdleAlert);
      socket.off('alert:geofence', handleGeofenceAlert);
      disconnectSocket();
    };
  }, []);

  const delegatesById = Object.fromEntries(delegates.map((d) => [d.id, d]));

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold">MoneyMeters Tracker - لوحة التحكم</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>{user?.name}</span>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded">
            خروج
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 flex-shrink-0 flex flex-col">
          <DelegateList delegates={delegates} selectedIds={selectedIds} onToggleSelect={toggleSelect} />

          {selectedIds.length > 0 && (
            <div className="p-2 border-t">
              <button
                onClick={() => setReplayDelegateId(selectedIds[0])}
                className="w-full text-sm bg-gray-800 text-white rounded py-2 hover:bg-gray-700"
              >
                عرض تاريخ رحلة (Replay)
              </button>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="border-t p-2 overflow-y-auto max-h-56">
              <h3 className="text-xs font-bold text-gray-500 mb-1">التنبيهات</h3>
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`text-xs rounded p-2 mb-1 ${
                    a.kind === 'idle' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {a.message}
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="flex-1 relative">
          {selectedIds.length > 0 ? (
            <LiveMap delegateIds={selectedIds} delegatesById={delegatesById} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              اختر مندوب من القائمة لعرض موقعه على الخريطة
            </div>
          )}
        </main>
      </div>

      {replayDelegateId && (
        <ReplayModal delegateId={replayDelegateId} onClose={() => setReplayDelegateId(null)} />
      )}
    </div>
  );
}
