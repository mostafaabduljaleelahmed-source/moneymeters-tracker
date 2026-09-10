// ==========================================================
// سيرفر تجريبي (Mock) بدون قاعدة بيانات - لعرض الداشبورد شغال فعليًا
// كل مندوب بيتحرك فعليًا على مسار شوارع حقيقي (جاي من OSRM) حسب وسيلة تنقله:
// عربية (car) - موتوسيكل (motorcycle) - على الرجل (walking)
// ==========================================================
const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const PORT = 4000;
const JWT_SECRET = 'mock_secret_for_demo_only';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ---------- مسارات حقيقية على شوارع القاهرة (جاية من OSRM routing API) ----------
// كل مسار عبارة عن [lng, lat] بترتيب OSRM - هنحولها لـ [lat, lng] تحت
const CAR_PATH = [[31.235308,30.044323],[31.233003,30.042259],[31.231585,30.042487],[31.22924,30.036732],[31.229366,30.034077],[31.230739,30.03073],[31.229657,30.030702],[31.229815,30.029319],[31.226904,30.028417],[31.224302,30.028408],[31.2231,30.02249],[31.222526,30.012333],[31.224116,30.012386],[31.224087,30.013091],[31.227061,30.013458],[31.227519,30.015665],[31.228539,30.015709],[31.226354,30.004791],[31.22815,29.999143],[31.230646,29.994504]];

const MOTO_PATH = [[31.249996,30.059971],[31.252097,30.059645],[31.25581,30.058586],[31.258457,30.057388],[31.258455,30.0571],[31.258685,30.057005],[31.257816,30.055704],[31.25753,30.055066],[31.257637,30.054881],[31.257812,30.054914],[31.258332,30.055695],[31.260391,30.057398],[31.261458,30.056695],[31.263425,30.055748],[31.265216,30.054327],[31.265311,30.054406],[31.263676,30.055691],[31.264918,30.054909],[31.265582,30.054404],[31.265523,30.054231],[31.265311,30.054406],[31.265216,30.054327],[31.266925,30.053181],[31.268168,30.052662],[31.269923,30.052376],[31.269955,30.052208],[31.271714,30.056056],[31.271928,30.056173],[31.275799,30.055693],[31.276614,30.055308],[31.277888,30.054147],[31.278046,30.053876],[31.277523,30.05304],[31.273746,30.048462],[31.272723,30.0475]];

const WALK_PATH = [[31.218368,30.03023],[31.218942,30.032629],[31.220512,30.036717],[31.220597,30.038012],[31.220207,30.04008],[31.222259,30.040521],[31.227405,30.043435],[31.231747,30.043926],[31.231408,30.041443],[31.22924,30.036732],[31.22923,30.035568],[31.228225,30.034788],[31.227701,30.034798],[31.227422,30.034611],[31.225766,30.031239],[31.224994,30.031569],[31.225766,30.031239],[31.225057,30.029855],[31.225523,30.029646],[31.225426,30.02932],[31.226127,30.029166],[31.226364,30.029621],[31.226096,30.029721]];

// يحول [lng, lat] لـ [lat, lng] ويكرر المسار ذهابًا وإيابًا عشان يفضل يتحرك باستمرار
function toLatLngLoop(coords) {
  const forward = coords.map(([lng, lat]) => ({ lat, lng }));
  const backward = [...forward].reverse().slice(1, -1);
  return [...forward, ...backward];
}

// المسافة بالمتر بين نقطتين (Haversine)
function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ---------- بيانات وهمية ----------
const ADMIN = { id: 'admin-1', name: 'مدير النظام', email: 'admin@demo.com', password: '123456', role: 'admin' };

const delegates = [
  {
    id: 'd1', name: 'أحمد محمد', email: 'ahmed@demo.com', password: '123456', role: 'delegate',
    is_online: true, vehicle: 'car', speedKmh: 40,
    path: toLatLngLoop(CAR_PATH), pathIndex: 0, segmentProgress: 0,
  },
  {
    id: 'd2', name: 'محمود علي', email: 'mahmoud@demo.com', password: '123456', role: 'delegate',
    is_online: true, vehicle: 'motorcycle', speedKmh: 30,
    path: toLatLngLoop(MOTO_PATH), pathIndex: 0, segmentProgress: 0,
  },
  {
    id: 'd3', name: 'سارة حسن', email: 'sara@demo.com', password: '123456', role: 'delegate',
    is_online: true, vehicle: 'walking', speedKmh: 4.5,
    path: toLatLngLoop(WALK_PATH), pathIndex: 0, segmentProgress: 0,
  },
];

