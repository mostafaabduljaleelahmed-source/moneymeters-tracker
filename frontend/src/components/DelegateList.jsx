// أيقونة توضح وسيلة تنقل المندوب: عربية / موتوسيكل / ماشي على رجله
const VEHICLE_EMOJI = { car: '🚗', motorcycle: '🏍️', walking: '🚶' };

// قائمة المناديب في الـ Sidebar - نقطة خضراء = أونلاين، رمادية = أوفلاين
export default function DelegateList({ delegates, selectedIds, onToggleSelect }) {
  return (
    <div className="h-full overflow-y-auto bg-white border-l">
      <h2 className="px-4 py-3 font-bold text-gray-700 border-b">المناديب</h2>
      <ul>
        {delegates.map((d) => {
          const isSelected = selectedIds.includes(d.id);
          return (
            <li
              key={d.id}
              onClick={() => onToggleSelect(d.id)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b hover:bg-blue-50 ${
                isSelected ? 'bg-blue-100' : ''
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  d.is_online ? 'bg-green-500' : 'bg-gray-400'
                }`}
                title={d.is_online ? 'أونلاين' : 'أوفلاين'}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {VEHICLE_EMOJI[d.vehicle] ? `${VEHICLE_EMOJI[d.vehicle]} ` : ''}
                  {d.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {d.is_online
                    ? 'متصل الآن'
                    : d.last_seen_at
                    ? `آخر ظهور: ${new Date(d.last_seen_at).toLocaleString('ar-EG')}`
                    : 'لم يتصل بعد'}
                </p>
              </div>
            </li>
          );
        })}

        {delegates.length === 0 && (
          <li className="px-4 py-6 text-center text-gray-400 text-sm">لا يوجد مناديب</li>
        )}
      </ul>
    </div>
  );
}
