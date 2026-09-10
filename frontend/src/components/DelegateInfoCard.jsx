// كارت معلومات المندوب: الاسم، آخر تحديث، السرعة، المسافة المقطوعة
export default function DelegateInfoCard({ delegate, last, distanceKm, color }) {
  if (!delegate) return null;

  return (
    <div
      className="bg-white rounded-lg shadow p-3 border-r-4"
      style={{ borderColor: color }}
    >
      <p className="font-bold text-gray-800">{delegate.name}</p>
      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
        <p>
          آخر تحديث:{' '}
          {last?.timestamp ? new Date(last.timestamp).toLocaleTimeString('ar-EG') : 'لا يوجد'}
        </p>
        <p>السرعة الحالية: {(last?.speed || 0).toFixed(1)} م/ث</p>
        <p>المسافة المقطوعة: {distanceKm?.toFixed(2) ?? '0.00'} كم</p>
      </div>
    </div>
  );
}