const users = [ADMIN, ...delegates];
const routes = Object.fromEntries(delegates.map((d) => [d.id, []])); // history المسار المقطوع فعليًا في الديمو
const TRIP_ID_PREFIX = 'trip-';

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'توكن غير صالح' });
  }
}

// ---------- Delegates ----------
app.get('/api/delegates', auth, (req, res) => {
  res.json({
    delegates: delegates.map(({ id, name, email, is_online, vehicle }) => ({
      id, name, email, is_online, vehicle, last_seen_at: new Date().toISOString(),
    })),
  });
});

// ---------- Trips (رحلة وهمية واحدة نشطة دايمًا لكل مندوب) ----------
app.get('/api/trips/:delegateId', auth, (req, res) => {
  const tripId = TRIP_ID_PREFIX + req.params.delegateId;
  res.json({ trips: [{ id: tripId, status: 'active', started_at: new Date(Date.now() - 3600000).toISOString() }] });
});

app.get('/api/trips/:tripId/route', auth, (req, res) => {
  const delegateId = req.params.tripId.replace(TRIP_ID_PREFIX, '');
  const route = (routes[delegateId] || []).map((p) => ({ lat: p.lat, lng: p.lng, created_at: p.timestamp }));
  res.json({ trip: { id: req.params.tripId }, route });
});

app.post('/api/trips/start', auth, (req, res) => {
  res.status(201).json({ trip: { id: TRIP_ID_PREFIX + req.user.id, status: 'active' } });
});

app.post('/api/trips/:tripId/end', auth, (req, res) => {
  res.json({ trip: { id: req.params.tripId, status: 'ended' } });
});

// ---------- Socket.io ----------
io.use((socket, next) => {
  try {
    socket.user = jwt.verify(socket.handshake.auth?.token, JWT_SECRET);
    next();
  } catch {
    next(new Error('توكن غير صالح'));
  }
});

io.on('connection', (socket) => {
  if (socket.user.role === 'admin') socket.join('admins');
  socket.on('watch:delegate', (id) => socket.join(`delegate_${id}`));
  socket.on('unwatch:delegate', (id) => socket.leave(`delegate_${id}`));
});

// ---------- محرك الحركة: يحرك كل مندوب على مساره الحقيقي بسرعة تناسب وسيلته ----------
const TICK_MS = 1000;

function advanceDelegate(d) {
  const speedMps = (d.speedKmh * 1000) / 3600;
  let distanceLeft = speedMps * (TICK_MS / 1000);

  while (distanceLeft > 0) {
    const current = d.path[d.pathIndex];
    const nextIdx = (d.pathIndex + 1) % d.path.length;
    const next = d.path[nextIdx];
    const segmentLen = distanceMeters(current, next) || 0.0001;
    const remainingInSegment = segmentLen * (1 - d.segmentProgress);

    if (distanceLeft < remainingInSegment) {
      d.segmentProgress += distanceLeft / segmentLen;
      distanceLeft = 0;
    } else {
      distanceLeft -= remainingInSegment;
      d.pathIndex = nextIdx;
      d.segmentProgress = 0;
    }
  }

  const from = d.path[d.pathIndex];
  const toIdx = (d.pathIndex + 1) % d.path.length;
  const to = d.path[toIdx];
  const lat = from.lat + (to.lat - from.lat) * d.segmentProgress;
  const lng = from.lng + (to.lng - from.lng) * d.segmentProgress;
  return { lat, lng };
}

// كل ثانية: حرّك كل مندوب أونلاين على مساره الحقيقي وابث موقعه عبر Socket.io
setInterval(() => {
  delegates.forEach((d) => {
    if (!d.is_online) return;

    const { lat, lng } = advanceDelegate(d);
    const timestamp = new Date().toISOString();

    routes[d.id].push({ lat, lng, timestamp });
    if (routes[d.id].length > 500) routes[d.id].shift();

    io.to(`delegate_${d.id}`).emit('location:update', {
      userId: d.id,
      tripId: TRIP_ID_PREFIX + d.id,
      lat,
      lng,
      speed: (d.speedKmh * 1000) / 3600,
      vehicle: d.vehicle,
      timestamp,
    });
  });
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`[MOCK SERVER] شغال على http://localhost:${PORT}`);
  console.log('بيانات الدخول التجريبية:');
  console.log('  المدير  -> admin@demo.com / 123456');
  console.log('  مناديب  -> ahmed@demo.com (عربية) / mahmoud@demo.com (موتوسيكل) / sara@demo.com (على الرجل) - كلمة السر 123456');
});
