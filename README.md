# MoneyMeters Tracker

نظام تتبع مباشر لمناديب مصنع عدادات الفلوس على الخريطة، مكوّن من:
- **Backend**: Node.js + Express + Socket.io + PostgreSQL/PostGIS
- **Frontend (Dashboard)**: React + Vite + TailwindCSS + Leaflet + Socket.io-client
- **Mobile**: React Native (Expo) + expo-location (Background Tracking)

## هيكل المشروع

```
track project/
├── backend/
│   ├── src/
│   │   ├── config/env.js          # متغيرات البيئة
│   │   ├── db/
│   │   │   ├── pool.js            # اتصال PostgreSQL
│   │   │   ├── migrate.js         # تشغيل schema.sql
│   │   │   └── schema.sql         # تعريف الجداول (users, trips, locations...)
│   │   ├── models/                # استعلامات قاعدة البيانات
│   │   ├── controllers/           # منطق الـ API
│   │   ├── routes/                # مسارات Express
│   │   ├── middleware/            # auth + errorHandler
│   │   ├── sockets/                # Socket.io (اتصال + تنبيهات)
│   │   └── server.js               # نقطة الدخول
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/            # DelegateList, LiveMap, ReplayModal...
│   │   ├── pages/                 # Login, Dashboard
│   │   ├── services/              # api.js, socket.js, AuthContext
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
└── mobile/
    ├── src/
    │   ├── screens/                # LoginScreen, HomeScreen
    │   └── services/                # api.js, locationService.js (Background + Offline Queue)
    ├── App.js
    ├── app.json
    └── package.json
```

## 1) تشغيل قاعدة البيانات (PostgreSQL + PostGIS)

أسهل طريقة عن طريق Docker:

```bash
docker run --name moneymeters-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=moneymeters -p 5432:5432 -d postgis/postgis:16-3.4
```

## 2) تشغيل الـ Backend

```bash
cd backend
cp .env.example .env
# عدّل .env بالقيم المناسبة (خصوصًا JWT_SECRET و DATABASE_URL)
npm install
npm run migrate      # ينشئ الجداول من schema.sql
npm run dev           # يشغل السيرفر على http://localhost:4000
```

### إنشاء أول مدير ومندوب تجريبي

استخدم `POST /api/auth/register` (مؤقتًا أثناء التطوير):

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"123456","role":"admin"}'

curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Delegate 1","email":"delegate1@example.com","password":"123456","role":"delegate"}'
```

> في الإنتاج: احذف أو قيّد مسار `/register` بحيث يكون متاح للمدير فقط.

## 3) تشغيل الـ Frontend (Dashboard)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev           # يشغل الداشبورد على http://localhost:5173
```

سجّل دخول بحساب المدير، هتشوف قائمة المناديب والخريطة.

## 4) تشغيل الـ Mobile App

```bash
cd mobile
npm install
npx expo start
```

- افتح التطبيق على جهاز حقيقي (عن طريق Expo Go) أو محاكي.
- سجّل دخول بحساب المندوب.
- اضغط **Start Trip** لبدء الإرسال التلقائي للموقع كل 10 ثواني (حتى في الخلفية).
- اضغط **End Trip** لإنهاء الرحلة.
- لو النت اتقطع، المواقع بتتخزن محليًا وتترفع تلقائيًا لما النت يرجع.

> ملحوظة: لازم تغيّر `API_URL` في `mobile/src/services/api.js` لعنوان السيرفر الحقيقي (مش localhost) لو بتجرب على جهاز حقيقي أو تبني نسخة إنتاج.

## Endpoints الرئيسية

| Method | Path                          | الوصف                                  |
|--------|-------------------------------|------------------------------------------|
| POST   | /api/auth/login               | تسجيل دخول (يرجع JWT)                   |
| POST   | /api/location                 | استقبال موقع من المندوب                |
| GET    | /api/delegates                | قائمة كل المناديب (admin فقط)          |
| GET    | /api/trips/:delegateId        | كل رحلات مندوب معين (admin فقط)        |
| GET    | /api/trips/:tripId/route      | مسار رحلة معينة (Polyline)              |
| POST   | /api/trips/start               | بدء رحلة جديدة (delegate)               |
| POST   | /api/trips/:tripId/end         | إنهاء رحلة (delegate)                    |

## Socket.io Events

- `location:update` — بث موقع لحظي لغرفة `delegate_<id>`
- `delegate:status` — تغيّر حالة أونلاين/أوفلاين
- `alert:idle` — تنبيه توقف أكثر من 15 دقيقة
- `alert:geofence` — تنبيه خروج عن النطاق المحدد
- `watch:delegate` / `unwatch:delegate` — (يُرسل من الداشبورد) للاشتراك/الإلغاء في متابعة مندوب

## ملاحظات للإنتاج

- فعّل HTTPS وقيّد `CORS_ORIGIN` بدومين حقيقي.
- استخدم قيمة عشوائية قوية لـ `JWT_SECRET`.
- أضف Rate limiting أشمل ومراقبة (Monitoring/Logging) حقيقية (مثل Sentry).
- النظام مصمم Modular ليتحمل 100+ مندوب: الجداول مفهرسة (Indexes) والاتصال عبر Socket rooms منفصلة لكل مندوب لتقليل البيانات المرسلة لكل عميل.
